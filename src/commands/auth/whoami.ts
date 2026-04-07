import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printKeyValue, formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const whoamiCommand = new Command("whoami")
  .description("Display the currently authenticated user")
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

      const spinner = ora("Fetching user info...").start();
      const user = await client.whoami();
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(user, { json: true });
      } else {
        printKeyValue({
          ID: user.id,
          Email: user.email,
          Name: user.name ?? "—",
          Organization: user.organization?.name ?? "—",
          "Org ID": user.organization?.id ?? "—",
        });
      }
    } catch (error) {
      handleError(error);
    }
  });
