import { Command } from "commander";
import { clearConfig } from "../../lib/config.js";
import { success } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";

export const logoutCommand = new Command("logout")
  .description("Clear stored Invariance credentials")
  .addHelpText(
    "after",
    `
Examples:
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
