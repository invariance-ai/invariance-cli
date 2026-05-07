import { Command } from "commander";
import chalk from "chalk";
import { authSignup } from "../../lib/client.js";
import { resolveConfig, saveApiKey, saveSession } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { success } from "../../lib/output.js";

interface SignupOptions {
  email?: string;
  password?: string;
  signupType?: "individual" | "org";
  orgName?: string;
  projectName?: string;
  profile?: string;
  json?: boolean;
}

async function runSignup(options: SignupOptions): Promise<void> {
  try {
    if (!options.email) throw new Error("--email is required");
    if (!options.password) throw new Error("--password is required");

    const config = resolveConfig(options.profile);
    const res = await authSignup(config.baseUrl, {
      email: options.email,
      password: options.password,
      signup_type: options.signupType ?? "individual",
      org_name: options.orgName,
      project_name: options.projectName,
    });

    if (res.session) saveSession(res.session, options.profile);
    if (res.api_key_once) saveApiKey(res.api_key_once, options.profile);

    if (options.json) {
      process.stdout.write(JSON.stringify(res) + "\n");
      return;
    }

    success(`Signed up as ${res.user.email}.`);
    console.error(chalk.dim(`org: ${res.organization.name} (${res.organization.id})`));
    console.error(chalk.dim(`project: ${res.project.name} (${res.project.id})`));
    console.error(chalk.dim(`agent: ${res.agent.name} (${res.agent.id})`));
    if (res.api_key_once) {
      console.error(
        chalk.yellow(
          `\nAPI key (saved to config, shown once): ${res.api_key_once}`,
        ),
      );
    }
  } catch (error) {
    handleError(error);
  }
}

export function makeSignupCommand(name: string): Command {
  return new Command(name)
    .description("Create a new Invariance account, organization, project, and first agent")
    .requiredOption("--email <email>", "Email address")
    .requiredOption("--password <password>", "Password (min 8 chars)")
    .option("--signup-type <type>", "individual (default) or org", "individual")
    .option("--org-name <name>", "Organization name (required if --signup-type=org)")
    .option("--project-name <name>", "Initial project name (default: derived from email)")
    .option("--profile <name>", "Save credentials to a named profile")
    .action((options: SignupOptions, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ json?: boolean; profile?: string }>();
      return runSignup({ ...options, json: globals.json, profile: options.profile ?? globals.profile });
    });
}

export const signupCommand = makeSignupCommand("signup");
