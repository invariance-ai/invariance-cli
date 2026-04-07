import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printKeyValue, formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const traceGetCommand = new Command("get")
  .description("Get details of a specific trace")
  .argument("<id>", "Trace ID")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance trace get tr_abc123
  $ invariance trace get tr_abc123 --json`,
  )
  .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching trace...").start();
      const trace = await client.getTrace(id);
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(trace, { json: true });
      } else {
        printKeyValue({
          ID: trace.id,
          Status: trace.status,
          Name: trace.name ?? "—",
          Created: trace.created_at,
          Updated: trace.updated_at ?? "—",
          "Duration (ms)": trace.duration_ms ?? "—",
        });
        if (trace.metadata && Object.keys(trace.metadata).length > 0) {
          console.log("\nMetadata:");
          console.log(JSON.stringify(trace.metadata, null, 2));
        }
      }
    } catch (error) {
      handleError(error);
    }
  });
