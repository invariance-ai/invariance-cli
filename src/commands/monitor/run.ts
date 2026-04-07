import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printKeyValue, formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const monitorRunCommand = new Command("run")
  .description("Run a monitor")
  .argument("<id>", "Monitor ID")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance monitor run mon_abc123
  $ invariance monitor run mon_abc123 --json`,
  )
  .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Running monitor...").start();
      const result = await client.runMonitor(id);
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(result, { json: true });
      } else {
        printKeyValue({
          "Run ID": result.id,
          "Monitor ID": result.monitor_id,
          Status: result.status,
          Created: result.created_at ?? "—",
        });
        if (result.result !== undefined) {
          console.log("\nResult:");
          console.log(JSON.stringify(result.result, null, 2));
        }
      }
    } catch (error) {
      handleError(error);
    }
  });
