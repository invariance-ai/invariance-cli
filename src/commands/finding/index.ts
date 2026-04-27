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
      .description(
        "List findings. Output (--json): {data: Finding[], next_cursor} where Finding = {id, agent_id, monitor_id, signal_id, run_id, node_id, severity, title, summary, status: 'open'|'review_requested'|'resolved'|'dismissed', created_at, updated_at, ...}",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor")
      // NOTE: --status, --severity, --since are accepted client-side and
      // applied as a post-fetch filter. The /v1/findings backend route does
      // not currently accept these as query params (future API gap).
      .option("--status <status>", "Filter by status (open|review_requested|resolved|dismissed)")
      .option("--severity <sev>", "Filter by severity")
      .option("--since <iso>", "Only include findings created at/after this ISO timestamp"),
    async ({ client, globals, opts }) => {
      const page = await client.listFindings({ cursor: opts.cursor, limit: opts.limit });
      const filtered = {
        ...page,
        data: page.data.filter((f) => {
          if (opts.status && f.status !== opts.status) return false;
          if (opts.severity && f.severity !== opts.severity) return false;
          if (opts.since && f.created_at && f.created_at < opts.since) return false;
          return true;
        }),
      };
      printPage(filtered, COLUMNS, globals);
    },
  ) as Command,
);

findingCommand.addCommand(
  action(
    new Command("get")
      .description(
        "Show a finding. Output (--json): {id, agent_id, monitor_id, signal_id, run_id, node_id, severity, title, summary, status, evidence, dedupe_key, created_at, updated_at, ...}",
      )
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getFinding(cmd.args[0]!), globals);
    },
  ) as Command,
);

findingCommand.addCommand(
  action(
    new Command("update")
      .description(
        "Update finding status. Output (--json): the updated Finding = {id, status, updated_at, ...}",
      )
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
