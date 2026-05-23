import { Command } from "commander";
import { readFileSync } from "node:fs";
import { action, parseIntFlag, parseJsonFlag, parseTagsFlag, printPage, printValue } from "../../lib/cmd.js";

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
      .option("--tags <list>", "Comma-separated tags (e.g. meeting,q3)")
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
      const tags = parseTagsFlag(opts.tags);
      if (tags !== undefined) body.tags = tags;
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
      .option("--tags <list>", "Filter by tags (comma-separated; matches ALL)")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Opaque pagination token"),
    async ({ client, globals, opts }) => {
      const page = await client.listCaptures({
        source: opts.source,
        session_type: opts.captureType,
        run_id: opts.runId,
        operator_id: opts.operatorId,
        tags: opts.tags,
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
      .option("--metadata <json>", "Metadata JSON object (merged shallowly)")
      .option("--tags <list>", "Replace tags (comma-separated; empty string clears)"),
    async ({ client, globals, opts, cmd }) => {
      const patch: Record<string, unknown> = {};
      if (opts.status !== undefined) patch.status = opts.status;
      if (opts.runId !== undefined) patch.run_id = opts.runId;
      if (opts.metadata !== undefined) patch.metadata = parseJsonFlag("metadata", opts.metadata);
      const tags = parseTagsFlag(opts.tags);
      if (tags !== undefined) patch.tags = tags;
      printValue(await client.updateCapture(cmd.args[0]!, patch), globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("link")
      .description(
        "Link a capture to an evidence-graph target. With --run-id alone it PATCHes run_id (legacy); with --target-id it creates a richer link to any target (--target-type defaults to run).",
      )
      .argument("<id>", "Capture ID")
      .option("--run-id <id>", "Legacy: link to a run by setting run_id (PATCH)")
      .option("--target-type <t>", "Target kind: run | case | workflow_event | node (default run)")
      .option("--target-id <id>", "Target id to link (creates a capture link)")
      .option("--link-type <t>", "Link relationship: evidence | source | derived_from | mentions | related")
      .addHelpText(
        "after",
        "\nExamples:\n  $ inv capture link cap_1 --run-id run_9\n  $ inv capture link cap_1 --target-type case --target-id case_2 --link-type evidence\n",
      ),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      if (opts.targetId !== undefined) {
        const link = await client.createCaptureLink(id, {
          target_type: opts.targetType ?? "run",
          target_id: opts.targetId,
          link_type: opts.linkType,
        });
        printValue(link, globals);
        return;
      }
      if (opts.runId === undefined) {
        throw new Error("provide either --run-id (legacy) or --target-id");
      }
      printValue(await client.updateCapture(id, { run_id: opts.runId }), globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("links")
      .description("List every evidence link on a capture (case/run/event/node).")
      .argument("<id>", "Capture ID"),
    async ({ client, globals, cmd }) => {
      printValue(await client.listCaptureLinks(cmd.args[0]!), globals);
    },
  ) as Command,
);

captureCommand.addCommand(
  action(
    new Command("unlink")
      .description(
        "Detach a capture link. With --link-id deletes a specific evidence link; otherwise clears run_id (legacy PATCH).",
      )
      .argument("<id>", "Capture ID")
      .option("--link-id <id>", "Specific capture link id to detach"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      if (opts.linkId !== undefined) {
        await client.deleteCaptureLink(id, opts.linkId);
        printValue({ id, detached: opts.linkId }, globals);
        return;
      }
      printValue(await client.updateCapture(id, { run_id: null }), globals);
    },
  ) as Command,
);
