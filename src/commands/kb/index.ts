import { Command } from "commander";
import { action, parseIntFlag, parseJsonFlag, parseTagsFlag, printPage, printValue } from "../../lib/cmd.js";

const PAGE_COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "title", label: "Title", width: 36 },
  { key: "slug", label: "Slug", width: 24 },
  { key: "updated_at", label: "Updated", width: 24 },
];

const SESSION_COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "title", label: "Title", width: 36 },
  { key: "created_at", label: "Created", width: 24 },
];

const MESSAGE_COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "role", label: "Role", width: 10 },
  { key: "content", label: "Content", width: 50 },
  { key: "created_at", label: "Created", width: 24 },
];

export const kbCommand = new Command("kb").description(
  "Knowledge base: manage pages (docs) and chat sessions/messages.",
);

// ── Pages ──

kbCommand.addCommand(
  action(
    new Command("page-list")
      .description(
        "List KB pages. Maps to GET /v1/kb/pages. Output (--json): {data: KbPage[], next_cursor} where KbPage = {id, agent_id, title, slug, content, tags, metadata, created_at, updated_at}",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token")
      .option("--q <text>", "Full-text search query")
      .option("--tag <tag>", "Filter by tag"),
    async ({ client, globals, opts }) => {
      const page = await client.listKbPages({
        cursor: opts.cursor,
        limit: opts.limit,
        q: opts.q,
        tag: opts.tag,
      });
      printPage(page, PAGE_COLUMNS, globals);
    },
  ) as Command,
);

kbCommand.addCommand(
  action(
    new Command("page-get")
      .description("Show a KB page. Maps to GET /v1/kb/pages/:id. Output (--json): the KbPage.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getKbPage(cmd.args[0]!), globals);
    },
  ) as Command,
);

kbCommand.addCommand(
  action(
    new Command("page-create")
      .description("Create a KB page. Maps to POST /v1/kb/pages. Output (--json): the created KbPage.")
      .requiredOption("--title <title>")
      .requiredOption("--content <content>", "Page body (markdown/text)")
      .option("--slug <slug>")
      .option("--tags <list>", "Comma-separated tags")
      .option("--metadata <json>", "Metadata as a JSON object"),
    async ({ client, globals, opts }) => {
      const body: {
        title: string;
        content: string;
        slug?: string;
        tags?: string[];
        metadata?: Record<string, unknown>;
      } = { title: opts.title, content: opts.content };
      if (opts.slug !== undefined) body.slug = opts.slug;
      const tags = parseTagsFlag(opts.tags);
      if (tags !== undefined) body.tags = tags;
      if (opts.metadata !== undefined) {
        body.metadata = parseJsonFlag("metadata", opts.metadata) as Record<string, unknown>;
      }
      printValue(await client.createKbPage(body), globals);
    },
  ) as Command,
);

kbCommand.addCommand(
  action(
    new Command("page-update")
      .description(
        "Update a KB page (any subset of fields). Maps to PATCH /v1/kb/pages/:id. Output (--json): the updated KbPage.",
      )
      .argument("<id>")
      .option("--title <title>")
      .option("--content <content>")
      .option("--slug <slug>")
      .option("--tags <list>", "Comma-separated tags")
      .option("--metadata <json>", "Metadata as a JSON object"),
    async ({ client, globals, opts, cmd }) => {
      const patch: Record<string, unknown> = {};
      if (opts.title !== undefined) patch.title = opts.title;
      if (opts.content !== undefined) patch.content = opts.content;
      if (opts.slug !== undefined) patch.slug = opts.slug;
      const tags = parseTagsFlag(opts.tags);
      if (tags !== undefined) patch.tags = tags;
      if (opts.metadata !== undefined) {
        patch.metadata = parseJsonFlag("metadata", opts.metadata);
      }
      printValue(await client.updateKbPage(cmd.args[0]!, patch), globals);
    },
  ) as Command,
);

kbCommand.addCommand(
  action(
    new Command("page-delete")
      .description("Delete a KB page. Maps to DELETE /v1/kb/pages/:id. Output (--json): {ok: true}.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      await client.deleteKbPage(cmd.args[0]!);
      printValue({ ok: true }, globals);
    },
  ) as Command,
);

// ── Sessions ──

kbCommand.addCommand(
  action(
    new Command("session-create")
      .description(
        "Create a KB chat session. Maps to POST /v1/kb/sessions. Output (--json): the KbSession = {id, agent_id, title, metadata, created_at, updated_at}",
      )
      .option("--title <title>")
      .option("--metadata <json>", "Metadata as a JSON object"),
    async ({ client, globals, opts }) => {
      const body: { title?: string; metadata?: Record<string, unknown> } = {};
      if (opts.title !== undefined) body.title = opts.title;
      if (opts.metadata !== undefined) {
        body.metadata = parseJsonFlag("metadata", opts.metadata) as Record<string, unknown>;
      }
      printValue(await client.createKbSession(body), globals);
    },
  ) as Command,
);

kbCommand.addCommand(
  action(
    new Command("session-list")
      .description("List KB sessions. Maps to GET /v1/kb/sessions. Output (--json): {data: KbSession[], next_cursor}.")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token"),
    async ({ client, globals, opts }) => {
      const page = await client.listKbSessions({ cursor: opts.cursor, limit: opts.limit });
      printPage(page, SESSION_COLUMNS, globals);
    },
  ) as Command,
);

kbCommand.addCommand(
  action(
    new Command("session-get")
      .description("Show a KB session. Maps to GET /v1/kb/sessions/:id. Output (--json): the KbSession.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getKbSession(cmd.args[0]!), globals);
    },
  ) as Command,
);

kbCommand.addCommand(
  action(
    new Command("session-delete")
      .description("Delete a KB session. Maps to DELETE /v1/kb/sessions/:id. Output (--json): {ok: true}.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      await client.deleteKbSession(cmd.args[0]!);
      printValue({ ok: true }, globals);
    },
  ) as Command,
);

// ── Messages ──

kbCommand.addCommand(
  action(
    new Command("messages")
      .description(
        "List messages in a KB session. Maps to GET /v1/kb/sessions/:id/messages. Output (--json): {data: KbMessage[], next_cursor} where KbMessage = {id, session_id, role, content, metadata, created_at}",
      )
      .argument("<session-id>")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token"),
    async ({ client, globals, opts, cmd }) => {
      const page = await client.listKbMessages(cmd.args[0]!, {
        cursor: opts.cursor,
        limit: opts.limit,
      });
      printPage(page, MESSAGE_COLUMNS, globals);
    },
  ) as Command,
);

kbCommand.addCommand(
  action(
    new Command("message-add")
      .description(
        "Append a message to a KB session. Maps to POST /v1/kb/sessions/:id/messages. Output (--json): the created KbMessage.",
      )
      .argument("<session-id>")
      .requiredOption("--role <role>", "user | assistant | system")
      .requiredOption("--content <content>", "Message body")
      .option("--metadata <json>", "Metadata as a JSON object"),
    async ({ client, globals, opts, cmd }) => {
      const body: { role: string; content: string; metadata?: Record<string, unknown> } = {
        role: opts.role,
        content: opts.content,
      };
      if (opts.metadata !== undefined) {
        body.metadata = parseJsonFlag("metadata", opts.metadata) as Record<string, unknown>;
      }
      printValue(await client.appendKbMessage(cmd.args[0]!, body), globals);
    },
  ) as Command,
);
