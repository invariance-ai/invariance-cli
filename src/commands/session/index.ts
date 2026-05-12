import { Command } from "commander";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";

export const sessionCommand = new Command("session").description(
  "Manage agent sessions (Claude Code, recordings, notes, meetings, etc.)",
);

const SESSION_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "source", label: "SOURCE" },
  { key: "session_type", label: "TYPE" },
  { key: "title", label: "TITLE" },
  { key: "created_at", label: "CREATED" },
];

sessionCommand.addCommand(
  action(
    new Command("create")
      .description("Create a new agent session")
      .requiredOption("--source <source>", "Source: claude_code|cursor|screen_recording|microphone|meeting|granola_note|manual_note|api|cli|...")
      .option("--external-id <id>", "External session ID (provider-side identifier)")
      .option("--type <type>", "Session type")
      .option("--title <title>", "Human-readable title")
      .option("--agent-id <id>", "Owning agent ID")
      .option("--operator-id <id>", "Owning operator ID")
      .option("--run-id <id>", "Attach to an existing run"),
    async ({ client, globals, opts }) => {
      const session = await client.createAgentSession({
        source: opts.source,
        ...(opts.externalId ? { external_session_id: opts.externalId } : {}),
        ...(opts.type ? { session_type: opts.type } : {}),
        ...(opts.title ? { title: opts.title } : {}),
        ...(opts.agentId ? { agent_id: opts.agentId } : {}),
        ...(opts.operatorId ? { operator_id: opts.operatorId } : {}),
        ...(opts.runId ? { run_id: opts.runId } : {}),
      });
      printValue(session, globals);
    },
  ) as Command,
);

sessionCommand.addCommand(
  action(
    new Command("list")
      .description("List agent sessions")
      .option("--source <source>", "Filter by source")
      .option("--agent-id <id>", "Filter by agent ID")
      .option("--operator-id <id>", "Filter by operator ID")
      .option("--cursor <cursor>", "Pagination cursor")
      .option("--limit <n>", "Page size", parseIntFlag),
    async ({ client, globals, opts }) => {
      const page = await client.listAgentSessions({
        source: opts.source,
        agent_id: opts.agentId,
        operator_id: opts.operatorId,
        cursor: opts.cursor,
        limit: opts.limit,
      });
      printPage(page, SESSION_COLUMNS, globals);
    },
  ) as Command,
);

sessionCommand.addCommand(
  action(
    new Command("get")
      .description("Get an agent session by ID")
      .argument("<id>", "Session ID"),
    async ({ client, globals, cmd }) => {
      const id = cmd.args[0]!;
      printValue(await client.getAgentSession(id), globals);
    },
  ) as Command,
);

sessionCommand.addCommand(
  action(
    new Command("attach-run")
      .description("Attach a run to an existing session (PATCH run_id)")
      .argument("<session-id>", "Session ID")
      .argument("<run-id>", "Run ID"),
    async ({ client, globals, cmd }) => {
      const [sessionId, runId] = cmd.args as [string, string];
      const session = await client.updateAgentSession(sessionId, { run_id: runId });
      printValue(session, globals);
    },
  ) as Command,
);

sessionCommand.addCommand(
  action(
    new Command("import-note")
      .description("Import a note (granola or manual) as a session")
      .requiredOption("--source <source>", "Source: granola|manual")
      .requiredOption("--file <path>", "Path to the note file")
      .option("--title <title>", "Title (default: filename)"),
    async ({ client, globals, opts }) => {
      const source = opts.source === "granola" ? "granola_note" : opts.source === "manual" ? "manual_note" : opts.source;
      const content = readFileSync(opts.file, "utf8");
      const title = opts.title ?? basename(opts.file);
      const session = await client.createAgentSession({
        source,
        title,
        session_type: "note",
        metadata: { file: opts.file, content },
      });
      printValue(session, globals);
    },
  ) as Command,
);

sessionCommand.addCommand(
  action(
    new Command("start")
      .description("Quickly start a session with sensible defaults")
      .option("--type <type>", "Session type", "claude_code")
      .option("--source <source>", "Source", "cli")
      .option("--title <title>", "Title")
      .option("--external-id <id>", "External session ID"),
    async ({ client, globals, opts }) => {
      const session = await client.createAgentSession({
        source: opts.source ?? "cli",
        session_type: opts.type ?? "claude_code",
        ...(opts.title ? { title: opts.title } : {}),
        ...(opts.externalId ? { external_session_id: opts.externalId } : {}),
      });
      printValue(session, globals);
    },
  ) as Command,
);
