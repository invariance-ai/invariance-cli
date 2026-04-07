import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printTable } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const traceListCommand = new Command("list")
  .description("List traces")
  .option("--limit <n>", "Maximum number of traces to return", parseInt)
  .option("--status <status>", "Filter by status (e.g. completed, running, failed)")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance trace list
  $ invariance trace list --limit 10 --status completed
  $ invariance trace list --json`,
  )
  .action(async (options: { limit?: number; status?: string }, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching traces...").start();
      const result = await client.listTraces({
        limit: options.limit,
        status: options.status,
      });
      spinner.stop();

      printTable(
        result.data,
        [
          { key: "id", label: "ID", width: 24 },
          { key: "status", label: "Status", width: 12 },
          { key: "name", label: "Name", width: 30 },
          { key: "created_at", label: "Created", width: 20 },
          { key: "duration_ms", label: "Duration (ms)", width: 14 },
        ],
        { json: globalOpts.json },
      );
    } catch (error) {
      handleError(error);
    }
  });
