import { Command } from "commander";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";
import type { Severity } from "../../types/index.js";

const SIGNAL_COLUMNS = [
  { key: "id", label: "ID", width: 26 },
  { key: "severity", label: "Severity", width: 10 },
  { key: "title", label: "Title", width: 40 },
  { key: "status", label: "Status", width: 14 },
  { key: "source", label: "Source", width: 10 },
];

export const signalCommand = new Command("signal").description("Manage signals (alerts)");

signalCommand.addCommand(
  action(
    new Command("emit")
      .description(
        "Emit a signal manually. Output (--json): {id, agent_id, monitor_id, run_id, node_id, source: 'manual', severity, title, message, status: 'open', type, data, created_at, ...}",
      )
      .requiredOption("--severity <s>", "info|low|medium|high|critical")
      .requiredOption("--title <text>", "Signal title")
      .option("--message <text>", "Message body")
      .option("--type <t>", "Signal type key")
      .option("--run-id <id>", "Attach to run")
      .option("--node-id <id>", "Attach to node")
      .option("--data <json>", "Structured data payload")
      .addHelpText(
        "after",
        "\nExample:\n  $ invariance signal emit --severity high --title 'Suspicious tool call' --run-id run_abc --data '{\"tool\":\"shell\",\"cmd\":\"rm -rf /\"}'\n",
      ),
    async ({ client, globals, opts }) => {
      printValue(
        await client.emitSignal({
          severity: opts.severity as Severity,
          title: opts.title,
          message: opts.message,
          type: opts.type,
          run_id: opts.runId,
          node_id: opts.nodeId,
          data: parseJsonFlag("data", opts.data),
        }),
        globals,
      );
    },
  ) as Command,
);

signalCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List signals. Output (--json): {data: Signal[], next_cursor} where Signal = {id, agent_id, monitor_id, run_id, node_id, source, severity, title, status, type, data, created_at, ...}",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor")
      .option("--status <status>", "Filter by status (open|acknowledged|resolved)")
      .option("--severity <sev>", "Filter by severity")
      // NOTE: --since is applied client-side; the /v1/signals route does not
      // currently accept a `since` query param (future API gap).
      .option("--since <iso>", "Only include signals created at/after this ISO timestamp"),
    async ({ client, globals, opts }) => {
      const page = await client.listSignals({
        cursor: opts.cursor,
        limit: opts.limit,
        status: opts.status,
        severity: opts.severity,
      });
      const filtered = opts.since
        ? {
            ...page,
            data: page.data.filter((s) => !s.created_at || s.created_at >= opts.since),
          }
        : page;
      printPage(
        filtered,
        SIGNAL_COLUMNS,
        globals,
      );
    },
  ) as Command,
);

signalCommand.addCommand(
  action(
    new Command("get")
      .description(
        "Show a signal. Output (--json): {id, agent_id, monitor_id, run_id, node_id, source, severity, title, message, status, type, data, acknowledged_at, created_at, ...}",
      )
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getSignal(cmd.args[0]!), globals);
    },
  ) as Command,
);

signalCommand.addCommand(
  action(
    new Command("ack")
      .description(
        "Acknowledge a signal. Output (--json): the updated Signal = {id, status: 'acknowledged', acknowledged_at, ...}",
      )
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.ackSignal(cmd.args[0]!), globals);
    },
  ) as Command,
);

signalCommand.addCommand(
  action(
    new Command("resolve")
      .description(
        "Resolve a signal. Output (--json): the updated Signal = {id, status: 'resolved', ...}",
      )
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.resolveSignal(cmd.args[0]!), globals);
    },
  ) as Command,
);
