import { Command } from "commander";
import { readFileSync } from "node:fs";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";

const CAPTURE_COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "source", label: "Source", width: 18 },
  { key: "session_type", label: "Type", width: 16 },
  { key: "title", label: "Title", width: 30 },
  { key: "run_id", label: "Run", width: 24 },
  { key: "created_at", label: "Created", width: 24 },
];

export const captureCommand = new Command("capture").description(
  "Manage captures — raw observations (sessions, notes, recordings) that can be linked to runs",
);

captureCommand.addCommand(
  action(
    new Command("create")
      .description(
        "Create a capture. Output (--json): {id, source, session_type, title, run_id, metadata, ...}",
      )
      .requiredOption("--source <s>", "Source identifier, e.g. claude_code, manual_note, meeting")
      .option("--capture-type <t>", "Capture / session type (maps to session_type)")
      .option("--title <t>", "Human-readable title")
      .option("--content-file <path>", "Path to a file whose contents are stored as metadata.content")
      .option("--occurred-at <iso>", "ISO-8601 timestamp when the capture occurred")
      .option("--run-id <id>", "Link to an existing run")
      .option("--metadata <json>", "Additional metadata JSON object")
      .addHelpText(
        "after",
        "\nExample:\n  $ inv capture create --source manual_note --title 'Demo notes' --content-file notes.md\n",
      ),
    async ({ client, globals, opts }) => {
      const metadata = (parseJsonFlag("metadata", opts.metadata) ?? {}) as Record<string, unknown>;
      if (opts.contentFile) {
        metadata.content = readFileSync(opts.contentFile, "utf8");
      }
      const body: Record<string, unknown> = { source: opts.source };
      if (opts.captureType !== undefined) body.session_type = opts.captureType;
      if (opts.title !== undefined) body.title = opts.title;
      if (opts.occurredAt !== undefined) body.occurred_at = opts.occurredAt;
      if (opts.runId !== undefined) body.run_id = opts.runId;
      if (Object.keys(metadata).length > 0) body.metadata = metadata;
      printValue(await client.createCapture(body as Parameters<typeof client.createCapture>[0]), globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List captures. Output (--json): {data: Capture[], next_cursor}.",
      )
      .option("--source <s>", "Filter by source")
      .option("--capture-type <t>", "Filter by session_type")
      .option("--run-id <id>", "Filter by linked run")
      .option("--operator-id <id>", "Filter by operator")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Opaque pagination token"),
    async ({ client, globals, opts }) => {
      const page = await client.listCaptures({
        source: opts.source,
        session_type: opts.captureType,
        run_id: opts.runId,
        operator_id: opts.operatorId,
        cursor: opts.cursor,
        limit: opts.limit,
      });
      printPage(page, CAPTURE_COLUMNS, globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("get")
      .description("Get a capture by ID.")
      .argument("<id>", "Capture ID"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getCapture(cmd.args[0]!), globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("update")
      .description("Update a capture's status, run_id, or metadata.")
      .argument("<id>", "Capture ID")
      .option("--status <s>", "New status")
      .option("--run-id <id>", "Link to a run (or pass empty string to clear)")
      .option("--metadata <json>", "Metadata JSON object (merged shallowly)"),
    async ({ client, globals, opts, cmd }) => {
      const patch: Record<string, unknown> = {};
      if (opts.status !== undefined) patch.status = opts.status;
      if (opts.runId !== undefined) patch.run_id = opts.runId;
      if (opts.metadata !== undefined) patch.metadata = parseJsonFlag("metadata", opts.metadata);
      printValue(await client.updateCapture(cmd.args[0]!, patch), globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("link")
      .description("Link a capture to a run (PATCH run_id).")
      .argument("<id>", "Capture ID")
      .requiredOption("--run-id <id>", "Run to link"),
    async ({ client, globals, opts, cmd }) => {
      printValue(await client.updateCapture(cmd.args[0]!, { run_id: opts.runId }), globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("links")
      .description("Show the run linked to a capture (prints its run_id).")
      .argument("<id>", "Capture ID"),
    async ({ client, globals, cmd }) => {
      const capture = await client.getCapture(cmd.args[0]!);
      printValue({ id: capture.id, run_id: capture.run_id ?? null }, globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("unlink")
      .description("Remove the run link from a capture (PATCH run_id: null).")
      .argument("<id>", "Capture ID"),
    async ({ client, globals, cmd }) => {
      printValue(await client.updateCapture(cmd.args[0]!, { run_id: null }), globals);
    },
  ) as Command,
);

// ── Evidence-graph links (POST/GET/DELETE /v1/captures/:id/links) ──
// Attach a capture to an execution/event/run/node with a typed relationship.
// Richer than `link` (which sets the single legacy run_id FK).

captureCommand.addCommand(
  action(
    new Command("link-add")
      .description(
        "Attach a capture to the evidence graph (execution/event/run/node). Output (--json): the created CaptureLink.",
      )
      .argument("<id>", "Capture ID")
      .option("--case-id <id>", "Execution (case) to link to")
      .option("--event-id <id>", "Workflow event to link to")
      .option("--run-id <id>", "Run to link to")
      .option("--node-id <id>", "Node to link to")
      .option("--link-type <t>", "evidence | source | derived_from | mentions | related")
      .option("--metadata <json>", "Additional metadata JSON object")
      .addHelpText(
        "after",
        "\nExample:\n  $ inv capture link-add cap_123 --case-id case_456 --link-type evidence\n",
      ),
    async ({ client, globals, opts, cmd }) => {
      const body: Parameters<typeof client.createCaptureLink>[1] = {};
      if (opts.caseId !== undefined) body.case_id = opts.caseId;
      if (opts.eventId !== undefined) body.workflow_event_id = opts.eventId;
      if (opts.runId !== undefined) body.run_id = opts.runId;
      if (opts.nodeId !== undefined) body.node_id = opts.nodeId;
      if (opts.linkType !== undefined) body.link_type = opts.linkType;
      if (opts.metadata !== undefined) {
        body.metadata = parseJsonFlag("metadata", opts.metadata) as Record<string, unknown>;
      }
      printValue(await client.createCaptureLink(cmd.args[0]!, body), globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("link-list")
      .description("List a capture's evidence-graph links. Output (--json): CaptureLink[].")
      .argument("<id>", "Capture ID"),
    async ({ client, globals, cmd }) => {
      printValue(await client.listCaptureLinks(cmd.args[0]!), globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("link-rm")
      .description("Detach an evidence-graph link by its id.")
      .argument("<id>", "Capture ID")
      .argument("<linkId>", "Link ID"),
    async ({ client, globals, cmd }) => {
      await client.deleteCaptureLink(cmd.args[0]!, cmd.args[1]!);
      printValue({ deleted: cmd.args[1]! }, globals);
    },
  ) as Command,
);
