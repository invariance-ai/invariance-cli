import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printTable } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const signalListCommand = new Command("list")
  .description("List signals")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance signal list
  $ invariance signal list --json`,
  )
  .action(async (_opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching signals...").start();
      const result = await client.listSignals();
      spinner.stop();

      printTable(
        result.data,
        [
          { key: "id", label: "ID", width: 24 },
          { key: "name", label: "Name", width: 30 },
          { key: "severity", label: "Severity", width: 12 },
          { key: "description", label: "Description", width: 40 },
        ],
        { json: globalOpts.json },
      );
    } catch (error) {
      handleError(error);
    }
  });
