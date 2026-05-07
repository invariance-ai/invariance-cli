import { Command } from "commander";
import { action, parseJsonFlag, printValue } from "../../lib/cmd.js";
import type { MemorySource, MemorySubjectType } from "../../types/memory.js";

const SUBJECT_TYPES = [
  "customer",
  "account",
  "user",
  "policy",
  "workflow",
  "preference",
] as const;

const SOURCES = [
  "agent_write",
  "human_write",
  "crm",
  "ticket",
  "policy_doc",
  "external_system",
] as const;

function assertSubjectType(v: string): MemorySubjectType {
  if (!(SUBJECT_TYPES as readonly string[]).includes(v)) {
    throw new Error(
      `Invalid --subject-type "${v}". Must be one of: ${SUBJECT_TYPES.join(", ")}`,
    );
  }
  return v as MemorySubjectType;
}

function assertSource(v: string): MemorySource {
  if (!(SOURCES as readonly string[]).includes(v)) {
    throw new Error(`Invalid --source "${v}". Must be one of: ${SOURCES.join(", ")}`);
  }
  return v as MemorySource;
}

export const memoryCommand = new Command("memory").description(
  "Record + inspect agent memory access (reads/writes against subject beliefs).",
);

memoryCommand.addCommand(
  action(
    new Command("read")
      .description(
        "Record a memory read by an agent and return the current MemoryRecord (if any).\n" +
          "Output (--json): {access: MemoryAccess, record: MemoryRecord | null}.",
      )
      .requiredOption("--subject-type <t>", `One of: ${SUBJECT_TYPES.join("|")}`)
      .requiredOption("--subject-id <id>", "ID of the subject (e.g. customer ID)")
      .requiredOption("--key <k>", "Belief key, e.g. 'preferred_contact_channel'")
      .requiredOption("--used-for <s>", "Free-text purpose for using this memory")
      .option("--run-id <id>", "Attach to run. Falls back to $INVARIANCE_RUN_ID.")
      .option("--node-id <id>", "Attach to node. Falls back to $INVARIANCE_NODE_ID."),
    async ({ client, globals, opts }) => {
      printValue(
        await client.memoryRead({
          run_id: opts.runId ?? process.env.INVARIANCE_RUN_ID,
          node_id: opts.nodeId ?? process.env.INVARIANCE_NODE_ID,
          subject_type: assertSubjectType(opts.subjectType),
          subject_id: opts.subjectId,
          key: opts.key,
          used_for: opts.usedFor,
        }),
        globals,
      );
    },
  ) as Command,
);

memoryCommand.addCommand(
  action(
    new Command("write")
      .description(
        "Record a memory write by an agent. Returns the new MemoryAccess + MemoryRecord.\n" +
          "Output (--json): {access: MemoryAccess, record: MemoryRecord}.",
      )
      .requiredOption("--subject-type <t>", `One of: ${SUBJECT_TYPES.join("|")}`)
      .requiredOption("--subject-id <id>", "ID of the subject")
      .requiredOption("--key <k>", "Belief key")
      .requiredOption("--value <json>", "Structured value (JSON)")
      .requiredOption("--used-for <s>", "Free-text purpose")
      .option("--run-id <id>", "Attach to run. Falls back to $INVARIANCE_RUN_ID.")
      .option("--node-id <id>", "Attach to node. Falls back to $INVARIANCE_NODE_ID.")
      .option(
        "--source <s>",
        `Origin of the claim (default: agent_write). One of: ${SOURCES.join("|")}`,
      )
      .option("--confidence <n>", "Confidence in [0,1] (default: 1.0)")
      .option("--provenance <json>", "EvidenceRef[] supporting this claim (JSON)")
      .option("--valid-until <iso>", "When this claim should be considered stale (ISO8601)"),
    async ({ client, globals, opts }) => {
      const confidence =
        opts.confidence !== undefined ? Number.parseFloat(opts.confidence) : undefined;
      if (confidence !== undefined && (Number.isNaN(confidence) || confidence < 0 || confidence > 1)) {
        throw new Error(`Invalid --confidence "${opts.confidence}"; must be a number in [0,1]`);
      }
      printValue(
        await client.memoryWrite({
          run_id: opts.runId ?? process.env.INVARIANCE_RUN_ID,
          node_id: opts.nodeId ?? process.env.INVARIANCE_NODE_ID,
          subject_type: assertSubjectType(opts.subjectType),
          subject_id: opts.subjectId,
          key: opts.key,
          value: parseJsonFlag("value", opts.value),
          used_for: opts.usedFor,
          source: opts.source ? assertSource(opts.source) : undefined,
          confidence,
          provenance: opts.provenance
            ? (parseJsonFlag("provenance", opts.provenance) as never)
            : undefined,
          valid_until: opts.validUntil,
        }),
        globals,
      );
    },
  ) as Command,
);
