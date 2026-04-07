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
  description: z.string().optional(),
  size: z.number().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Dataset = z.infer<typeof DatasetSchema>;

export const DatasetListSchema = z.object({
  data: z.array(DatasetSchema),
  total: z.number().optional(),
  has_more: z.boolean().optional(),
});

export type DatasetList = z.infer<typeof DatasetListSchema>;

// ── Evaluation Schemas ──

export const EvaluationSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  dataset_id: z.string().optional(),
  status: z.string(),
  score: z.number().optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string().optional(),
  completed_at: z.string().optional(),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;

export const EvalListSchema = z.object({
  data: z.array(EvaluationSchema),
  total: z.number().optional(),
  has_more: z.boolean().optional(),
});

export type EvalList = z.infer<typeof EvalListSchema>;

// ── Session Schemas ──

export const SessionSchema = z.object({
  id: z.string(),
  trace_id: z.string().optional(),
  agent_id: z.string().optional(),
  status: z.string(),
  started_at: z.string().optional(),
  ended_at: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Session = z.infer<typeof SessionSchema>;

export const SessionListSchema = z.object({
  data: z.array(SessionSchema),
  total: z.number().optional(),
  has_more: z.boolean().optional(),
});

export type SessionList = z.infer<typeof SessionListSchema>;

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
