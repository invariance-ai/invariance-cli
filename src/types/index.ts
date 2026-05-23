import { z } from "zod";

// ── Core scalars ──

export const SeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const RunStatusSchema = z.enum(["open", "completed", "failed"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

// ── Agents (`/v1/agents/me`) ──

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  public_key: z.string().nullable(),
  project_id: z.string(),
  created_at: z.string(),
});
export type Agent = z.infer<typeof AgentSchema>;

export const ApiKeyPublicSchema = z.object({
  id: z.string(),
  prefix: z.enum(["inv_test", "inv_live"]),
  label: z.string(),
  created_at: z.string(),
});
export type ApiKeyPublic = z.infer<typeof ApiKeyPublicSchema>;

export const MeSchema = z.object({
  agent: AgentSchema,
  api_key: ApiKeyPublicSchema.optional(),
});
export type Me = z.infer<typeof MeSchema>;

// ── Operators (canonical superset of agents) ──

export const OperatorTypeSchema = z.enum(["agent", "human"]);
export type OperatorType = z.infer<typeof OperatorTypeSchema>;

export const OperatorSchema = z.object({
  id: z.string(),
  name: z.string(),
  operator_type: OperatorTypeSchema,
  public_key: z.string().nullable().optional(),
  project_id: z.string(),
  created_at: z.string(),
});
export type Operator = z.infer<typeof OperatorSchema>;

// ── Agent sessions ──

export const AgentSessionSourceSchema = z.enum([
  "claude_code",
  "openai_codex",
  "cursor",
  "screen_recording",
  "microphone",
  "meeting",
  "granola_note",
  "manual_note",
  "api",
  "cli",
  "other",
]);
export type AgentSessionSource = z.infer<typeof AgentSessionSourceSchema>;

export const AgentSessionSchema = z.object({
  id: z.string(),
  agent_id: z.string().nullable().optional(),
  operator_id: z.string().nullable().optional(),
  run_id: z.string().nullable().optional(),
  source: z.string(),
  session_type: z.string().nullable().optional(),
  external_session_id: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});
export type AgentSession = z.infer<typeof AgentSessionSchema>;

// ── Cases (workflow instances) ──

export const CaseStatusSchema = z.enum(["open", "closed"]);
export type CaseStatus = z.infer<typeof CaseStatusSchema>;

export const CaseSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  tenant_id: z.string().nullable(),
  end_user_id: z.string().nullable(),
  workflow_key: z.string(),
  status: CaseStatusSchema,
  outcome: z.string().nullable(),
  outcome_value_usd: z.number().nullable(),
  owner: z.string().nullable(),
  custom_attrs: z.record(z.string(), z.unknown()),
  tags: z.array(z.string()).nullable().optional(),
  opened_at: z.string(),
  closed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Case = z.infer<typeof CaseSchema>;

// ── Workflow events / definitions ──

export const WorkflowEventActorTypeSchema = z.enum([
  "human",
  "agent",
  "llm",
  "service",
  "integration",
  "policy",
  "system",
]);
export type WorkflowEventActorType = z.infer<typeof WorkflowEventActorTypeSchema>;

export const EvidenceRefKindSchema = z.enum([
  "run",
  "node",
  "ticket",
  "doc",
  "slack",
  "github",
  "meeting",
  "url",
  "external",
]);
export type EvidenceRefKind = z.infer<typeof EvidenceRefKindSchema>;

export const WorkflowEvidenceRefSchema = z.object({
  kind: EvidenceRefKindSchema,
  id: z.string().optional(),
  url: z.string().optional(),
  label: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type WorkflowEvidenceRef = z.infer<typeof WorkflowEvidenceRefSchema>;

export const WorkflowEventSchema = z.object({
  id: z.string(),
  case_id: z.string(),
  agent_id: z.string(),
  tenant_id: z.string().nullable(),
  end_user_id: z.string().nullable(),
  type: z.string(),
  actor_type: WorkflowEventActorTypeSchema.nullable(),
  actor_id: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  evidence_node_ids: z.array(z.string()),
  evidence_refs: z.array(WorkflowEvidenceRefSchema),
  idempotency_key: z.string().nullable().optional(),
  occurred_at: z.string(),
  created_at: z.string(),
});
export type WorkflowEvent = z.infer<typeof WorkflowEventSchema>;

export const WorkflowFieldTypeSchema = z.enum([
  "string",
  "number",
  "boolean",
  "datetime",
  "url",
  "currency_usd",
  "enum",
]);
export type WorkflowFieldType = z.infer<typeof WorkflowFieldTypeSchema>;

export const WorkflowDefinitionFieldSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  type: WorkflowFieldTypeSchema,
  required: z.boolean().optional(),
  enum: z.array(z.string()).optional(),
  description: z.string().optional(),
});
export type WorkflowDefinitionField = z.infer<typeof WorkflowDefinitionFieldSchema>;

export const WorkflowDefinitionStepSchema = z.object({
  type: z.string(),
  label: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().optional(),
});
export type WorkflowDefinitionStep = z.infer<typeof WorkflowDefinitionStepSchema>;

export const WorkflowOutcomeKindSchema = z.enum(["success", "failure", "neutral"]);
export type WorkflowOutcomeKind = z.infer<typeof WorkflowOutcomeKindSchema>;

export const WorkflowDefinitionOutcomeSchema = z.object({
  value: z.string(),
  label: z.string().optional(),
  kind: WorkflowOutcomeKindSchema.optional(),
});
export type WorkflowDefinitionOutcome = z.infer<typeof WorkflowDefinitionOutcomeSchema>;

export const WorkflowMetricWidgetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("count"), label: z.string(), event_type: z.string().optional() }),
  z.object({ kind: z.literal("sum_field"), label: z.string(), field: z.string() }),
  z.object({ kind: z.literal("avg_field"), label: z.string(), field: z.string() }),
]);
export type WorkflowMetricWidget = z.infer<typeof WorkflowMetricWidgetSchema>;

export const WorkflowDefinitionSchema = z.object({
  key: z.string(),
  agent_id: z.string(),
  display_name: z.string(),
  description: z.string().nullable(),
  expected_fields: z.array(WorkflowDefinitionFieldSchema),
  expected_steps: z.array(WorkflowDefinitionStepSchema),
  allowed_outcomes: z.array(WorkflowDefinitionOutcomeSchema),
  custom_metrics: z.array(WorkflowMetricWidgetSchema),
  created_at: z.string(),
  updated_at: z.string(),
});
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// ── Pagination wrapper (backend emits `data` + `next_cursor`) ──

export const ListSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    next_cursor: z.string().nullable().optional(),
  });

// ── Runs ──

export const RunSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  name: z.string(),
  status: RunStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  parent_run_id: z.string().nullable().optional(),
  fork_point_node_id: z.string().nullable().optional(),
  replay_seed: z.string().nullable().optional(),
  case_id: z.string().nullable().optional(),
  tenant_id: z.string().nullable().optional(),
  end_user_id: z.string().nullable().optional(),
  total_input_tokens: z.number().optional(),
  total_output_tokens: z.number().optional(),
  total_cache_read: z.number().optional(),
  total_cache_write: z.number().optional(),
  total_cost_usd: z.number().optional(),
  llm_call_count: z.number().optional(),
  tool_call_count: z.number().optional(),
  error_count: z.number().optional(),
  total_latency_ms: z.number().optional(),
});
export type Run = z.infer<typeof RunSchema>;
export const RunListSchema = ListSchema(RunSchema);
export const CaseListSchema = ListSchema(CaseSchema);
export const WorkflowEventListSchema = ListSchema(WorkflowEventSchema);

// ── Nodes ──

export const NodeSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  agent_id: z.string(),
  parent_id: z.string().nullable(),
  action_type: z.string(),
  type: z.string().nullable(),
  input: z.unknown(),
  output: z.unknown(),
  error: z.unknown(),
  metadata: z.record(z.string(), z.unknown()),
  custom_fields: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
  duration_ms: z.number().nullable(),
  hash: z.string(),
  previous_hashes: z.array(z.string()),
  signature: z.string().nullable(),
  created_at: z.string(),
  handoff_from: z.string().nullable().optional(),
  handoff_to: z.string().nullable().optional(),
  handoff_reason: z.string().nullable().optional(),
  case_id: z.string().nullable().optional(),
  tenant_id: z.string().nullable().optional(),
  end_user_id: z.string().nullable().optional(),
});
export type Node = z.infer<typeof NodeSchema>;
export const NodeListSchema = ListSchema(NodeSchema);

// ── Run proof ──

export const RunProofSchema = z.object({
  run_id: z.string(),
  valid: z.boolean(),
  node_count: z.number(),
  head_hash: z.string().nullable(),
  first_invalid_node_id: z.string().nullable(),
  reason: z.enum(["linkage", "hash", "signature", "missing_key"]).nullable(),
});
export type RunProof = z.infer<typeof RunProofSchema>;

// ── Monitors ──

export const MonitorEvaluatorSchema = z.union([
  z.object({
    type: z.literal("keyword"),
    field: z.string(),
    keywords: z.array(z.string()),
    case_sensitive: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("threshold"),
    field: z.string(),
    operator: z.enum([">", ">=", "<", "<=", "==", "!="]),
    value: z.number(),
  }),
]);
export type MonitorEvaluator = z.infer<typeof MonitorEvaluatorSchema>;

export const MonitorScheduleSchema = z.object({
  kind: z.enum(["manual", "interval"]),
  every_seconds: z.number().optional(),
});
export type MonitorSchedule = z.infer<typeof MonitorScheduleSchema>;

export const MonitorSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  enabled: z.boolean(),
  evaluator: MonitorEvaluatorSchema,
  severity: SeveritySchema,
  schedule: MonitorScheduleSchema,
  creates_review: z.boolean(),
  signal_type: z.string().nullable(),
  scope: z.string().nullable().optional(),
  target: z.unknown().nullable().optional(),
  last_run_at: z.string().nullable(),
  next_run_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Monitor = z.infer<typeof MonitorSchema>;
export const MonitorListSchema = ListSchema(MonitorSchema);

export const MonitorExecutionSchema = z.object({
  id: z.string(),
  monitor_id: z.string(),
  status: z.enum(["running", "passed", "failed", "error"]),
  trigger: z.enum(["manual", "scheduled"]),
  matched_node_ids: z.array(z.string()),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  error: z.string().nullable().optional(),
});
export type MonitorExecution = z.infer<typeof MonitorExecutionSchema>;
export const MonitorExecutionListSchema = ListSchema(MonitorExecutionSchema);

// ── Signals ──

export const SignalSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  monitor_id: z.string().nullable(),
  monitor_execution_id: z.string().nullable(),
  run_id: z.string().nullable(),
  node_id: z.string().nullable(),
  source: z.enum(["monitor", "manual", "detector"]),
  severity: SeveritySchema,
  title: z.string(),
  message: z.string().nullable(),
  status: z.enum(["open", "acknowledged", "resolved"]),
  type: z.string().nullable(),
  data: z.unknown(),
  acknowledged_at: z.string().nullable(),
  created_at: z.string(),
});
export type Signal = z.infer<typeof SignalSchema>;
export const SignalListSchema = ListSchema(SignalSchema);

// ── Findings ──

export const FindingStatusSchema = z.enum(["open", "review_requested", "resolved", "dismissed"]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  monitor_id: z.string(),
  signal_id: z.string(),
  run_id: z.string().nullable(),
  node_id: z.string().nullable(),
  severity: SeveritySchema,
  title: z.string(),
  summary: z.string(),
  status: FindingStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type Finding = z.infer<typeof FindingSchema>;
export const FindingListSchema = ListSchema(FindingSchema);

// ── Reviews ──

export const ReviewDecisionSchema = z.enum(["passed", "failed", "needs_fix"]);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const ReviewSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  finding_id: z.string(),
  status: z.enum(["pending", "claimed", "passed", "failed", "needs_fix"]),
  reviewer_agent_id: z.string().nullable(),
  decision: ReviewDecisionSchema.nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  resolved_at: z.string().nullable(),
});
export type Review = z.infer<typeof ReviewSchema>;
export const ReviewListSchema = ListSchema(ReviewSchema);

// ── Narrative ──

export const NarrativeSchema = z.object({
  run_id: z.string(),
  agent_id: z.string(),
  narrative: z.string(),
  key_moments: z.array(z.string()),
  root_cause: z.string(),
  scorer: z.string(),
  model: z.string(),
  provider: z.string(),
  scored_node_count: z.number(),
  total_node_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Narrative = z.infer<typeof NarrativeSchema>;

// ── Config file ──

export const SessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
});
export type Session = z.infer<typeof SessionSchema>;

export const AiKeysSchema = z.object({
  anthropic: z.string().optional(),
  openai: z.string().optional(),
  braintrust: z.string().optional(),
  braintrustBaseUrl: z.string().url().optional(),
});
export type AiKeys = z.infer<typeof AiKeysSchema>;
export const AI_PROVIDERS = ["anthropic", "openai", "braintrust", "braintrustBaseUrl"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const ConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  profile: z.string().optional(),
  session: SessionSchema.optional(),
  aiKeys: AiKeysSchema.optional(),
  profiles: z
    .record(
      z.string(),
      z.object({
        apiKey: z.string().optional(),
        baseUrl: z.string().url().optional(),
        session: SessionSchema.optional(),
        aiKeys: AiKeysSchema.optional(),
      }),
    )
    .optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

// ── Eval primitives (mirror @invariance/api-types) ──

export interface EvalDataset {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EvalDatasetExample {
  id: string;
  dataset_id: string;
  agent_id: string;
  input: Record<string, unknown>;
  expected: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type EvalScorerKind = "assertion" | "code" | "llm" | "builtin";

export interface EvalScorer {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  kind: EvalScorerKind;
  definition: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ScorerName =
  | "exact_match"
  | "contains"
  | "numeric_tolerance"
  | "json_match"
  | "levenshtein";

export interface ScorerSpec {
  name: ScorerName | string;
  config?: Record<string, unknown>;
}

export type EvalRunStatus = "queued" | "running" | "passed" | "failed" | "errored";

export interface EvalRunRecord {
  id: string;
  suite_id: string;
  agent_id: string;
  status: EvalRunStatus;
  summary: Record<string, unknown>;
  scorer_specs: ScorerSpec[];
  baseline_run_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvalResultRecord {
  id: string;
  eval_run_id: string;
  case_id: string;
  status: "passed" | "failed" | "errored";
  scores: Record<string, number>;
  failures: Array<{ message: string; path?: string; observed?: unknown; expected?: unknown }>;
  created_at: string;
}

export interface ScoreDelta {
  scorer: string;
  baseline: number | null;
  current: number | null;
  delta: number | null;
}

export interface CaseScoreDelta {
  case_id: string;
  baseline_result_id: string | null;
  current_result_id: string;
  scores: ScoreDelta[];
}

export interface CompareResponse {
  run_id: string;
  baseline_run_id: string;
  aggregate: ScoreDelta[];
  cases: CaseScoreDelta[];
}

// ── Recipes & Guardrails ──

export const GuardrailModeSchema = z.enum(["suggested", "shadow", "active_monitor"]);
export type GuardrailMode = z.infer<typeof GuardrailModeSchema>;

export const GuardrailStatusSchema = z.enum([
  "suggested",
  "accepted",
  "shadow",
  "active_monitor",
  "rejected",
]);
export type GuardrailStatus = z.infer<typeof GuardrailStatusSchema>;

export const RecipeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  domain: z.string(),
  description: z.string(),
  control: z.string(),
  rule: z.string(),
  default_mode: GuardrailModeSchema,
  enabled: z.boolean(),
  builtin: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Recipe = z.infer<typeof RecipeSchema>;
export const RecipeListSchema = ListSchema(RecipeSchema);

export const GuardrailSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  recipe_id: z.string().nullable(),
  finding_id: z.string().nullable(),
  title: z.string(),
  rule: z.string(),
  mode: GuardrailModeSchema,
  status: GuardrailStatusSchema,
  monitor_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Guardrail = z.infer<typeof GuardrailSchema>;
export const GuardrailListSchema = ListSchema(GuardrailSchema);

// ── DNA / Context Graph ──

export const DnaEntitySchema = z.object({
  id: z.string(),
  run_id: z.string(),
  agent_id: z.string(),
  kind: z.string(),
  source: z.string(),
  external_id: z.string().nullable(),
  title: z.string(),
  attributes: z.record(z.string(), z.unknown()),
  evidence_node_ids: z.array(z.string()),
  confidence: z.number(),
  created_at: z.string(),
});
export type DnaEntity = z.infer<typeof DnaEntitySchema>;
export const DnaEntityListSchema = ListSchema(DnaEntitySchema);

export const DnaEdgeSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  agent_id: z.string(),
  source_id: z.string(),
  target_id: z.string(),
  kind: z.string(),
  label: z.string(),
  confidence: z.number(),
  evidence_node_ids: z.array(z.string()),
  provenance: z.record(z.string(), z.unknown()),
  recipe_id: z.string().nullable(),
  created_at: z.string(),
});
export type DnaEdge = z.infer<typeof DnaEdgeSchema>;
export const DnaEdgeListSchema = ListSchema(DnaEdgeSchema);

export const DnaEdgeExplainSchema = z.object({
  edge: DnaEdgeSchema,
  source_entity: DnaEntitySchema.nullable(),
  target_entity: DnaEntitySchema.nullable(),
});
export type DnaEdgeExplain = z.infer<typeof DnaEdgeExplainSchema>;

export const DnaEdgeCandidateSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  source_object_id: z.string(),
  target_object_id: z.string(),
  relation_kind: z.string(),
  confidence: z.number(),
  evidence_event_ids: z.array(z.string()),
  evidence_chunk_ids: z.array(z.string()),
  reason_codes: z.array(z.string()),
  rationale: z.string(),
  status: z.enum(["proposed", "accepted", "rejected", "expired", "promoted"]),
  created_at: z.string(),
  updated_at: z.string(),
  expires_at: z.string().nullable(),
});
export type DnaEdgeCandidate = z.infer<typeof DnaEdgeCandidateSchema>;
export const DnaEdgeCandidateListSchema = ListSchema(DnaEdgeCandidateSchema);

export const DnaSemanticLinkSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  source_chunk_id: z.string(),
  target_chunk_id: z.string(),
  source_object_id: z.string().nullable(),
  target_object_id: z.string().nullable(),
  relation_kind: z.string(),
  confidence: z.number(),
  rationale: z.string(),
  evidence_chunk_ids: z.array(z.string()),
  model_version: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  last_reinforced_at: z.string().nullable(),
});
export type DnaSemanticLink = z.infer<typeof DnaSemanticLinkSchema>;

export const DnaPromoteResponseSchema = z.object({
  semantic_link: DnaSemanticLinkSchema,
  candidate: DnaEdgeCandidateSchema,
  already_promoted: z.boolean(),
  dry_run: z.boolean(),
});
export type DnaPromoteResponse = z.infer<typeof DnaPromoteResponseSchema>;

// Project-scoped DNA-stack object (distinct from the agent-scoped DnaEntity).
export const DnaObjectSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  kind: z.string(),
  source: z.string(),
  external_id: z.string().nullable(),
  title: z.string(),
  properties: z.record(z.string(), z.unknown()),
  aliases: z.array(z.string()),
  confidence: z.number(),
  status: z.enum(["active", "merged", "archived", "rejected"]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type DnaObject = z.infer<typeof DnaObjectSchema>;
export const DnaObjectListSchema = ListSchema(DnaObjectSchema);

export const DnaObjectMentionSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  event_id: z.string().nullable(),
  chunk_id: z.string().nullable(),
  object_id: z.string().nullable(),
  candidate_object_key: z.string(),
  mention_type: z.string(),
  extracted_text: z.string(),
  normalized_value: z.string(),
  confidence: z.number(),
  extractor: z.string(),
  evidence: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});
export type DnaObjectMention = z.infer<typeof DnaObjectMentionSchema>;
export const DnaObjectMentionListSchema = ListSchema(DnaObjectMentionSchema);

export const DnaQueryResponseSchema = z.object({
  query: z.object({
    q: z.string(),
    kinds: z.array(z.string()).optional(),
    run_id: z.string().optional(),
    include_edges: z.boolean().optional(),
    limit: z.number().optional(),
  }),
  entities: z.array(DnaEntitySchema),
  edges: z.array(DnaEdgeSchema),
});
export type DnaQueryResponse = z.infer<typeof DnaQueryResponseSchema>;

// ── Cortex jobs (evals, counterfactuals, attribution, etc.) ──

export const CortexJobKindSchema = z.enum([
  "workflow_eval",
  "counterfactual_eval",
  "workflow_experiment",
  "outcome_attribution",
  "recommendation_impact_eval",
  "prompt_variant_eval",
  "policy_eval",
  "divergence_error_tracking",
  "complex_query",
]);
export type CortexJobKind = z.infer<typeof CortexJobKindSchema>;

export const CortexTargetTypeSchema = z.enum([
  "run",
  "case",
  "workflow",
  "step",
  "agent",
  "prompt",
  "policy",
  "recommendation",
  "external",
  "finding",
  "review",
  "eval_run",
  "project",
]);
export type CortexTargetType = z.infer<typeof CortexTargetTypeSchema>;

/** How a launched job runs: `sync` blocks and returns the result; `async` enqueues. */
export const CortexLaunchModeSchema = z.enum(["sync", "async"]);
export type CortexLaunchMode = z.infer<typeof CortexLaunchModeSchema>;

export const CortexJobStatusSchema = z.enum([
  "queued",
  "leased",
  "running",
  "succeeded",
  "failed",
  "dead",
  "cancelled",
]);
export type CortexJobStatus = z.infer<typeof CortexJobStatusSchema>;

/** Terminal lifecycle states — a job is done when it reaches one of these. */
export const CORTEX_TERMINAL_STATUSES: readonly CortexJobStatus[] = [
  "succeeded",
  "failed",
  "dead",
  "cancelled",
];

/**
 * Server-side accepted shape for `POST /v1/cortex/jobs`. Mirrors the plan in
 * `give-fiel-apth-for-zesty-forest.md` (Generic Cortex Evals + Counterfactuals).
 * Actor is resolved from the API key, so it is not sent.
 */
export interface CortexJobCreateRequest {
  project_id: string;
  job_kind: CortexJobKind;
  target_type: CortexTargetType;
  target_ref: string;
  question?: string;
  criteria?: Record<string, unknown>;
  input_refs?: Record<string, unknown>;
  input_payload?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export const CortexJobCreateResponseSchema = z.object({
  job_id: z.string(),
  status: CortexJobStatusSchema,
  deduplicated: z.boolean(),
});
export type CortexJobCreateResponse = z.infer<typeof CortexJobCreateResponseSchema>;

export const CortexJobSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  job_kind: CortexJobKindSchema,
  target_type: CortexTargetTypeSchema,
  target_ref: z.string(),
  question: z.string().nullable().optional(),
  status: CortexJobStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type CortexJob = z.infer<typeof CortexJobSchema>;

export const CortexJobResultSchema = z.object({
  job_id: z.string(),
  status: CortexJobStatusSchema,
  result: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().nullable().optional(),
});
export type CortexJobResult = z.infer<typeof CortexJobResultSchema>;

// ── Cortex governed launcher (launch / list / retry / runs) ──

/**
 * Input to the governed launcher (`POST /v1/cortex/jobs/launch`). Same shape as
 * {@link CortexJobCreateRequest} plus `mode` (run now vs. enqueue) and an
 * optional `idempotency_key` for dedup.
 */
export interface CortexLaunchJobRequest extends CortexJobCreateRequest {
  mode: CortexLaunchMode;
  idempotency_key?: string | null;
}

/**
 * Response from the launcher. For `sync` launches the parsed `result` (or
 * `error`) is embedded once the job ran; `async` launches return the queued job.
 */
export const CortexLaunchJobResponseSchema = z.object({
  job_id: z.string(),
  status: CortexJobStatusSchema,
  mode: CortexLaunchModeSchema,
  deduplicated: z.boolean(),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().nullable().optional(),
});
export type CortexLaunchJobResponse = z.infer<typeof CortexLaunchJobResponseSchema>;

/** Page of jobs from `GET /v1/cortex/jobs`. */
export const CortexJobListSchema = z.object({
  data: z.array(CortexJobSchema),
  next_cursor: z.string().nullable().optional(),
});
export type CortexJobList = z.infer<typeof CortexJobListSchema>;

export const CortexRetryJobResponseSchema = z.object({
  job_id: z.string(),
  status: CortexJobStatusSchema,
});
export type CortexRetryJobResponse = z.infer<typeof CortexRetryJobResponseSchema>;

/** One attempt at running a job (the `cortex_job_runs` audit-trail row). */
export const CortexJobRunSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  project_id: z.string().optional(),
  job_kind: CortexJobKindSchema.optional(),
  prompt_spec_id: z.string().nullable().optional(),
  prompt_key: z.string().nullable().optional(),
  prompt_version: z.number().nullable().optional(),
  model: z.string().nullable().optional(),
  status: z.enum(["running", "succeeded", "failed", "cancelled"]),
  output_refs: z.record(z.string(), z.unknown()).optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  error: z.string().nullable().optional(),
  started_at: z.string().optional(),
  finished_at: z.string().nullable().optional(),
  latency_ms: z.number().nullable().optional(),
});
export type CortexJobRun = z.infer<typeof CortexJobRunSchema>;

export const CortexJobRunListSchema = z.object({
  runs: z.array(CortexJobRunSchema),
});
export type CortexJobRunList = z.infer<typeof CortexJobRunListSchema>;

// ── Cortex result shapes (defined locally pending shared types) ──

/**
 * Result of the read-only `complex_query` analyst. Every id in `evidence_refs`
 * and `affected_entities` was observed through a governed read tool — the
 * runtime fails closed against fabricated or cross-project ids.
 */
export interface ComplexQueryResult {
  kind: "complex_query";
  /** Direct answer to the question. */
  short_answer: string;
  /** Ordered steps the analyst took to reach the answer. */
  reasoning_plan: string[];
  /** Observed ids the answer is grounded in. */
  evidence_refs: string[];
  /** Observed ids the answer is about. */
  affected_entities: string[];
  confidence: number;
  /** Count of ACL-filtered evidence items withheld, never returned. */
  restricted_evidence_count: number;
  recommended_action: string;
  follow_up_questions: string[];
}

/** One high-frequency error surfaced by a `divergence_error_tracking` job. */
export interface DivergenceTopError {
  run_id: string;
  kind: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  suggested_action: string | null;
}

export interface DivergenceErrorTrackingResult {
  kind: "divergence_error_tracking";
  target_type: CortexTargetType;
  target_ref: string;
  total_divergences: number;
  open_divergences: number;
  critical_open_divergences: number;
  by_kind: Record<string, number>;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  affected_run_ids: string[];
  top_errors: DivergenceTopError[];
  recommended_actions: string[];
}

// ── CLI global options ──

export interface GlobalOptions {
  json?: boolean;
  profile?: string;
  noColor?: boolean;
}
