import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printKeyValue, formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

function collectValues(value: string, previous: string[] = []): string[] {
  previous.push(value);
  return previous;
}

export const evalRunCommand = new Command("run")
  .description("Trigger an evaluation run for a suite")
  .argument("<suite-id>", "Eval suite ID")
  .requiredOption("--agent-id <id>", "Agent ID to evaluate")
  .option("--version-label <label>", "Version label for the run")
  .option(
    "--session-id <id>",
    "Session ID to include in the evaluation run; repeat to pass multiple",
    collectValues,
    [],
  )
  .addHelpText(
    "after",
    `
Examples:
  $ invariance eval run suite_abc123 --agent-id owner/agent
  $ invariance eval run suite_abc123 --agent-id owner/agent --session-id sess_1 --session-id sess_2
  $ invariance eval run suite_abc123 --agent-id owner/agent --json`,
  )
  .action(async (
    suiteId: string,
    options: { agentId: string; versionLabel?: string; sessionId?: string[] },
    cmd: Command,
  ) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Running evaluation...").start();
      const result = await client.runEval(suiteId, {
        agentId: options.agentId,
        versionLabel: options.versionLabel,
        sessionIds: options.sessionId,
      });
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(result, { json: true });
      } else {
        printKeyValue({
          ID: result.id,
          "Suite ID": result.suite_id,
          "Agent ID": result.agent_id,
          "Dataset ID": result.dataset_id ?? "—",
          Status: result.status,
          "Started At": result.started_at,
          Created: result.created_at ?? "—",
        });
      }
    } catch (error) {
      handleError(error);
    }
  });
