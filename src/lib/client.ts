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
import type { z } from "zod";

export interface ClientOptions {
  apiKey: string;
  baseUrl: string;
}

export interface PageOptions {
  cursor?: string;
  limit?: number;
}

type Page<T> = { data: T[]; next_cursor?: string | null };

export class InvarianceClient {
  private readonly apiKey: string;
  readonly baseUrl: string;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
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
          Authorization: `Bearer ${this.apiKey}`,
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

  async getAgent(id: string): Promise<Agent> {
    const res = await this.request<{ agent: unknown }>(
      "GET",
      `/v1/agents/${encodeURIComponent(id)}`,
    );
    return AgentSchema.parse(res.agent);
  }

  async rotateAgentKey(publicKey: string): Promise<Agent> {
    const res = await this.request<{ agent: unknown }>("PUT", "/v1/agents/me/key", {
      body: { public_key: publicKey },
    });
    return AgentSchema.parse(res.agent);
  }

  // ── Runs ──

  async startRun(input: { name?: string; metadata?: Record<string, unknown> }): Promise<Run> {
    const res = await this.request<{ run: unknown }>("POST", "/v1/runs", { body: input });
    return RunSchema.parse(res.run);
  }

  async listRuns(opts: PageOptions = {}): Promise<Page<Run>> {
    return this.parsed(RunListSchema, "GET", "/v1/runs", {
      params: { cursor: opts.cursor, limit: opts.limit },
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

  async listFindings(opts: PageOptions = {}): Promise<Page<Finding>> {
    return this.parsed(FindingListSchema, "GET", "/v1/findings", {
      params: { cursor: opts.cursor, limit: opts.limit },
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

  // ── Metrics ──

  async metricsOverview(params: {
    window_hours?: number;
  } = {}): Promise<unknown> {
    return this.request("GET", "/v1/metrics/overview", { params });
  }
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
