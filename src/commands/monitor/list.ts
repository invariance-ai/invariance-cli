import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printTable } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const monitorListCommand = new Command("list")
  .description("List monitors")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance monitor list
  $ invariance monitor list --json`,
  )
  .action(async (_opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching monitors...").start();
      const result = await client.listMonitors();
      spinner.stop();

      printTable(
        result.data,
        [
          { key: "id", label: "ID", width: 24 },
          { key: "name", label: "Name", width: 30 },
          { key: "status", label: "Status", width: 12 },
          { key: "description", label: "Description", width: 40 },
        ],
        { json: globalOpts.json },
      );
    } catch (error) {
      handleError(error);
    }
  });
