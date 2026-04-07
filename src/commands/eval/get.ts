import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printKeyValue, formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const evalGetCommand = new Command("get")
  .description("Get details of a specific evaluation")
  .argument("<id>", "Evaluation ID")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance eval get eval_abc123
  $ invariance eval get eval_abc123 --json`,
  )
  .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching evaluation...").start();
      const evaluation = await client.getEval(id);
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(evaluation, { json: true });
      } else {
        printKeyValue({
          ID: evaluation.id,
          Name: evaluation.name ?? "—",
          "Dataset ID": evaluation.dataset_id ?? "—",
          Status: evaluation.status,
          Score: evaluation.score ?? "—",
          Created: evaluation.created_at ?? "—",
          Completed: evaluation.completed_at ?? "—",
        });
        if (evaluation.metrics && Object.keys(evaluation.metrics).length > 0) {
          console.log("\nMetrics:");
          console.log(JSON.stringify(evaluation.metrics, null, 2));
        }
      }
    } catch (error) {
      handleError(error);
    }
  });
