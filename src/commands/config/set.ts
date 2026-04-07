import { Command } from "commander";
import { setConfigValue } from "../../lib/config.js";
import { success } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";

export const configSetCommand = new Command("set")
  .description("Set a configuration value")
  .argument("<key>", "Configuration key (e.g. apiKey, baseUrl, profiles.<name>.<key>)")
  .argument("<value>", "Value to set")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance config set baseUrl https://api.staging.invariance.ai
  $ invariance config set profiles.staging.baseUrl https://api.staging.invariance.ai`,
  )
  .action((key: string, value: string) => {
    try {
      setConfigValue(key, value);
      success(`Set ${key}.`);
    } catch (error) {
      handleError(error);
    }
  });
