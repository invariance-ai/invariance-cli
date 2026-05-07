import { Command } from "commander";
import chalk from "chalk";
import { authRefresh } from "../../lib/client.js";
import { resolveConfig, saveSession } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { AuthenticationError } from "../../lib/errors.js";
import { success } from "../../lib/output.js";

interface RefreshOptions {
  profile?: string;
  json?: boolean;
}

async function runRefresh(options: RefreshOptions): Promise<void> {
  try {
    const config = resolveConfig(options.profile);
    if (!config.session?.refresh_token) {
      throw new AuthenticationError(
        "No session to refresh. Run `inv auth signin` or `inv auth signup` first.",
      );
    }
    const res = await authRefresh(config.baseUrl, config.session.refresh_token);
    saveSession(res.session, options.profile);
    if (options.json) {
      process.stdout.write(JSON.stringify(res) + "\n");
      return;
    }
    success("Session refreshed.");
    console.error(
      chalk.dim(`Expires ${new Date(res.session.expires_at * 1000).toISOString()}.`),
    );
  } catch (error) {
    handleError(error);
  }
}

export function makeRefreshCommand(name: string): Command {
  return new Command(name)
    .description("Refresh the stored user session using its refresh token")
    .option("--profile <name>", "Use a named configuration profile")
    .action((options: RefreshOptions, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ json?: boolean; profile?: string }>();
      return runRefresh({ ...options, json: globals.json, profile: options.profile ?? globals.profile });
    });
}

export const refreshCommand = makeRefreshCommand("refresh");
