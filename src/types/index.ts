import { z } from "zod";

// ── API Response Schemas ──

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().optional(),
  organization: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
});

export type User = z.infer<typeof UserSchema>;

export const TraceSchema = z.object({
  id: z.string(),
  status: z.string(),
  name: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string().optional(),
  duration_ms: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Trace = z.infer<typeof TraceSchema>;

export const TraceListSchema = z.object({
  data: z.array(TraceSchema),
  has_more: z.boolean().optional(),
});

export type TraceList = z.infer<typeof TraceListSchema>;

export const MonitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
});

export type Monitor = z.infer<typeof MonitorSchema>;

export const MonitorListSchema = z.object({
  data: z.array(MonitorSchema),
});

export type MonitorList = z.infer<typeof MonitorListSchema>;

export const MonitorRunResultSchema = z.object({
  id: z.string(),
  monitor_id: z.string(),
  status: z.string(),
  result: z.unknown().optional(),
  created_at: z.string().optional(),
});

export type MonitorRunResult = z.infer<typeof MonitorRunResultSchema>;

export const SignalSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  severity: z.string().optional(),
  created_at: z.string().optional(),
});

export type Signal = z.infer<typeof SignalSchema>;

export const SignalListSchema = z.object({
  data: z.array(SignalSchema),
});

export type SignalList = z.infer<typeof SignalListSchema>;

export const QueryResultSchema = z.object({
  id: z.string().optional(),
  result: z.unknown(),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
    })
    .optional(),
});

export type QueryResult = z.infer<typeof QueryResultSchema>;

// ── Dataset Schemas ──

export const DatasetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  agent_id: z.string().nullable(),
  owner_id: z.string(),
  current_draft_version: z.number(),
  latest_published_version: z.number(),
  row_count: z.number(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Dataset = z.infer<typeof DatasetSchema>;

// ── Evaluation Schemas ──

export const EvaluationSchema = z.object({
  id: z.string(),
  suite_id: z.string(),
  agent_id: z.string(),
  version_label: z.string().nullable().optional(),
  status: z.string(),
  total_cases: z.number().optional(),
  passed_cases: z.number().optional(),
  failed_cases: z.number().optional(),
  pass_rate: z.number().nullable().optional(),
  avg_score: z.number().nullable().optional(),
  duration_ms: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  owner_id: z.string().optional(),
  started_at: z.string(),
  completed_at: z.string().nullable(),
  created_at: z.string().optional(),
  dataset_id: z.string().nullable().optional(),
  source_type: z.string().optional(),
  results: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

// ── Session Schemas ──

export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_by: z.string(),
  status: z.string(),
  created_at: z.string(),
  closed_at: z.string().nullable().optional(),
  root_hash: z.string().nullable().optional(),
  close_hash: z.string().nullable().optional(),
  receipt_count: z.number().optional(),
});

export type Session = z.infer<typeof SessionSchema>;

// ── Config Types ──

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

// ── CLI Options ──

export interface GlobalOptions {
  json?: boolean;
  profile?: string;
  noColor?: boolean;
}
