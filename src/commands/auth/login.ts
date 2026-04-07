import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createInterface } from "node:readline";
import { resolveConfig, saveApiKey } from "../../lib/config.js";
import { validateApiKey } from "../../lib/auth.js";
import { success } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";

async function promptForApiKey(): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve) => {
    rl.question(chalk.bold("Enter your Invariance API key: "), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export const loginCommand = new Command("login")
  .description("Authenticate with the Invariance API")
  .option("--api-key <key>", "API key (or enter interactively)")
  .option("--profile <name>", "Save credentials to a named profile")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance auth login
  $ invariance auth login --api-key inv_sk_...
  $ invariance auth login --profile staging --api-key inv_sk_...`,
  )
  .action(async (options: { apiKey?: string; profile?: string }) => {
    try {
      const apiKey = options.apiKey ?? (await promptForApiKey());

      if (!apiKey) {
        console.error("Error: API key cannot be empty.");
        process.exit(1);
      }

      const config = resolveConfig(options.profile);
      const spinner = ora("Validating API key...").start();

      const result = await validateApiKey(apiKey, config.baseUrl);

      if (!result.valid) {
        spinner.fail(`Validation failed: ${result.error}`);
        process.exit(1);
      }

      spinner.succeed("API key is valid.");

      saveApiKey(apiKey, options.profile);

      if (options.profile) {
        success(`Credentials saved to profile '${options.profile}'.`);
      } else {
        success("Credentials saved.");
      }
    } catch (error) {
      handleError(error);
    }
  });
