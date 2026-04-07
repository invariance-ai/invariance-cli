import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printKeyValue, formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const evalRunCommand = new Command("run")
  .description("Run an evaluation on a dataset")
  .argument("<dataset-id>", "Dataset ID to evaluate")
  .option("--name <name>", "Name for the evaluation run")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance eval run ds_abc123
  $ invariance eval run ds_abc123 --name "nightly-eval"
  $ invariance eval run ds_abc123 --json`,
  )
  .action(async (datasetId: string, options: { name?: string }, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Running evaluation...").start();
      const result = await client.runEval(datasetId, { name: options.name });
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(result, { json: true });
      } else {
        printKeyValue({
          ID: result.id,
          Name: result.name ?? "—",
          "Dataset ID": result.dataset_id ?? "—",
          Status: result.status,
          Created: result.created_at ?? "—",
        });
      }
    } catch (error) {
      handleError(error);
    }
  });
