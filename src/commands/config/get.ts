import { Command } from "commander";
import { getConfigValue } from "../../lib/config.js";
import { formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const configGetCommand = new Command("get")
  .description("Read a configuration value")
  .argument("<key>", "Configuration key to read (e.g. apiKey, baseUrl, profiles.<name>.<key>)")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance config get baseUrl
  $ invariance config get apiKey --json
  $ invariance config get profiles.staging.apiKey`,
  )
  .action((key: string, _opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const value = getConfigValue(key, globalOpts.profile);

      if (globalOpts.json) {
        formatOutput({ key, value }, { json: true });
      } else if (value === undefined) {
        console.log(`(not set)`);
      } else {
        // Mask API keys in human output
        if (key.includes("apiKey") && typeof value === "string" && value.length > 8) {
          console.log(value.slice(0, 8) + "…" + value.slice(-4));
        } else {
          console.log(String(value));
        }
      }
    } catch (error) {
      handleError(error);
    }
  });
