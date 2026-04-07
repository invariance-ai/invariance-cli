import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printKeyValue, formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const sessionGetCommand = new Command("get")
  .description("Get details of a specific session")
  .argument("<id>", "Session ID")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance session get sess_abc123
  $ invariance session get sess_abc123 --json`,
  )
  .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching session...").start();
      const session = await client.getSession(id);
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(session, { json: true });
      } else {
        printKeyValue({
          ID: session.id,
          "Trace ID": session.trace_id ?? "—",
          "Agent ID": session.agent_id ?? "—",
          Status: session.status,
          Started: session.started_at ?? "—",
          Ended: session.ended_at ?? "—",
        });
        if (session.metadata && Object.keys(session.metadata).length > 0) {
          console.log("\nMetadata:");
          console.log(JSON.stringify(session.metadata, null, 2));
        }
      }
    } catch (error) {
      handleError(error);
    }
  });
