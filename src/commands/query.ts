import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../lib/auth.js";
import { formatOutput } from "../lib/output.js";
import { handleError } from "../lib/errors.js";
import type { GlobalOptions } from "../types/index.js";

export const queryCommand = new Command("query")
  .description("Run a natural-language query against your traces")
  .argument("<prompt>", "The query prompt")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance query "Show me all failed traces from today"
  $ invariance query "What is the average latency?" --json`,
  )
  .action(async (prompt: string, _opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Running query...").start();
      const result = await client.query(prompt);
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(result, { json: true });
      } else {
        if (typeof result.result === "string") {
          console.log(result.result);
        } else {
          console.log(JSON.stringify(result.result, null, 2));
        }
        if (result.usage) {
          const tokens = (result.usage.prompt_tokens ?? 0) + (result.usage.completion_tokens ?? 0);
          if (tokens > 0) {
            console.log(`\n(${tokens} tokens used)`);
          }
        }
      }
    } catch (error) {
      handleError(error);
    }
  });
