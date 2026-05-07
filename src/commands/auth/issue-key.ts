import { Command } from "commander";
import chalk from "chalk";
import { hostname } from "node:os";
import { getSessionClient } from "../../lib/auth.js";
import { saveApiKey } from "../../lib/config.js";
import { handleError } from "../../lib/errors.js";
import { success } from "../../lib/output.js";
import { parseIntFlag } from "../../lib/cmd.js";

interface IssueKeyOptions {
  hostname?: string;
  projectId?: string;
  expiresInDays?: number;
  noSave?: boolean;
  profile?: string;
  json?: boolean;
}

async function runIssueKey(options: IssueKeyOptions): Promise<void> {
  try {
    const client = getSessionClient(options.profile);
    const res = await client.issueCliToken({
      hostname: options.hostname ?? hostname(),
      project_id: options.projectId,
      expires_in_days: options.expiresInDays,
    });

    if (!options.noSave && res.api_key_once) {
      saveApiKey(res.api_key_once, options.profile);
    }

    if (options.json) {
      process.stdout.write(JSON.stringify(res) + "\n");
      return;
    }
    success(`Issued API key for agent ${res.agent.name} (${res.agent.id}).`);
    console.error(chalk.yellow(`API key (shown once): ${res.api_key_once}`));
    if (!options.noSave) console.error(chalk.dim("Saved to config."));
  } catch (error) {
    handleError(error);
  }
}

export function makeIssueKeyCommand(name: string): Command {
  return new Command(name)
    .description("Mint an API key bound to one of your projects (uses your signed-in user session)")
    .option("--hostname <name>", "Label fragment for the new key (default: this machine's hostname)")
    .option("--project-id <id>", "Project to bind the key to (default: first accessible project)")
    .option("--expires-in-days <n>", "Optional expiry in days", parseIntFlag)
    .option("--no-save", "Do not write the new API key to config")
    .option("--profile <name>", "Use a named configuration profile")
    .action((options: IssueKeyOptions, cmd: Command) => {
      const globals = cmd.optsWithGlobals<{ json?: boolean; profile?: string }>();
      return runIssueKey({
        ...options,
        json: globals.json,
        profile: options.profile ?? globals.profile,
      });
    });
}

export const issueKeyCommand = makeIssueKeyCommand("issue-key");
