import fs from "node:fs/promises";
import { Command } from "commander";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";

const NODE_COLUMNS = [
  { key: "id", label: "ID", width: 20 },
  { key: "action_type", label: "Action", width: 24 },
  { key: "type", label: "Type", width: 16 },
  { key: "timestamp", label: "Timestamp", width: 15 },
];

export const nodeCommand = new Command("node").description("Manage nodes (execution trace events)");

nodeCommand.addCommand(
  action(
    new Command("write")
      .description("Write one or more nodes to a run")
      .argument("<run_id>")
      .option("--action-type <type>", "Action type (required unless --file)")
      .option("--type <type>", "Declared node type")
      .option("--input <json>", "Input JSON")
      .option("--output <json>", "Output JSON")
      .option("--error <json>", "Error JSON")
      .option("--metadata <json>", "Metadata JSON")
      .option("--file <path>", "JSONL file with one node per line (batched 100)"),
    async ({ client, globals, opts, cmd }) => {
      const runId = cmd.args[0]!;
      let events: Record<string, unknown>[];
      if (opts.file) {
        const raw = await fs.readFile(opts.file, "utf8");
        events = raw
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l, i) => {
            try {
              return JSON.parse(l) as Record<string, unknown>;
            } catch {
              throw new Error(`Invalid JSON on line ${i + 1} of ${opts.file}`);
            }
          });
      } else {
        if (!opts.actionType)
          throw new Error("--action-type is required when --file is not provided");
        events = [
          {
            action_type: opts.actionType,
            type: opts.type,
            input: parseJsonFlag("input", opts.input),
            output: parseJsonFlag("output", opts.output),
            error: parseJsonFlag("error", opts.error),
            metadata: parseJsonFlag("metadata", opts.metadata),
          },
        ];
      }
      const results: unknown[] = [];
      for (let i = 0; i < events.length; i += 100) {
        results.push(...(await client.writeNodes(runId, events.slice(i, i + 100))));
      }
      printValue(results, globals);
    },
  ) as Command,
);

nodeCommand.addCommand(
  action(
    new Command("list")
      .description("List nodes for a run")
      .argument("<run_id>")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Pagination cursor"),
    async ({ client, globals, opts, cmd }) => {
      const runId = cmd.args[0]!;
      const page = await client.listRunNodes(runId, { cursor: opts.cursor, limit: opts.limit });
      printPage(page, NODE_COLUMNS, globals);
    },
  ) as Command,
);

nodeCommand.addCommand(
  action(
    new Command("tail")
      .description("Poll a run for new nodes and stream them as they arrive")
      .argument("<run_id>")
      .option("--interval <ms>", "Poll interval (ms)", parseIntFlag, 2000)
      .option("--once", "Fetch one page and exit"),
    async ({ client, globals, opts, cmd }) => {
      const runId = cmd.args[0]!;
      let cursor: string | undefined;
      let stopped = false;
      const onSigint = () => {
        stopped = true;
      };
      process.once("SIGINT", onSigint);
      try {
        while (!stopped) {
          const page = await client.listRunNodes(runId, { cursor });
          for (const n of page.data) printValue(n, globals);
          if (opts.once) break;
          if (page.next_cursor) {
            cursor = page.next_cursor;
            continue;
          }
          await new Promise((r) => setTimeout(r, opts.interval));
        }
      } finally {
        process.off("SIGINT", onSigint);
      }
    },
  ) as Command,
);
