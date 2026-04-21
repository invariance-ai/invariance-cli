import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printKeyValue, formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const whoamiCommand = new Command("whoami")
  .description("Display the currently authenticated agent")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance auth whoami
  $ invariance auth whoami --json`,
  )
  .action(async (_opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching identity...").start();
      const me = await client.me();
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(me, { json: true });
      } else {
        printKeyValue({
          "Agent ID": me.agent.id,
          Name: me.agent.name,
          Project: me.agent.project_id,
          "Public key": me.agent.public_key ?? "—",
          "API key": me.api_key ? `${me.api_key.prefix}_*** (${me.api_key.label})` : "—",
        });
      }
    } catch (error) {
      handleError(error);
    }
  });
