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
      .description("Emit a signal manually")
      .requiredOption("--severity <s>", "info|low|medium|high|critical")
      .requiredOption("--title <text>", "Signal title")
      .option("--message <text>", "Message body")
      .option("--type <t>", "Signal type key")
      .option("--run-id <id>", "Attach to run")
      .option("--node-id <id>", "Attach to node")
      .option("--data <json>", "Structured data payload"),
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
      .description("List signals")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Cursor"),
    async ({ client, globals, opts }) => {
      printPage(
        await client.listSignals({ cursor: opts.cursor, limit: opts.limit }),
        SIGNAL_COLUMNS,
        globals,
      );
    },
  ) as Command,
);

signalCommand.addCommand(
  action(new Command("get").description("Show a signal").argument("<id>"), async ({ client, globals, cmd }) => {
    printValue(await client.getSignal(cmd.args[0]!), globals);
  }) as Command,
);

signalCommand.addCommand(
  action(new Command("ack").description("Acknowledge a signal").argument("<id>"), async ({ client, globals, cmd }) => {
    printValue(await client.ackSignal(cmd.args[0]!), globals);
  }) as Command,
);

signalCommand.addCommand(
  action(new Command("resolve").description("Resolve a signal").argument("<id>"), async ({ client, globals, cmd }) => {
    printValue(await client.resolveSignal(cmd.args[0]!), globals);
  }) as Command,
);
