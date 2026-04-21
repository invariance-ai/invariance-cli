import { Command } from "commander";
import { clearConfig } from "../../lib/config.js";
import { success } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";

export function makeLogoutCommand(name: string): Command {
  return new Command(name)
    .description("Clear stored Invariance credentials")
    .addHelpText(
      "after",
      `
Examples:
  $ invariance logout
  $ invariance auth logout`,
    )
    .action(() => {
      try {
        clearConfig();
        success("Credentials cleared.");
      } catch (error) {
        handleError(error);
      }
    });
}

export const logoutCommand = makeLogoutCommand("logout");
