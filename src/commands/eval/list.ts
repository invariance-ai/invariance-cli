import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printTable } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const evalListCommand = new Command("list")
  .description("List evaluations")
  .option("--limit <n>", "Maximum number of evaluations to return", parseInt)
  .option("--dataset-id <id>", "Filter by dataset ID")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance eval list
  $ invariance eval list --limit 10 --dataset-id ds_abc123
  $ invariance eval list --json`,
  )
  .action(async (options: { limit?: number; datasetId?: string }, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching evaluations...").start();
      const result = await client.listEvals({
        limit: options.limit,
        datasetId: options.datasetId,
      });
      spinner.stop();

      printTable(
        result.data,
        [
          { key: "id", label: "ID", width: 24 },
          { key: "name", label: "Name", width: 24 },
          { key: "status", label: "Status", width: 12 },
          { key: "score", label: "Score", width: 10 },
          { key: "created_at", label: "Created", width: 20 },
        ],
        { json: globalOpts.json },
      );
    } catch (error) {
      handleError(error);
    }
  });
