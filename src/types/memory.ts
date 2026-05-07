import { z } from "zod";
import { ListSchema } from "./index.js";

// ── Enums ──────────────────────────────────────────────────────────────────

export const MemorySubjectTypeSchema = z.enum([
  "customer",
  "account",
  "user",
  "policy",
  "workflow",
  "preference",
]);
export type MemorySubjectType = z.infer<typeof MemorySubjectTypeSchema>;

export const MemorySourceSchema = z.enum([
  "agent_write",
  "human_write",
  "crm",
  "ticket",
  "policy_doc",
  "external_system",
]);
export type MemorySource = z.infer<typeof MemorySourceSchema>;

export const MemoryAccessTypeSchema = z.enum(["read", "write"]);
export type MemoryAccessType = z.infer<typeof MemoryAccessTypeSchema>;

export const MemoryDivergenceKindSchema = z.enum([
  "stale_memory",
  "contradicted_memory",
  "unsupported_memory",
  "overgeneralized_memory",
  "memory_used_without_source",
  "memory_caused_bad_action",
  "memory_not_updated_after_ground_truth_change",
]);
export type MemoryDivergenceKind = z.infer<typeof MemoryDivergenceKindSchema>;

export const MemoryDivergenceStatusSchema = z.enum(["open", "dismissed", "resolved"]);
export type MemoryDivergenceStatus = z.infer<typeof MemoryDivergenceStatusSchema>;

// ── Records ────────────────────────────────────────────────────────────────

export const EvidenceRefSchema = z.object({
  kind: z.enum(["node", "tool_call", "llm_call", "document", "system_record"]),
  id: z.string(),
  uri: z.string().optional(),
  excerpt: z.string().optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const SystemRecordSchema = z.object({
  source: MemorySourceSchema,
  external_id: z.string(),
  fetched_at: z.string(),
  fields: z.record(z.string(), z.unknown()),
});
export type SystemRecord = z.infer<typeof SystemRecordSchema>;

export const MemoryRecordSchema = z.object({
  id: z.string(),
  agent_id: z.string(),
  subject_type: MemorySubjectTypeSchema,
  subject_id: z.string(),
  claim: z.string(),
  value: z.unknown(),
  source: MemorySourceSchema,
  confidence: z.number(),
  valid_from: z.string(),
  valid_until: z.string().nullable(),
  last_verified_at: z.string().nullable(),
  superseded_by: z.string().nullable(),
  provenance: z.array(EvidenceRefSchema),
});
export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

export const MemoryAccessSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  node_id: z.string(),
  agent_id: z.string(),
  access_type: MemoryAccessTypeSchema,
  subject_type: MemorySubjectTypeSchema,
  subject_id: z.string(),
  key: z.string(),
  value: z.unknown(),
  used_for: z.string(),
  source_node_id: z.string().nullable(),
  timestamp: z.string(),
});
export type MemoryAccess = z.infer<typeof MemoryAccessSchema>;

export const MemoryDivergenceSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  memory_record_id: z.string(),
  divergence_kind: MemoryDivergenceKindSchema,
  detected_at: z.string(),
  affected_run_ids: z.array(z.string()),
  evidence: z.array(EvidenceRefSchema),
  status: MemoryDivergenceStatusSchema,
});
export type MemoryDivergence = z.infer<typeof MemoryDivergenceSchema>;

// ── Endpoint response wrappers ─────────────────────────────────────────────

export const MemoryReadResponseSchema = z.object({
  access: MemoryAccessSchema,
  record: MemoryRecordSchema.nullable(),
});
export type MemoryReadResponse = z.infer<typeof MemoryReadResponseSchema>;

export const MemoryWriteResponseSchema = z.object({
  access: MemoryAccessSchema,
  record: MemoryRecordSchema,
});
export type MemoryWriteResponse = z.infer<typeof MemoryWriteResponseSchema>;

export const MemoryRecordListSchema = ListSchema(MemoryRecordSchema);
export const MemoryDivergenceListSchema = ListSchema(MemoryDivergenceSchema);
