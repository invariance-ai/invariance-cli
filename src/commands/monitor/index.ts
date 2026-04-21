import fs from "node:fs/promises";
import { Command } from "commander";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";

const MONITOR_COLUMNS = [
  { key: "id", label: "ID", width: 26 },
  { key: "name", label: "Name", width: 30 },
  { key: "enabled", label: "Enabled", width: 8 },
  { key: "severity", label: "Severity", width: 10 },
];

async function readBody(opts: { file?: string; spec?: string }): Promise<Record<string, unknown>> {
  if (opts.file) return JSON.parse(await fs.readFile(opts.file, "utf8")) as Record<string, unknown>;
  if (opts.spec) return parseJsonFlag("spec", opts.spec) as Record<string, unknown>;
  throw new Error("Provide --file or --spec");
}

export const monitorCommand = new Command("monitor").description("Manage monitors (evaluation rules)");

monitorCommand.addCommand(
  action(
    new Command("create")
      .description("Create a monitor")
      .option("--file <path>", "JSON file with CreateMonitorRequest body")
      .option("--spec <json>", "Inline JSON body"),
    async ({ client, globals, opts }) => {
      const body = await readBody(opts);
      printValue(await client.createMonitor(body), globals);
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("list")
      .description("List monitors")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Pagination cursor"),
    async ({ client, globals, opts }) => {
      printPage(
        await client.listMonitors({ cursor: opts.cursor, limit: opts.limit }),
        MONITOR_COLUMNS,
        globals,
      );
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(new Command("get").description("Show a monitor").argument("<id>"), async ({ client, globals, cmd }) => {
    printValue(await client.getMonitor(cmd.args[0]!), globals);
  }) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("update")
      .description("Update a monitor")
      .argument("<id>")
      .option("--file <path>", "JSON file with patch body")
      .option("--patch <json>", "Inline JSON patch body")
      .option("--enabled <bool>", "Set enabled (true|false)"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      let body: Record<string, unknown> = {};
      if (opts.file) body = JSON.parse(await fs.readFile(opts.file, "utf8"));
      else if (opts.patch) body = parseJsonFlag("patch", opts.patch) as Record<string, unknown>;
      if (opts.enabled !== undefined) body.enabled = opts.enabled === "true";
      printValue(await client.updateMonitor(id, body), globals);
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(new Command("pause").description("Disable a monitor").argument("<id>"), async ({ client, globals, cmd }) => {
    printValue(await client.updateMonitor(cmd.args[0]!, { enabled: false }), globals);
  }) as Command,
);

monitorCommand.addCommand(
  action(new Command("resume").description("Enable a monitor").argument("<id>"), async ({ client, globals, cmd }) => {
    printValue(await client.updateMonitor(cmd.args[0]!, { enabled: true }), globals);
  }) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("evaluate")
      .description("Manually trigger monitor evaluation")
      .argument("<id>")
      .option("--run-id <run>", "Scope to a run")
      .option("--since <iso>", "ISO lower bound")
      .option("--limit <n>", "Max nodes to scan", parseIntFlag),
    async ({ client, globals, opts, cmd }) => {
      printValue(
        await client.evaluateMonitor(cmd.args[0]!, {
          run_id: opts.runId,
          since: opts.since,
          limit: opts.limit,
        }),
        globals,
      );
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("executions")
      .description("List executions for a monitor")
      .argument("<id>")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Cursor"),
    async ({ client, globals, opts, cmd }) => {
      const page = await client.monitorExecutions(cmd.args[0]!, {
        cursor: opts.cursor,
        limit: opts.limit,
      });
      printPage(
        page,
        [
          { key: "id", label: "ID", width: 26 },
          { key: "status", label: "Status", width: 10 },
          { key: "trigger", label: "Trigger", width: 10 },
          { key: "started_at", label: "Started", width: 24 },
        ],
        globals,
      );
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("findings")
      .description("List findings produced by a monitor")
      .argument("<id>")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Cursor"),
    async ({ client, globals, opts, cmd }) => {
      const page = await client.monitorFindings(cmd.args[0]!, {
        cursor: opts.cursor,
        limit: opts.limit,
      });
      printPage(
        page,
        [
          { key: "id", label: "ID", width: 26 },
          { key: "severity", label: "Severity", width: 10 },
          { key: "title", label: "Title", width: 30 },
          { key: "status", label: "Status", width: 16 },
        ],
        globals,
      );
    },
  ) as Command,
);
