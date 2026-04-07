import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printTable } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const datasetListCommand = new Command("list")
  .description("List datasets")
  .option("--limit <n>", "Maximum number of datasets to return", parseInt)
  .addHelpText(
    "after",
    `
Examples:
  $ invariance dataset list
  $ invariance dataset list --limit 10
  $ invariance dataset list --json`,
  )
  .action(async (options: { limit?: number }, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching datasets...").start();
      const result = await client.listDatasets({ limit: options.limit });
      spinner.stop();

      printTable(
        result.data,
        [
          { key: "id", label: "ID", width: 24 },
          { key: "name", label: "Name", width: 30 },
          { key: "size", label: "Size", width: 10 },
          { key: "created_at", label: "Created", width: 20 },
        ],
        { json: globalOpts.json },
      );
    } catch (error) {
      handleError(error);
    }
  });
