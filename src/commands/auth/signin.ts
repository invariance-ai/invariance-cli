import { Command } from "commander";
import chalk from "chalk";
import { authSignin } from "../../lib/client.js";
import { resolveConfig, saveSession } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { success } from "../../lib/output.js";

interface SigninOptions {
  email?: string;
  password?: string;
  profile?: string;
  json?: boolean;
}

async function runSignin(options: SigninOptions): Promise<void> {
  try {
    if (!options.email) throw new Error("--email is required");
    if (!options.password) throw new Error("--password is required");

    const config = resolveConfig(options.profile);
    const res = await authSignin(config.baseUrl, {
      email: options.email,
      password: options.password,
    });
    saveSession(res.session, options.profile);

    if (options.json) {
      process.stdout.write(JSON.stringify(res) + "\n");
      return;
    }
    success(`Signed in as ${res.user.email}.`);
    console.error(
      chalk.dim(
        `Session expires ${new Date(res.session.expires_at * 1000).toISOString()}.`,
      ),
    );
    console.error(chalk.dim("To get an API key for agent ops, run `inv auth issue-key`."));
  } catch (error) {
    handleError(error);
  }
}

export function makeSigninCommand(name: string): Command {
  return new Command(name)
    .description("Sign in to an existing Invariance account (email/password)")
    .requiredOption("--email <email>", "Email address")
    .requiredOption("--password <password>", "Password")
    .option("--profile <name>", "Save credentials to a named profile")
    .action((options: SigninOptions, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ json?: boolean; profile?: string }>();
      return runSignin({ ...options, json: globals.json, profile: options.profile ?? globals.profile });
    });
}

export const signinCommand = makeSigninCommand("signin");
