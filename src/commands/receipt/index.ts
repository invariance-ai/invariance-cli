import { Command } from "commander";
import { readFileSync } from "node:fs";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";
import {
  ExternalReceiptSourceSchema,
  type CreateExternalReceiptRequest,
  type ExternalReceiptCorrelationKeys,
  type ExternalReceiptSource,
} from "../../types/index.js";

const COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "source", label: "Source", width: 12 },
  { key: "kind", label: "Kind", width: 22 },
  { key: "external_id", label: "External ID", width: 22 },
  { key: "occurred_at", label: "Occurred", width: 24 },
];

function parseSource(value: string): ExternalReceiptSource {
  const parsed = ExternalReceiptSourceSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`--source must be one of: ${ExternalReceiptSourceSchema.options.join(", ")}`);
  }
  return parsed.data;
}

function buildReceipt(opts: Record<string, unknown>): CreateExternalReceiptRequest {
  const body: CreateExternalReceiptRequest = {
    source: parseSource(opts.source as string),
    kind: opts.kind as string,
  };
  if (opts.runId !== undefined) body.run_id = opts.runId as string;
  if (opts.nodeId !== undefined) body.node_id = opts.nodeId as string;
  if (opts.externalId !== undefined) body.external_id = opts.externalId as string;
  if (opts.occurredAt !== undefined) body.occurred_at = opts.occurredAt as string;
  if (opts.businessObjectType !== undefined)
    body.business_object_type = opts.businessObjectType as string;
  if (opts.businessObjectId !== undefined)
    body.business_object_id = opts.businessObjectId as string;
  if (opts.subjectType !== undefined) body.subject_type = opts.subjectType as string;
  if (opts.subjectId !== undefined) body.subject_id = opts.subjectId as string;
  if (opts.correlationKeys !== undefined) {
    body.correlation_keys = parseJsonFlag(
      "correlation-keys",
      opts.correlationKeys as string,
    ) as ExternalReceiptCorrelationKeys;
  }
  if (opts.payload !== undefined) {
    body.payload = parseJsonFlag("payload", opts.payload as string) as Record<string, unknown>;
  }
  if (opts.metadata !== undefined) {
    body.metadata = parseJsonFlag("metadata", opts.metadata as string) as Record<string, unknown>;
  }
  return body;
}

export const receiptCommand = new Command("receipt").description(
  "Ingest and inspect external receipts (Stripe/Zendesk/Salesforce/... business-system facts). Writes require an agent API key.",
);

receiptCommand.addCommand(
  action(
    new Command("create")
      .description(
        "Ingest a single external receipt. Maps to POST /v1/receipts (requires an AGENT API KEY — 403 on operator tokens). Output (--json): the created ExternalReceipt = {id, agent_id, run_id, node_id, source, kind, external_id, occurred_at, business_object_type, business_object_id, subject_type, subject_id, correlation_keys, payload, metadata, hash, created_at, updated_at}",
      )
      .requiredOption("--source <source>", ExternalReceiptSourceSchema.options.join(" | "))
      .requiredOption("--kind <kind>", "Receipt kind, e.g. refund.created")
      .option("--run-id <id>")
      .option("--node-id <id>")
      .option("--external-id <id>", "Source system's id for this object")
      .option("--occurred-at <iso>", "When the underlying event occurred")
      .option("--business-object-type <type>")
      .option("--business-object-id <id>")
      .option("--subject-type <type>")
      .option("--subject-id <id>")
      .option("--correlation-keys <json>", "Correlation keys as a JSON object")
      .option("--payload <json>", "Receipt payload as a JSON object")
      .option("--metadata <json>", "Metadata as a JSON object"),
    async ({ client, globals, opts }) => {
      printValue(await client.createReceipt(buildReceipt(opts)), globals);
    },
  ) as Command,
);

receiptCommand.addCommand(
  action(
    new Command("batch")
      .description(
        "Ingest a batch of receipts from a JSON file. Maps to POST /v1/receipts/batch (agent API key). The file must contain either a JSON array of CreateExternalReceiptRequest or an object {receipts: [...]}. Output (--json): {receipts: ExternalReceipt[]}.",
      )
      .requiredOption("--file <path>", "Path to a JSON file of receipts"),
    async ({ client, globals, opts }) => {
      let raw: string;
      try {
        raw = readFileSync(opts.file, "utf8");
      } catch (err) {
        throw new Error(`Could not read --file "${opts.file}": ${(err as Error).message}`);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error(`Invalid JSON in --file "${opts.file}": ${(err as Error).message}`);
      }
      const receipts = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { receipts?: unknown }).receipts)
          ? (parsed as { receipts: unknown[] }).receipts
          : null;
      if (!receipts) {
        throw new Error(`--file "${opts.file}" must be a JSON array or {receipts: [...]}.`);
      }
      printValue(
        { receipts: await client.createReceiptsBatch(receipts as CreateExternalReceiptRequest[]) },
        globals,
      );
    },
  ) as Command,
);

receiptCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List external receipts. Maps to GET /v1/receipts. Output (--json): {data: ExternalReceipt[], next_cursor}.",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor")
      .option("--run-id <id>")
      .option("--node-id <id>")
      .option("--source <source>", ExternalReceiptSourceSchema.options.join(" | "))
      .option("--kind <kind>")
      .option("--external-id <id>")
      .option("--business-object-type <type>")
      .option("--business-object-id <id>"),
    async ({ client, globals, opts }) => {
      const page = await client.listReceipts({
        cursor: opts.cursor,
        limit: opts.limit,
        run_id: opts.runId,
        node_id: opts.nodeId,
        source: opts.source ? parseSource(opts.source) : undefined,
        kind: opts.kind,
        external_id: opts.externalId,
        business_object_type: opts.businessObjectType,
        business_object_id: opts.businessObjectId,
      });
      printPage(page, COLUMNS, globals);
    },
  ) as Command,
);

receiptCommand.addCommand(
  action(
    new Command("get")
      .description("Show an external receipt. Maps to GET /v1/receipts/:id. Output (--json): the ExternalReceipt.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getReceipt(cmd.args[0]!), globals);
    },
  ) as Command,
);
