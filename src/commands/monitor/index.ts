import fs from "node:fs/promises";
import readline from "node:readline";
import { Command } from "commander";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  try {
    const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

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
      .description(
        "Create a monitor. Output (--json): {id, agent_id, name, description, enabled, evaluator, severity, schedule, creates_review, signal_type, last_run_at, next_run_at, created_at, updated_at, ...}",
      )
      .option("--file <path>", "JSON file with CreateMonitorRequest body")
      .option("--spec <json>", "Inline JSON body")
      .addHelpText(
        "after",
        "\nExample:\n  $ invariance monitor create --spec '{\"name\":\"high-cost-llm\",\"severity\":\"high\",\"evaluator\":{\"kind\":\"filter\",\"on\":{\"node\":{\"action_type\":\"llm_call\"}}},\"schedule\":{\"kind\":\"on_event\"}}'\n",
      ),
    async ({ client, globals, opts }) => {
      const body = await readBody(opts);
      printValue(await client.createMonitor(body), globals);
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List monitors. Output (--json): {data: Monitor[], next_cursor} where Monitor = {id, agent_id, name, enabled, severity, evaluator, schedule, creates_review, last_run_at, next_run_at, ...}",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor")
      // NOTE: --enabled / --disabled / --severity are applied client-side.
      // The /v1/monitors route does not accept these as query params today
      // (future API gap).
      .option("--enabled", "Only show enabled monitors")
      .option("--disabled", "Only show disabled monitors")
      .option("--severity <sev>", "Filter by severity"),
    async ({ client, globals, opts }) => {
      const page = await client.listMonitors({ cursor: opts.cursor, limit: opts.limit });
      const filtered = {
        ...page,
        data: page.data.filter((m) => {
          if (opts.enabled && !m.enabled) return false;
          if (opts.disabled && m.enabled) return false;
          if (opts.severity && m.severity !== opts.severity) return false;
          return true;
        }),
      };
      printPage(
        filtered,
        MONITOR_COLUMNS,
        globals,
      );
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("get")
      .description(
        "Show a monitor. Output (--json): {id, agent_id, name, description, enabled, evaluator, severity, schedule, creates_review, signal_type, last_run_at, next_run_at, created_at, updated_at, ...}",
      )
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getMonitor(cmd.args[0]!), globals);
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("update")
      .description(
        "Update a monitor. Output (--json): the updated Monitor = {id, name, enabled, evaluator, severity, schedule, ..., updated_at}",
      )
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
  action(
    new Command("pause")
      .description(
        "Disable a monitor. Output (--json): the updated Monitor = {id, enabled: false, ...}",
      )
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.updateMonitor(cmd.args[0]!, { enabled: false }), globals);
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("resume")
      .description(
        "Enable a monitor. Output (--json): the updated Monitor = {id, enabled: true, ...}",
      )
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.updateMonitor(cmd.args[0]!, { enabled: true }), globals);
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("evaluate")
      .description(
        "Manually trigger monitor evaluation. Output (--json): MonitorExecution = {id, monitor_id, status: 'running'|'passed'|'failed'|'error'|'skipped', trigger: 'manual', matched_node_ids, started_at, finished_at, error, matched_count, ...}",
      )
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
      .description(
        "List executions for a monitor. Output (--json): {data: MonitorExecution[], next_cursor} where MonitorExecution = {id, monitor_id, status, trigger, matched_node_ids, started_at, finished_at, error, matched_count, ...}",
      )
      .argument("<id>")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor"),
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
    new Command("delete")
      .description(
        "Delete (archive) a monitor. Existing findings, signals, and reviews remain queryable but the monitor stops evaluating. Prompts for confirmation unless --yes is passed.",
      )
      .argument("<id>")
      .option("-y, --yes", "Skip confirmation prompt")
      .addHelpText("after", "\nExample:\n  $ invariance monitor delete monitor_123 --yes\n"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      if (!opts.yes) {
        const ok = await confirm(`Delete monitor ${id}? [y/N] `);
        if (!ok) {
          if (!globals.json) process.stderr.write("Cancelled.\n");
          return;
        }
      }
      await client.deleteMonitor(id);
      printValue({ id, deleted: true }, globals);
    },
  ) as Command,
);

monitorCommand.addCommand(
  action(
    new Command("findings")
      .description(
        "List findings produced by a monitor. Output (--json): {data: Finding[], next_cursor} where Finding = {id, agent_id, monitor_id, signal_id, run_id, node_id, severity, title, summary, status: 'open'|'review_requested'|'resolved'|'dismissed', created_at, updated_at, ...}",
      )
      .argument("<id>")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor"),
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
