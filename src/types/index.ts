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
