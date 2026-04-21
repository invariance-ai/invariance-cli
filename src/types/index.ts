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

export const FindingStatusSchema = z.enum([
  "open",
  "review_requested",
  "resolved",
  "dismissed",
]);
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

export const ConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  profile: z.string().optional(),
  profiles: z
    .record(
      z.string(),
      z.object({
        apiKey: z.string().optional(),
        baseUrl: z.string().url().optional(),
      }),
    )
    .optional(),
});
export type Config = z.infer<typeof ConfigSchema>;

// ── CLI global options ──

export interface GlobalOptions {
  json?: boolean;
  profile?: string;
  noColor?: boolean;
}
