import {
  MeSchema,
  CaseSchema,
  CaseListSchema,
  WorkflowDefinitionSchema,
  WorkflowEventListSchema,
  WorkflowEventSchema,
  type Case,
  type CaseStatus,
  type WorkflowDefinition,
  type WorkflowEvent,
  type WorkflowEventActorType,
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
  OperatorSchema,
  AgentSessionSchema,
  type Operator,
  type OperatorType,
  type AgentSession,
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
  type EvalDataset,
  type EvalDatasetExample,
  type EvalScorer,
  type ScorerSpec,
  type EvalRunRecord,
  type EvalResultRecord,
  type CompareResponse,
  RecipeSchema,
  RecipeListSchema,
  GuardrailSchema,
  GuardrailListSchema,
  DnaEntityListSchema,
  DnaEdgeListSchema,
  DnaEdgeExplainSchema,
  DnaQueryResponseSchema,
  DnaEdgeCandidateListSchema,
  DnaEdgeCandidateSchema,
  DnaPromoteResponseSchema,
  DnaObjectListSchema,
  DnaObjectMentionListSchema,
  type DnaObject,
  type DnaObjectMention,
  type DnaEdgeCandidate,
  type DnaPromoteResponse,
  type Recipe,
  type Guardrail,
  type GuardrailMode,
  type GuardrailStatus,
  type DnaEntity,
  type DnaEdge,
  type DnaEdgeExplain,
  type DnaQueryResponse,
  CortexJobCreateResponseSchema,
  CortexJobSchema,
  CortexJobResultSchema,
  CortexLaunchJobResponseSchema,
  CortexJobListSchema,
  CortexRetryJobResponseSchema,
  CortexJobRunListSchema,
  type CortexJob,
  type CortexJobCreateRequest,
  type CortexJobCreateResponse,
  type CortexJobResult,
  type CortexLaunchJobRequest,
  type CortexLaunchJobResponse,
  type CortexJobList,
  type CortexJobKind,
  type CortexJobStatus,
  type CortexRetryJobResponse,
  type CortexJobRunList,
  WorkflowObservabilityRollupSchema,
  WorkflowObservabilityRollupListSchema,
  WorkflowExecutionHealthListSchema,
  DivergenceSchema,
  DivergenceListSchema,
  SavedViewSchema,
  SavedViewListSchema,
  QueryResultSchema,
  ExternalReceiptSchema,
  ExternalReceiptListSchema,
  KbPageSchema,
  KbPageListSchema,
  KbSessionSchema,
  KbSessionListSchema,
  KbMessageSchema,
  KbMessageListSchema,
  NodeTypeSchema,
  NodeTypeListSchema,
  type WorkflowObservabilityRollup,
  type WorkflowExecutionHealth,
  type Divergence,
  type DivergenceKind,
  type DivergenceStatus,
  type SavedView,
  type QueryResult,
  type CreateSavedViewRequest,
  type UpdateSavedViewRequest,
  type RunQueryRequest,
  type ExternalReceipt,
  type ExternalReceiptSource,
  type CreateExternalReceiptRequest,
  type KbPage,
  type KbSession,
  type KbMessage,
  type NodeType,
  type CreateNodeTypeRequest,
} from "../types/index.js";
import { ApiError, AuthenticationError, NetworkError, NotFoundError } from "./errors.js";
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

  async getAgent(id: string): Promise<Agent> {
    const res = await this.request<{ agent: unknown }>(
      "GET",
      `/v1/agents/${encodeURIComponent(id)}`,
    );
    return AgentSchema.parse(res.agent);
  }

  async createAgent(input: {
    name: string;
    project_id: string;
    public_key?: string;
  }): Promise<Agent> {
    const res = await this.request<{ agent: unknown }>("POST", "/v1/agents", {
      body: input,
    });
    return AgentSchema.parse((res as { agent: unknown }).agent ?? res);
  }

  async authMe(): Promise<{
    user: { id: string; email: string };
    organizations: Array<{ id: string; name: string }>;
    projects: Array<{ id: string; org_id: string; name: string }>;
  }> {
    return this.request("GET", "/v1/auth/me");
  }

  async issueCliToken(
    input: { hostname?: string; project_id?: string; expires_in_days?: number } = {},
  ): Promise<{
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

  // ── Operators (canonical) ──

  async meOperator(): Promise<{ operator: Operator }> {
    const res = await this.request<{ operator: unknown }>("GET", "/v1/operators/me");
    return { operator: OperatorSchema.parse(res.operator) };
  }

  async listOperators(
    opts: { project_id?: string; type?: OperatorType } = {},
  ): Promise<Page<Operator>> {
    const res = await this.request<{ data: unknown[]; next_cursor?: string | null }>(
      "GET",
      "/v1/operators",
      { params: { project_id: opts.project_id, operator_type: opts.type } },
    );
    return {
      data: res.data.map((o) => OperatorSchema.parse(o)),
      next_cursor: res.next_cursor ?? null,
    };
  }

  async getOperator(id: string): Promise<Operator> {
    const res = await this.request<{ operator: unknown }>(
      "GET",
      `/v1/operators/${encodeURIComponent(id)}`,
    );
    return OperatorSchema.parse(res.operator);
  }

  async createOperator(input: {
    name: string;
    operator_type: OperatorType;
    project_id: string;
    public_key?: string;
  }): Promise<Operator> {
    const res = await this.request<{ operator: unknown }>("POST", "/v1/operators", {
      body: input,
    });
    return OperatorSchema.parse((res as { operator?: unknown }).operator ?? res);
  }

  // ── Agent sessions ──

  async createAgentSession(input: {
    source: string;
    external_session_id?: string;
    session_type?: string;
    title?: string;
    agent_id?: string;
    operator_id?: string;
    run_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentSession> {
    const res = await this.request<{ session: unknown }>("POST", "/v1/agent-sessions", {
      body: input,
    });
    return AgentSessionSchema.parse((res as { session?: unknown }).session ?? res);
  }

  async listAgentSessions(
    opts: PageOptions & { source?: string; agent_id?: string; operator_id?: string } = {},
  ): Promise<Page<AgentSession>> {
    const res = await this.request<{ data: unknown[]; next_cursor?: string | null }>(
      "GET",
      "/v1/agent-sessions",
      {
        params: {
          cursor: opts.cursor,
          limit: opts.limit,
          source: opts.source,
          agent_id: opts.agent_id,
          operator_id: opts.operator_id,
        },
      },
    );
    return {
      data: res.data.map((s) => AgentSessionSchema.parse(s)),
      next_cursor: res.next_cursor ?? null,
    };
  }

  async getAgentSession(id: string): Promise<AgentSession> {
    const res = await this.request<{ session: unknown }>(
      "GET",
      `/v1/agent-sessions/${encodeURIComponent(id)}`,
    );
    return AgentSessionSchema.parse(res.session);
  }

  async updateAgentSession(id: string, patch: Record<string, unknown>): Promise<AgentSession> {
    const res = await this.request<{ session: unknown }>(
      "PATCH",
      `/v1/agent-sessions/${encodeURIComponent(id)}`,
      { body: patch },
    );
    return AgentSessionSchema.parse(res.session);
  }

  async writeAgentSessionEvents(id: string, events: Record<string, unknown>[]): Promise<unknown> {
    return this.request("POST", `/v1/agent-sessions/${encodeURIComponent(id)}/events`, {
      body: events,
    });
  }

  // ── Cases (workflow instances) ──

  async createCase(input: {
    id?: string;
    workflow_key: string;
    tenant_id?: string;
    end_user_id?: string;
    owner?: string;
    custom_attrs?: Record<string, unknown>;
    tags?: string[];
    opened_at?: string;
  }): Promise<Case> {
    const res = await this.request<{ case: unknown }>("POST", "/v1/cases", { body: input });
    return CaseSchema.parse(res.case);
  }

  async listCases(
    opts: PageOptions & {
      tenant_id?: string;
      end_user_id?: string;
      workflow_key?: string;
      status?: CaseStatus;
      outcome?: string;
      tags?: string;
    } = {},
  ): Promise<Page<Case>> {
    return this.parsed(CaseListSchema, "GET", "/v1/cases", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        tenant_id: opts.tenant_id,
        end_user_id: opts.end_user_id,
        workflow_key: opts.workflow_key,
        status: opts.status,
        outcome: opts.outcome,
        tags: opts.tags,
      },
    });
  }

  async getCase(id: string): Promise<unknown> {
    // Returns CaseWithRuns — schema-parsed as a plain object since the runs
    // array is large enough that a tight schema adds little value at the CLI.
    const res = await this.request<{ case: unknown }>("GET", `/v1/cases/${encodeURIComponent(id)}`);
    return res.case;
  }

  async updateCase(id: string, patch: Record<string, unknown>): Promise<Case> {
    const res = await this.request<{ case: unknown }>(
      "PATCH",
      `/v1/cases/${encodeURIComponent(id)}`,
      { body: patch },
    );
    return CaseSchema.parse(res.case);
  }

  async caseEvidence(id: string): Promise<unknown> {
    return this.request("GET", `/v1/cases/${encodeURIComponent(id)}/evidence`);
  }

  async createCaseEvent(id: string, body: Record<string, unknown>): Promise<WorkflowEvent> {
    const res = await this.request<{ event: unknown }>(
      "POST",
      `/v1/cases/${encodeURIComponent(id)}/events`,
      { body },
    );
    return WorkflowEventSchema.parse(res.event);
  }

  async listCaseEvents(id: string, opts: PageOptions = {}): Promise<Page<WorkflowEvent>> {
    return this.parsed(
      WorkflowEventListSchema,
      "GET",
      `/v1/cases/${encodeURIComponent(id)}/events`,
      {
        params: { cursor: opts.cursor, limit: opts.limit },
      },
    );
  }

  async listWorkflowEvents(
    opts: PageOptions & {
      case_id?: string;
      tenant_id?: string;
      end_user_id?: string;
      workflow_key?: string;
      type?: string;
      actor_type?: WorkflowEventActorType;
      actor_id?: string;
      from?: string;
      to?: string;
    } = {},
  ): Promise<Page<WorkflowEvent>> {
    return this.parsed(WorkflowEventListSchema, "GET", "/v1/events", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        case_id: opts.case_id,
        tenant_id: opts.tenant_id,
        end_user_id: opts.end_user_id,
        workflow_key: opts.workflow_key,
        type: opts.type,
        actor_type: opts.actor_type,
        actor_id: opts.actor_id,
        from: opts.from,
        to: opts.to,
      },
    });
  }

  async createWorkflowDefinition(input: Record<string, unknown>): Promise<WorkflowDefinition> {
    const res = await this.request<{ definition: unknown }>("POST", "/v1/workflow-definitions", {
      body: input,
    });
    return WorkflowDefinitionSchema.parse(res.definition);
  }

  async listWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
    const res = await this.request<{ data: unknown[] }>("GET", "/v1/workflow-definitions");
    return res.data.map((d) => WorkflowDefinitionSchema.parse(d));
  }

  async getWorkflowDefinition(key: string): Promise<WorkflowDefinition> {
    const res = await this.request<{ definition: unknown }>(
      "GET",
      `/v1/workflow-definitions/${encodeURIComponent(key)}`,
    );
    return WorkflowDefinitionSchema.parse(res.definition);
  }

  async updateWorkflowDefinition(
    key: string,
    patch: Record<string, unknown>,
  ): Promise<WorkflowDefinition> {
    const res = await this.request<{ definition: unknown }>(
      "PATCH",
      `/v1/workflow-definitions/${encodeURIComponent(key)}`,
      { body: patch },
    );
    return WorkflowDefinitionSchema.parse(res.definition);
  }

  async deleteWorkflowDefinition(key: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/workflow-definitions/${encodeURIComponent(key)}`);
  }

  // ── Runs ──

  async startRun(input: {
    name?: string;
    metadata?: Record<string, unknown>;
    case_id?: string;
    tenant_id?: string;
    end_user_id?: string;
  }): Promise<Run> {
    const res = await this.request<{ run: unknown }>("POST", "/v1/runs", { body: input });
    return RunSchema.parse(res.run);
  }

  async listRuns(opts: PageOptions & { eval_suite?: string } = {}): Promise<Page<Run>> {
    return this.parsed(RunListSchema, "GET", "/v1/runs", {
      params: { cursor: opts.cursor, limit: opts.limit, eval_suite: opts.eval_suite },
    });
  }

  async getRun(id: string): Promise<Run> {
    const res = await this.request<{ run: unknown }>("GET", `/v1/runs/${encodeURIComponent(id)}`);
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

  async listFindings(opts: PageOptions & { run_id?: string } = {}): Promise<Page<Finding>> {
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

  async resolveReview(id: string, decision: ReviewDecision, notes?: string): Promise<Review> {
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

  // ── Evals: datasets ──

  async createEvalDataset(input: {
    name: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<EvalDataset> {
    const res = await this.request<{ dataset: EvalDataset }>("POST", "/v1/eval-datasets", {
      body: input,
    });
    return res.dataset;
  }

  async listEvalDatasets(opts: PageOptions = {}): Promise<Page<EvalDataset>> {
    return this.request<Page<EvalDataset>>("GET", "/v1/eval-datasets", {
      params: { cursor: opts.cursor, limit: opts.limit },
    });
  }

  async getEvalDataset(id: string): Promise<EvalDataset> {
    const res = await this.request<{ dataset: EvalDataset }>(
      "GET",
      `/v1/eval-datasets/${encodeURIComponent(id)}`,
    );
    return res.dataset;
  }

  async appendEvalDatasetExample(
    id: string,
    body: {
      input: Record<string, unknown>;
      expected?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ): Promise<EvalDatasetExample> {
    const res = await this.request<{ example: EvalDatasetExample }>(
      "POST",
      `/v1/eval-datasets/${encodeURIComponent(id)}/examples`,
      { body },
    );
    return res.example;
  }

  // ── Evals: scorers ──

  async createEvalScorer(input: {
    name: string;
    description?: string;
    kind: "assertion" | "code" | "llm" | "builtin";
    definition?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<EvalScorer> {
    const res = await this.request<{ scorer: EvalScorer }>("POST", "/v1/eval-scorers", {
      body: input,
    });
    return res.scorer;
  }

  async listEvalScorers(opts: PageOptions = {}): Promise<Page<EvalScorer>> {
    return this.request<Page<EvalScorer>>("GET", "/v1/eval-scorers", {
      params: { cursor: opts.cursor, limit: opts.limit },
    });
  }

  // ── Evals: experiment / compare ──

  async runEvalSuite(
    suiteId: string,
    body: {
      scorer_specs?: ScorerSpec[];
      baseline_run_id?: string | null;
    } = {},
  ): Promise<EvalRunRecord> {
    const res = await this.request<{ eval_run: EvalRunRecord }>(
      "POST",
      `/v1/eval-suites/${encodeURIComponent(suiteId)}/run`,
      { body },
    );
    return res.eval_run;
  }

  async runEvalExperiment(
    evalRunId: string,
    body: {
      scorer_specs: ScorerSpec[];
      baseline_run_id?: string | null;
    },
  ): Promise<EvalRunRecord> {
    const res = await this.request<{ eval_run: EvalRunRecord }>(
      "POST",
      `/v1/eval-runs/${encodeURIComponent(evalRunId)}/experiment`,
      { body },
    );
    return res.eval_run;
  }

  async compareEvalRuns(runId: string, baselineRunId: string): Promise<CompareResponse> {
    const res = await this.request<{ comparison: CompareResponse }>(
      "GET",
      `/v1/eval-runs/${encodeURIComponent(runId)}/compare`,
      { params: { baseline: baselineRunId } },
    );
    return res.comparison;
  }

  async getEvalRun(id: string): Promise<EvalRunRecord> {
    const res = await this.request<{ eval_run: EvalRunRecord }>(
      "GET",
      `/v1/eval-runs/${encodeURIComponent(id)}`,
    );
    return res.eval_run;
  }

  async listEvalResults(id: string, opts: PageOptions = {}): Promise<Page<EvalResultRecord>> {
    return this.request<Page<EvalResultRecord>>(
      "GET",
      `/v1/eval-runs/${encodeURIComponent(id)}/results`,
      { params: { cursor: opts.cursor, limit: opts.limit } },
    );
  }

  // ── Metrics ──

  async metricsOverview(
    params: {
      window_hours?: number;
    } = {},
  ): Promise<unknown> {
    return this.request("GET", "/v1/metrics/overview", { params });
  }

  async metricsAgents(
    params: {
      window_hours?: number;
    } = {},
  ): Promise<unknown> {
    return this.request("GET", "/v1/metrics/agents", { params });
  }

  // ── Recipes ──

  async listRecipes(opts: PageOptions = {}): Promise<Page<Recipe>> {
    return this.parsed(RecipeListSchema, "GET", "/v1/recipes", {
      params: { cursor: opts.cursor, limit: opts.limit },
    });
  }

  async getRecipe(idOrSlug: string): Promise<Recipe> {
    const res = await this.request<{ recipe: unknown }>(
      "GET",
      `/v1/recipes/${encodeURIComponent(idOrSlug)}`,
    );
    return RecipeSchema.parse(res.recipe);
  }

  async updateRecipe(
    id: string,
    patch: { enabled?: boolean; default_mode?: GuardrailMode },
  ): Promise<Recipe> {
    const res = await this.request<{ recipe: unknown }>(
      "PATCH",
      `/v1/recipes/${encodeURIComponent(id)}`,
      { body: patch },
    );
    return RecipeSchema.parse(res.recipe);
  }

  // ── Guardrails ──

  async listGuardrails(
    opts: PageOptions & { status?: GuardrailStatus; recipe_id?: string } = {},
  ): Promise<Page<Guardrail>> {
    return this.parsed(GuardrailListSchema, "GET", "/v1/guardrails", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        status: opts.status,
        recipe_id: opts.recipe_id,
      },
    });
  }

  async getGuardrail(id: string): Promise<Guardrail> {
    const res = await this.request<{ guardrail: unknown }>(
      "GET",
      `/v1/guardrails/${encodeURIComponent(id)}`,
    );
    return GuardrailSchema.parse(res.guardrail);
  }

  async createGuardrail(input: {
    title: string;
    recipe_id?: string | null;
    finding_id?: string | null;
    rule?: string;
    mode?: GuardrailMode;
    status?: GuardrailStatus;
    agent_id?: string;
  }): Promise<Guardrail> {
    const res = await this.request<{ guardrail: unknown }>("POST", "/v1/guardrails", {
      body: input,
    });
    return GuardrailSchema.parse(res.guardrail);
  }

  async promoteGuardrail(id: string, to: GuardrailStatus): Promise<Guardrail> {
    const res = await this.request<{ guardrail: unknown }>(
      "POST",
      `/v1/guardrails/${encodeURIComponent(id)}/promote`,
      { body: { to } },
    );
    return GuardrailSchema.parse(res.guardrail);
  }

  // ── Captures ──

  async createCapture(input: {
    source: string;
    session_type?: string;
    title?: string;
    occurred_at?: string;
    run_id?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): Promise<AgentSession> {
    const res = await this.request<{ session: unknown }>("POST", "/v1/captures", { body: input });
    return AgentSessionSchema.parse(
      (res as { session?: unknown }).session ?? res,
    );
  }

  async listCaptures(
    opts: PageOptions & {
      project_id?: string;
      operator_id?: string;
      session_type?: string;
      source?: string;
      run_id?: string;
      tags?: string;
    } = {},
  ): Promise<Page<AgentSession>> {
    const res = await this.request<{ data: unknown[]; next_cursor?: string | null }>(
      "GET",
      "/v1/captures",
      {
        params: {
          cursor: opts.cursor,
          limit: opts.limit,
          project_id: opts.project_id,
          operator_id: opts.operator_id,
          session_type: opts.session_type,
          source: opts.source,
          run_id: opts.run_id,
          tags: opts.tags,
        },
      },
    );
    return {
      data: res.data.map((s) => AgentSessionSchema.parse(s)),
      next_cursor: res.next_cursor ?? null,
    };
  }

  async getCapture(id: string): Promise<AgentSession> {
    const res = await this.request<{ session: unknown }>(
      "GET",
      `/v1/captures/${encodeURIComponent(id)}`,
    );
    return AgentSessionSchema.parse(res.session);
  }

  async updateCapture(id: string, patch: Record<string, unknown>): Promise<AgentSession> {
    const res = await this.request<{ session: unknown }>(
      "PATCH",
      `/v1/captures/${encodeURIComponent(id)}`,
      { body: patch },
    );
    return AgentSessionSchema.parse(res.session);
  }

  // Create a capture link against any evidence-graph target. Accepts the
  // polymorphic target_type/target_id form (target_type defaults to 'run'
  // server-side) plus an optional link_type/metadata.
  async createCaptureLink(
    id: string,
    input: {
      target_type?: string;
      target_id?: string;
      run_id?: string;
      case_id?: string;
      workflow_event_id?: string;
      node_id?: string;
      link_type?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<unknown> {
    const res = await this.request<{ link: unknown }>(
      "POST",
      `/v1/captures/${encodeURIComponent(id)}/links`,
      { body: input },
    );
    return (res as { link?: unknown }).link ?? res;
  }

  async listCaptureLinks(id: string): Promise<unknown[]> {
    const res = await this.request<{ links: unknown[] }>(
      "GET",
      `/v1/captures/${encodeURIComponent(id)}/links`,
    );
    return res.links ?? [];
  }

  async deleteCaptureLink(id: string, linkId: string): Promise<void> {
    await this.request<void>(
      "DELETE",
      `/v1/captures/${encodeURIComponent(id)}/links/${encodeURIComponent(linkId)}`,
    );
  }

  // ── DNA ──

  async listDnaEntities(
    opts: PageOptions & { run_id?: string; kind?: string; q?: string } = {},
  ): Promise<Page<DnaEntity>> {
    return this.parsed(DnaEntityListSchema, "GET", "/v1/dna/entities", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        run_id: opts.run_id,
        kind: opts.kind,
        q: opts.q,
      },
    });
  }

  async listDnaObjects(
    opts: PageOptions & { project_id?: string; kind?: string; q?: string } = {},
  ): Promise<Page<DnaObject>> {
    return this.parsed(DnaObjectListSchema, "GET", "/v1/dna/objects", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        project_id: opts.project_id,
        kind: opts.kind,
        q: opts.q,
      },
    });
  }

  async listDnaObjectMentions(
    opts: PageOptions & {
      project_id?: string;
      event_id?: string;
      chunk_id?: string;
      object_id?: string;
      mention_type?: string;
    } = {},
  ): Promise<Page<DnaObjectMention>> {
    return this.parsed(DnaObjectMentionListSchema, "GET", "/v1/dna/object-mentions", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        project_id: opts.project_id,
        event_id: opts.event_id,
        chunk_id: opts.chunk_id,
        object_id: opts.object_id,
        mention_type: opts.mention_type,
      },
    });
  }

  async listDnaEdges(
    opts: PageOptions & { run_id?: string; kind?: string; entity_id?: string } = {},
  ): Promise<Page<DnaEdge>> {
    return this.parsed(DnaEdgeListSchema, "GET", "/v1/dna/edges", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        run_id: opts.run_id,
        kind: opts.kind,
        entity_id: opts.entity_id,
      },
    });
  }

  async explainDnaEdge(id: string): Promise<DnaEdgeExplain> {
    return this.parsed(
      DnaEdgeExplainSchema,
      "GET",
      `/v1/dna/edges/${encodeURIComponent(id)}/explain`,
    );
  }

  async queryDna(input: {
    q: string;
    kinds?: string[];
    run_id?: string;
    include_edges?: boolean;
    limit?: number;
  }): Promise<DnaQueryResponse> {
    return this.parsed(DnaQueryResponseSchema, "POST", "/v1/dna/query", {
      body: input,
    });
  }

  async listDnaEdgeCandidates(
    opts: PageOptions & {
      project_id?: string;
      object_id?: string;
      relation_kind?: string;
      status?: DnaEdgeCandidate["status"];
    } = {},
  ): Promise<Page<DnaEdgeCandidate>> {
    return this.parsed(DnaEdgeCandidateListSchema, "GET", "/v1/dna/edge-candidates", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        project_id: opts.project_id,
        object_id: opts.object_id,
        relation_kind: opts.relation_kind,
        status: opts.status,
      },
    });
  }

  async acceptDnaEdgeCandidate(id: string): Promise<DnaEdgeCandidate> {
    const res = await this.request<{ candidate: unknown }>(
      "POST",
      `/v1/dna/edge-candidates/${encodeURIComponent(id)}/accept`,
      { body: {} },
    );
    return DnaEdgeCandidateSchema.parse(res.candidate);
  }

  async rejectDnaEdgeCandidate(id: string): Promise<DnaEdgeCandidate> {
    const res = await this.request<{ candidate: unknown }>(
      "POST",
      `/v1/dna/edge-candidates/${encodeURIComponent(id)}/reject`,
      { body: {} },
    );
    return DnaEdgeCandidateSchema.parse(res.candidate);
  }

  async promoteDnaEdgeCandidate(
    id: string,
    opts: { dryRun?: boolean } = {},
  ): Promise<DnaPromoteResponse> {
    return this.parsed(
      DnaPromoteResponseSchema,
      "POST",
      `/v1/dna/edge-candidates/${encodeURIComponent(id)}/promote`,
      { body: { dry_run: opts.dryRun === true } },
    );
  }

  // ── Cortex jobs (generic evals, counterfactuals, attribution) ──

  async createCortexJob(input: CortexJobCreateRequest): Promise<CortexJobCreateResponse> {
    return this.parsed(CortexJobCreateResponseSchema, "POST", "/v1/cortex/jobs", {
      body: input,
    });
  }

  async getCortexJob(id: string): Promise<CortexJob> {
    const res = await this.request<{ job: unknown } | unknown>(
      "GET",
      `/v1/cortex/jobs/${encodeURIComponent(id)}`,
    );
    const job =
      res && typeof res === "object" && "job" in (res as Record<string, unknown>)
        ? (res as { job: unknown }).job
        : res;
    return CortexJobSchema.parse(job);
  }

  async getCortexJobResult(id: string): Promise<CortexJobResult> {
    return this.parsed(
      CortexJobResultSchema,
      "GET",
      `/v1/cortex/jobs/${encodeURIComponent(id)}/result`,
    );
  }

  // ── Cortex governed launcher (launch / list / retry / runs) ──

  /**
   * Launch a Cortex job through the governed launcher. With `mode: "sync"` the
   * call blocks and returns the parsed `result`; with `mode: "async"` it enqueues
   * and returns the queued job — poll {@link getCortexJobResult}. This is the path
   * the read-only `complex_query` analyst requires.
   */
  async launchCortexJob(input: CortexLaunchJobRequest): Promise<CortexLaunchJobResponse> {
    return this.parsed(CortexLaunchJobResponseSchema, "POST", "/v1/cortex/jobs/launch", {
      body: input,
    });
  }

  /** List Cortex jobs, newest first. Filter by `status` / `kind`. */
  async listCortexJobs(
    opts: PageOptions & { status?: CortexJobStatus; kind?: CortexJobKind } = {},
  ): Promise<CortexJobList> {
    return this.parsed(CortexJobListSchema, "GET", "/v1/cortex/jobs", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        status: opts.status,
        kind: opts.kind,
      },
    });
  }

  /** Re-queue a failed/dead job for one more attempt. */
  async retryCortexJob(id: string): Promise<CortexRetryJobResponse> {
    return this.parsed(
      CortexRetryJobResponseSchema,
      "POST",
      `/v1/cortex/jobs/${encodeURIComponent(id)}/retry`,
    );
  }

  /** List the attempt history (audit-trail runs) for a job. */
  async listCortexJobRuns(id: string): Promise<CortexJobRunList> {
    return this.parsed(
      CortexJobRunListSchema,
      "GET",
      `/v1/cortex/jobs/${encodeURIComponent(id)}/runs`,
    );
  }

  // ── Workflow observability (read-only rollups) ──

  async listWorkflowObservability(): Promise<Page<WorkflowObservabilityRollup>> {
    return this.parsed(
      WorkflowObservabilityRollupListSchema,
      "GET",
      "/v1/workflow-observability",
    );
  }

  async getWorkflowObservability(workflowKey: string): Promise<WorkflowObservabilityRollup> {
    const res = await this.request<{ rollup: unknown }>(
      "GET",
      `/v1/workflow-observability/${encodeURIComponent(workflowKey)}`,
    );
    return WorkflowObservabilityRollupSchema.parse(res.rollup);
  }

  async listWorkflowExecutions(workflowKey: string): Promise<Page<WorkflowExecutionHealth>> {
    return this.parsed(
      WorkflowExecutionHealthListSchema,
      "GET",
      `/v1/workflow-observability/${encodeURIComponent(workflowKey)}/executions`,
    );
  }

  // ── Divergences (run-level deviations) ──

  async listDivergences(
    opts: PageOptions & {
      run_id?: string;
      kind?: DivergenceKind;
      severity?: Severity;
      status?: DivergenceStatus;
    } = {},
  ): Promise<Page<Divergence>> {
    return this.parsed(DivergenceListSchema, "GET", "/v1/divergences", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        run_id: opts.run_id,
        kind: opts.kind,
        severity: opts.severity,
        status: opts.status,
      },
    });
  }

  async getDivergence(id: string): Promise<Divergence> {
    const res = await this.request<{ divergence: unknown }>(
      "GET",
      `/v1/divergences/${encodeURIComponent(id)}`,
    );
    return DivergenceSchema.parse(res.divergence);
  }

  async updateDivergence(id: string, status: DivergenceStatus): Promise<Divergence> {
    const res = await this.request<{ divergence: unknown }>(
      "PATCH",
      `/v1/divergences/${encodeURIComponent(id)}`,
      { body: { status } },
    );
    return DivergenceSchema.parse(res.divergence);
  }

  // ── Saved views (dashboard queries) ──

  async listSavedViews(): Promise<Page<SavedView>> {
    return this.parsed(SavedViewListSchema, "GET", "/v1/saved-views");
  }

  async createSavedView(body: CreateSavedViewRequest): Promise<SavedView> {
    const res = await this.request<{ view: unknown }>("POST", "/v1/saved-views", { body });
    return SavedViewSchema.parse(res.view);
  }

  async getSavedView(id: string): Promise<SavedView> {
    const res = await this.request<{ view: unknown }>(
      "GET",
      `/v1/saved-views/${encodeURIComponent(id)}`,
    );
    return SavedViewSchema.parse(res.view);
  }

  async updateSavedView(id: string, patch: UpdateSavedViewRequest): Promise<SavedView> {
    const res = await this.request<{ view: unknown }>(
      "PATCH",
      `/v1/saved-views/${encodeURIComponent(id)}`,
      { body: patch },
    );
    return SavedViewSchema.parse(res.view);
  }

  async deleteSavedView(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/saved-views/${encodeURIComponent(id)}`);
  }

  /**
   * Run a saved view or an ad-hoc query. `body` must specify EXACTLY ONE of
   * `{ saved_view_id }` or `{ source, spec }`; this is validated client-side.
   */
  async runSavedView(body: RunQueryRequest): Promise<QueryResult> {
    const hasId = "saved_view_id" in body && body.saved_view_id !== undefined;
    const hasSpec = "source" in body && body.source !== undefined;
    if (hasId === hasSpec) {
      throw new Error(
        "runSavedView requires exactly one of { saved_view_id } or { source, spec }.",
      );
    }
    const res = await this.request<{ result: unknown }>("POST", "/v1/saved-views/run", { body });
    return QueryResultSchema.parse(res.result);
  }

  // ── External receipts (writes require an agent API key) ──

  async createReceipt(body: CreateExternalReceiptRequest): Promise<ExternalReceipt> {
    const res = await this.request<{ receipt: unknown }>("POST", "/v1/receipts", { body });
    return ExternalReceiptSchema.parse(res.receipt);
  }

  async createReceiptsBatch(
    receipts: CreateExternalReceiptRequest[],
  ): Promise<ExternalReceipt[]> {
    const res = await this.request<{ receipts: unknown[] }>("POST", "/v1/receipts/batch", {
      body: { receipts },
    });
    return res.receipts.map((r) => ExternalReceiptSchema.parse(r));
  }

  async listReceipts(
    opts: PageOptions & {
      run_id?: string;
      node_id?: string;
      source?: ExternalReceiptSource;
      kind?: string;
      external_id?: string;
      business_object_type?: string;
      business_object_id?: string;
    } = {},
  ): Promise<Page<ExternalReceipt>> {
    return this.parsed(ExternalReceiptListSchema, "GET", "/v1/receipts", {
      params: {
        cursor: opts.cursor,
        limit: opts.limit,
        run_id: opts.run_id,
        node_id: opts.node_id,
        source: opts.source,
        kind: opts.kind,
        external_id: opts.external_id,
        business_object_type: opts.business_object_type,
        business_object_id: opts.business_object_id,
      },
    });
  }

  async getReceipt(id: string): Promise<ExternalReceipt> {
    const res = await this.request<{ receipt: unknown }>(
      "GET",
      `/v1/receipts/${encodeURIComponent(id)}`,
    );
    return ExternalReceiptSchema.parse(res.receipt);
  }

  // ── Knowledge base: pages ──

  async listKbPages(opts: PageOptions & { q?: string; tag?: string } = {}): Promise<Page<KbPage>> {
    return this.parsed(KbPageListSchema, "GET", "/v1/kb/pages", {
      params: { cursor: opts.cursor, limit: opts.limit, q: opts.q, tag: opts.tag },
    });
  }

  async getKbPage(id: string): Promise<KbPage> {
    const res = await this.request<{ page: unknown }>(
      "GET",
      `/v1/kb/pages/${encodeURIComponent(id)}`,
    );
    return KbPageSchema.parse(res.page);
  }

  async createKbPage(body: {
    title: string;
    content: string;
    slug?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<KbPage> {
    const res = await this.request<{ page: unknown }>("POST", "/v1/kb/pages", { body });
    return KbPageSchema.parse(res.page);
  }

  async updateKbPage(id: string, patch: Record<string, unknown>): Promise<KbPage> {
    const res = await this.request<{ page: unknown }>(
      "PATCH",
      `/v1/kb/pages/${encodeURIComponent(id)}`,
      { body: patch },
    );
    return KbPageSchema.parse(res.page);
  }

  async deleteKbPage(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/kb/pages/${encodeURIComponent(id)}`);
  }

  // ── Knowledge base: sessions + messages ──

  async createKbSession(body: {
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KbSession> {
    const res = await this.request<{ session: unknown }>("POST", "/v1/kb/sessions", { body });
    return KbSessionSchema.parse(res.session);
  }

  async listKbSessions(opts: PageOptions = {}): Promise<Page<KbSession>> {
    return this.parsed(KbSessionListSchema, "GET", "/v1/kb/sessions", {
      params: { cursor: opts.cursor, limit: opts.limit },
    });
  }

  async getKbSession(id: string): Promise<KbSession> {
    const res = await this.request<{ session: unknown }>(
      "GET",
      `/v1/kb/sessions/${encodeURIComponent(id)}`,
    );
    return KbSessionSchema.parse(res.session);
  }

  async deleteKbSession(id: string): Promise<void> {
    await this.request<void>("DELETE", `/v1/kb/sessions/${encodeURIComponent(id)}`);
  }

  async listKbMessages(id: string, opts: PageOptions = {}): Promise<Page<KbMessage>> {
    return this.parsed(
      KbMessageListSchema,
      "GET",
      `/v1/kb/sessions/${encodeURIComponent(id)}/messages`,
      { params: { cursor: opts.cursor, limit: opts.limit } },
    );
  }

  async appendKbMessage(
    id: string,
    body: { role: string; content: string; metadata?: Record<string, unknown> },
  ): Promise<KbMessage> {
    const res = await this.request<{ message: unknown }>(
      "POST",
      `/v1/kb/sessions/${encodeURIComponent(id)}/messages`,
      { body },
    );
    return KbMessageSchema.parse(res.message);
  }

  // ── Ask (POST /v1/ask; response returned as-is; requires an agent API key) ──

  async ask(body: {
    message: string;
    session_id?: string;
    model?: string;
  }): Promise<unknown> {
    return this.request("POST", "/v1/ask", { body });
  }

  // ── Node types (custom node-type registry) ──

  async listNodeTypes(): Promise<Page<NodeType>> {
    return this.parsed(NodeTypeListSchema, "GET", "/v1/node-types");
  }

  async registerNodeType(body: CreateNodeTypeRequest): Promise<NodeType> {
    const res = await this.request<{ node_type: unknown }>("POST", "/v1/node-types", { body });
    return NodeTypeSchema.parse((res as { node_type?: unknown }).node_type ?? res);
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
