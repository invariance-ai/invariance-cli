import { Command } from "commander";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";
import type { FindingStatus } from "../../types/index.js";

const COLUMNS = [
  { key: "id", label: "ID", width: 26 },
  { key: "severity", label: "Severity", width: 10 },
  { key: "title", label: "Title", width: 36 },
  { key: "status", label: "Status", width: 18 },
];

export const findingCommand = new Command("finding").description("Manage findings (investigation records)");

findingCommand.addCommand(
  action(
    new Command("list")
      .description("List findings")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Cursor"),
    async ({ client, globals, opts }) => {
      printPage(
        await client.listFindings({ cursor: opts.cursor, limit: opts.limit }),
        COLUMNS,
        globals,
      );
    },
  ) as Command,
);

findingCommand.addCommand(
  action(new Command("get").description("Show a finding").argument("<id>"), async ({ client, globals, cmd }) => {
    printValue(await client.getFinding(cmd.args[0]!), globals);
  }) as Command,
);

findingCommand.addCommand(
  action(
    new Command("update")
      .description("Update finding status")
      .argument("<id>")
      .requiredOption("--status <s>", "open|review_requested|resolved|dismissed"),
    async ({ client, globals, opts, cmd }) => {
      printValue(
        await client.updateFinding(cmd.args[0]!, opts.status as FindingStatus),
        globals,
      );
    },
  ) as Command,
);
