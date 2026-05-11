import {
  MeSchema,
  RunSchema,
  RunListSchema,
  RunProofSchema,
  NodeSchema,
  NodeListSchema,
  MonitorSchema,
  MonitorListSchema,
  MonitorExecutionListSchema,
  SignalSchema,
  SignalListSchema,
  FindingSchema,
  FindingListSchema,
  ReviewSchema,
  ReviewListSchema,
  NarrativeSchema,
  AgentSchema,
  type Me,
  type Run,
  type RunProof,
  type Node,
  type Monitor,
  type MonitorExecution,
  type Signal,
  type Severity,
  type Finding,
  type FindingStatus,
  type Review,
  type ReviewDecision,
  type Narrative,
  type Agent,
} from "../types/index.js";
import {
  ApiError,
  AuthenticationError,
  NetworkError,
  NotFoundError,
} from "./errors.js";
import {
  MemoryReadResponseSchema,
  MemoryWriteResponseSchema,
  type MemoryReadResponse,
  type MemoryWriteResponse,
  type MemorySource,
  type MemorySubjectType,
  type EvidenceRef,
} from "../types/memory.js";
import type { z } from "zod";

export interface ClientOptions {
  /** API key (inv_live_/inv_test_) used for agent-scoped operations. */
  apiKey?: string;
  /** Supabase access token for user-scoped operations (signup/agent management). */
  accessToken?: string;
  baseUrl: string;
}

export interface PageOptions {
  cursor?: string;
  limit?: number;
}

type Page<T> = { data: T[]; next_cursor?: string | null };

export class InvarianceClient {
  private readonly apiKey?: string;
  private readonly accessToken?: string;
  readonly baseUrl: string;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    if (!this.apiKey && !this.accessToken) {
      throw new Error("InvarianceClient requires either apiKey or accessToken");
    }
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
    },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken ?? this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "invariance-cli",
        },
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (error) {
      if (error instanceof TypeError) throw new NetworkError();
      throw error;
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError();
      }
      if (response.status === 404) {
        throw new NotFoundError("Resource", path);
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text().catch(() => undefined);
      }
      const message = extractMessage(body, response.status);
      throw new ApiError(message, response.status, body);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async parsed<T extends z.ZodTypeAny>(
    schema: T,
    method: string,
    path: string,
    options?: { body?: unknown; params?: Record<string, string | number | boolean | undefined> },
  ): Promise<z.infer<T>> {
    const data = await this.request<unknown>(method, path, options);
    return schema.parse(data) as z.infer<T>;
  }

  // ── Agents / identity ──

  async me(): Promise<Me> {
    return this.parsed(MeSchema, "GET", "/v1/agents/me");
  }

  async listAgents(projectId: string): Promise<Page<Agent>> {
    const res = await this.request<{ data: unknown[]; next_cursor?: string | null }>(
      "GET",
      "/v1/agents",
      { params: { project_id: projectId } },
    );
    return {
      data: res.data.map((a) => AgentSchema.parse(a)),
      next_cursor: res.next_cursor ?? null,
    };
  }

  async listOperators(projectId: string): Promise<Page<Agent>> {
    const res = await this.request<{ data: unknown[]; next_cursor?: string | null }>(
      "GET",
      "/v1/operators",
      { params: { project_id: projectId } },
    );
    return {
      data: res.data.map((a) => AgentSchema.parse(a)),
      next_cursor: res.next_cursor ?? null,
    };
  }

  async getAgent(id: string): Promise<Agent> {
    const res = await this.request<{ agent: unknown }>(
      "GET",
      `/v1/agents/${encodeURIComponent(id)}`,
    );
    return AgentSchema.parse(res.agent);
  }

  async getOperator(id: string): Promise<Agent> {
    const res = await this.request<{ operator?: unknown; agent?: unknown }>(
      "GET",
      `/v1/operators/${encodeURIComponent(id)}`,
    );
    return AgentSchema.parse(res.operator ?? res.agent);
  }

  async createAgent(input: { name: string; project_id: string; public_key?: string; operator_type?: "agent" | "human" }): Promise<Agent> {
    const res = await this.request<{ agent: unknown }>("POST", "/v1/agents", {
      body: input,
    });
    return AgentSchema.parse((res as { agent: unknown }).agent ?? res);
  }

  async createOperator(input: { name: string; project_id: string; public_key?: string; operator_type?: "agent" | "human" }): Promise<Agent> {
    const res = await this.request<{ agent: unknown }>("POST", "/v1/operators", {
      body: input,
    });
    return AgentSchema.parse((res as { operator?: unknown; agent?: unknown }).operator ?? res.agent ?? res);
  }

  async authMe(): Promise<{
    user: { id: string; email: string };
    organizations: Array<{ id: string; name: string }>;
    projects: Array<{ id: string; org_id: string; name: string }>;
  }> {
    return this.request("GET", "/v1/auth/me");
  }

  async issueCliToken(input: { hostname?: string; project_id?: string; expires_in_days?: number } = {}): Promise<{
    api_key_once: string;
    agent: Agent;
    project_id: string;
    label: string;
  }> {
    return this.request("POST", "/v1/auth/cli-token", { body: input });
  }

  async rotateAgentKey(publicKey: string): Promise<Agent> {
    const res = await this.request<{ agent: unknown }>("PUT", "/v1/agents/me/key", {
      body: { public_key: publicKey },
    });
    return AgentSchema.parse(res.agent);
  }

  // ── Runs ──

  async startRun(input: {
    name?: string;
    metadata?: Record<string, unknown>;
    session_type?: string | null;
    session_source?: string | null;
  }): Promise<Run> {
    const res = await this.request<{ run: unknown }>("POST", "/v1/runs", { body: input });
    return RunSchema.parse(res.run);
  }

  async listRuns(
    opts: PageOptions & { eval_suite?: string } = {},
  ): Promise<Page<Run>> {
    return this.parsed(RunListSchema, "GET", "/v1/runs", {
      params: { cursor: opts.cursor, limit: opts.limit, eval_suite: opts.eval_suite },
    });
  }

  async getRun(id: string): Promise<Run> {
    const res = await this.request<{ run: unknown }>(
      "GET",
      `/v1/runs/${encodeURIComponent(id)}`,
    );
    return RunSchema.parse(res.run);
  }

  async updateRun(id: string, patch: Record<string, unknown>): Promise<Run> {
    const res = await this.request<{ run: unknown }>(
      "PATCH",
      `/v1/runs/${encodeURIComponent(id)}`,
      { body: patch },
    );
    return RunSchema.parse(res.run);
  }

  async forkRun(id: string, fromNodeId?: string): Promise<unknown> {
    return this.request("POST", `/v1/runs/${encodeURIComponent(id)}/fork`, {
      body: fromNodeId ? { from_node_id: fromNodeId } : {},
    });
  }

  async runMetrics(id: string): Promise<unknown> {
    return this.request("GET", `/v1/runs/${encodeURIComponent(id)}/metrics`);
  }

  async runLlmCalls(id: string, opts: PageOptions = {}): Promise<unknown> {
    return this.request("GET", `/v1/runs/${encodeURIComponent(id)}/llm-calls`, {
      params: { cursor: opts.cursor, limit: opts.limit },
    });
  }

  async verifyRun(id: string): Promise<RunProof> {
    return this.parsed(RunProofSchema, "GET", `/v1/runs/${encodeURIComponent(id)}/verify`);
  }

  async getRunNarrative(id: string, refresh = false): Promise<Narrative> {
    const res = await this.request<{ narrative: unknown }>(
      "GET",
      `/v1/runs/${encodeURIComponent(id)}/narrative`,
      { params: refresh ? { refresh: "true" } : undefined },
    );
    return NarrativeSchema.parse(res.narrative);
  }

  async listRunNodes(id: string, opts: PageOptions = {}): Promise<Page<Node>> {
    return this.parsed(NodeListSchema, "GET", `/v1/runs/${encodeURIComponent(id)}/nodes`, {
      params: { cursor: opts.cursor, limit: opts.limit },
    });
  }

  // ── Nodes ──

  async writeNodes(runId: string, events: Record<string, unknown>[]): Promise<Node[]> {
    const body = events.map((e) => ({ run_id: runId, ...e }));
    const res = await this.request<{ data: unknown[] }>("POST", "/v1/nodes", { body });
    return res.data.map((n) => NodeSchema.parse(n));
  }

  // ── Monitors ──

  async createMonitor(body: Record<string, unknown>): Promise<Monitor> {
    const res = await this.request<{ monitor: unknown }>("POST", "/v1/monitors", { body });
    return MonitorSchema.parse(res.monitor);
  }

  async listMonitors(opts: PageOptions = {}): Promise<Page<Monitor>> {
    return this.parsed(MonitorListSchema, "GET", "/v1/monitors", {
      params: { cursor: opts.cursor, limit: opts.limit },
    });
  }

  async getMonitor(id: string): Promise<Monitor> {
    const res = await this.request<{ monitor: unknown }>(
      "GET",
      `/v1/monitors/${encodeURIComponent(id)}`,
    );
    return MonitorSchema.parse(res.monitor);
  }

  async updateMonitor(id: string, patch: Record<string, unknown>): Promise<Monitor> {
    const res = await this.request<{ monitor: unknown }>(
      "PATCH",
      `/v1/monitors/${encodeURIComponent(id)}`,
      { body: patch },
    );
    return MonitorSchema.parse(res.monitor);
  }

  async deleteMonitor(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/monitors/${encodeURIComponent(id)}`);
  }

  async evaluateMonitor(
    id: string,
    body: { run_id?: string; since?: string; limit?: number },
  ): Promise<unknown> {
    return this.request("POST", `/v1/monitors/${encodeURIComponent(id)}/evaluate`, { body });
  }

  async monitorExecutions(id: string, opts: PageOptions = {}): Promise<Page<MonitorExecution>> {
    return this.parsed(
      MonitorExecutionListSchema,
      "GET",
      `/v1/monitors/${encodeURIComponent(id)}/executions`,
      { params: { cursor: opts.cursor, limit: opts.limit } },
    );
  }

  async monitorFindings(id: string, opts: PageOptions = {}): Promise<Page<Finding>> {
    return this.parsed(
      FindingListSchema,
      "GET",
      `/v1/monitors/${encodeURIComponent(id)}/findings`,
      { params: { cursor: opts.cursor, limit: opts.limit } },
    );
  }

  // ── Signals ──

  async emitSignal(input: {
    severity: Severity;
    title: string;
    message?: string;
    type?: string;
    data?: unknown;
    run_id?: string;
    node_id?: string;
  }): Promise<Signal> {
    const res = await this.request<{ signal: unknown }>("POST", "/v1/signals", { body: input });
    return SignalSchema.parse(res.signal);
  }

  async listSignals(
    opts: PageOptions & {
      status?: string;
      severity?: string;
      run_id?: string;
      monitor_id?: string;
      node_id?: string;
      source?: string;
    } = {},
  ): Promise<Page<Signal>> {
    return this.parsed(SignalListSchema, "GET", "/v1/signals", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        status: opts.status,
        severity: opts.severity,
        run_id: opts.run_id,
        monitor_id: opts.monitor_id,
        node_id: opts.node_id,
        source: opts.source,
      },
    });
  }

  async getSignal(id: string): Promise<Signal> {
    const res = await this.request<{ signal: unknown }>(
      "GET",
      `/v1/signals/${encodeURIComponent(id)}`,
    );
    return SignalSchema.parse(res.signal);
  }

  async ackSignal(id: string): Promise<Signal> {
    const res = await this.request<{ signal: unknown }>(
      "PATCH",
      `/v1/signals/${encodeURIComponent(id)}/acknowledge`,
    );
    return SignalSchema.parse(res.signal);
  }

  async resolveSignal(id: string): Promise<Signal> {
    const res = await this.request<{ signal: unknown }>(
      "PATCH",
      `/v1/signals/${encodeURIComponent(id)}/resolve`,
    );
    return SignalSchema.parse(res.signal);
  }

  // ── Findings ──

  async listFindings(
    opts: PageOptions & { run_id?: string } = {},
  ): Promise<Page<Finding>> {
    return this.parsed(FindingListSchema, "GET", "/v1/findings", {
      params: { cursor: opts.cursor, limit: opts.limit, run_id: opts.run_id },
    });
  }

  async getFinding(id: string): Promise<Finding> {
    const res = await this.request<{ finding: unknown }>(
      "GET",
      `/v1/findings/${encodeURIComponent(id)}`,
    );
    return FindingSchema.parse(res.finding);
  }

  async updateFinding(id: string, status: FindingStatus): Promise<Finding> {
    const res = await this.request<{ finding: unknown }>(
      "PATCH",
      `/v1/findings/${encodeURIComponent(id)}`,
      { body: { status } },
    );
    return FindingSchema.parse(res.finding);
  }

  // ── Reviews ──

  async listReviews(opts: PageOptions = {}): Promise<Page<Review>> {
    return this.parsed(ReviewListSchema, "GET", "/v1/reviews", {
      params: { cursor: opts.cursor, limit: opts.limit },
    });
  }

  async getReview(id: string): Promise<Review> {
    const res = await this.request<{ review: unknown }>(
      "GET",
      `/v1/reviews/${encodeURIComponent(id)}`,
    );
    return ReviewSchema.parse(res.review);
  }

  async patchReview(id: string, body: Record<string, unknown>): Promise<Review> {
    const res = await this.request<{ review: unknown } | unknown>(
      "PATCH",
      `/v1/reviews/${encodeURIComponent(id)}`,
      { body },
    );
    const r =
      res && typeof res === "object" && "review" in (res as Record<string, unknown>)
        ? (res as { review: unknown }).review
        : res;
    return ReviewSchema.parse(r);
  }

  async claimReview(id: string, notes?: string): Promise<Review> {
    return this.patchReview(id, { status: "claimed", ...(notes ? { notes } : {}) });
  }

  async unclaimReview(id: string, notes?: string): Promise<Review> {
    return this.patchReview(id, { status: "pending", ...(notes ? { notes } : {}) });
  }

  async resolveReview(
    id: string,
    decision: ReviewDecision,
    notes?: string,
  ): Promise<Review> {
    return this.patchReview(id, { decision, ...(notes ? { notes } : {}) });
  }

  // ── Memory ──

  async memoryRead(input: {
    run_id?: string;
    node_id?: string;
    subject_type: MemorySubjectType;
    subject_id: string;
    key: string;
    used_for: string;
  }): Promise<MemoryReadResponse> {
    return this.parsed(MemoryReadResponseSchema, "POST", "/v1/memory/read", { body: input });
  }

  async memoryWrite(input: {
    run_id?: string;
    node_id?: string;
    subject_type: MemorySubjectType;
    subject_id: string;
    key: string;
    value: unknown;
    used_for: string;
    source?: MemorySource;
    confidence?: number;
    provenance?: EvidenceRef[];
    valid_until?: string | null;
  }): Promise<MemoryWriteResponse> {
    const body = {
      ...input,
      source: input.source ?? "agent_write",
      confidence: input.confidence ?? 1.0,
    };
    return this.parsed(MemoryWriteResponseSchema, "POST", "/v1/memory/write", { body });
  }

  // ── Metrics ──

  async metricsOverview(params: {
    window_hours?: number;
  } = {}): Promise<unknown> {
    return this.request("GET", "/v1/metrics/overview", { params });
  }

  async metricsAgents(params: {
    window_hours?: number;
  } = {}): Promise<unknown> {
    return this.request("GET", "/v1/metrics/agents", { params });
  }
}

// ── Unauthenticated auth endpoints (signup / signin / refresh) ──

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface SignupResponse {
  user: { id: string; email: string };
  organization: { id: string; name: string };
  project: { id: string; org_id: string; name: string };
  agent: { id: string; name: string; project_id: string };
  api_key_once: string;
  session: AuthSession | null;
}

export interface SigninResponse {
  user: { id: string; email: string };
  session: AuthSession;
}

export interface RefreshResponse {
  session: AuthSession;
}

async function authPost<T>(baseUrl: string, path: string, body: unknown): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, "")}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "invariance-cli",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof TypeError) throw new NetworkError();
    throw error;
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError(
        `Authentication failed (${response.status}). Check email/password.`,
      );
    }
    let bodyJson: unknown;
    try {
      bodyJson = await response.json();
    } catch {
      bodyJson = await response.text().catch(() => undefined);
    }
    throw new ApiError(extractMessage(bodyJson, response.status), response.status, bodyJson);
  }
  return (await response.json()) as T;
}

export function authSignup(
  baseUrl: string,
  body: {
    email: string;
    password: string;
    signup_type?: "individual" | "org";
    org_name?: string;
    project_name?: string;
  },
): Promise<SignupResponse> {
  return authPost<SignupResponse>(baseUrl, "/v1/auth/signup", body);
}

export function authSignin(
  baseUrl: string,
  body: { email: string; password: string },
): Promise<SigninResponse> {
  return authPost<SigninResponse>(baseUrl, "/v1/auth/signin", body);
}

export function authRefresh(baseUrl: string, refreshToken: string): Promise<RefreshResponse> {
  return authPost<RefreshResponse>(baseUrl, "/v1/auth/refresh", {
    refresh_token: refreshToken,
  });
}

function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const anyBody = body as Record<string, unknown>;
    if (
      anyBody["error"] &&
      typeof anyBody["error"] === "object" &&
      "message" in (anyBody["error"] as Record<string, unknown>)
    ) {
      return String((anyBody["error"] as { message: unknown }).message);
    }
    if ("message" in anyBody) return String(anyBody["message"]);
  }
  return `API request failed with status ${status}`;
}

export function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}
