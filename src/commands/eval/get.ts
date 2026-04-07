import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printKeyValue, formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const evalGetCommand = new Command("get")
  .description("Get details of a specific evaluation run")
  .argument("<id>", "Evaluation run ID")
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

      const spinner = ora("Fetching evaluation run...").start();
      const evaluation = await client.getEval(id);
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(evaluation, { json: true });
      } else {
        printKeyValue({
          ID: evaluation.id,
          "Suite ID": evaluation.suite_id,
          "Agent ID": evaluation.agent_id,
          "Dataset ID": evaluation.dataset_id ?? "—",
          Status: evaluation.status,
          "Pass Rate": evaluation.pass_rate ?? "—",
          "Avg Score": evaluation.avg_score ?? "—",
          "Started At": evaluation.started_at,
          "Completed At": evaluation.completed_at ?? "—",
          Created: evaluation.created_at ?? "—",
          "Source Type": evaluation.source_type ?? "—",
        });
        if (evaluation.results && evaluation.results.length > 0) {
          console.log(`\nResults: ${evaluation.results.length}`);
        }
      }
    } catch (error) {
      handleError(error);
    }
  });
