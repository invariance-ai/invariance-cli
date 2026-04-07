import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printTable } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const sessionListCommand = new Command("list")
  .description("List sessions")
  .option("--limit <n>", "Maximum number of sessions to return", parseInt)
  .option("--status <status>", "Filter by status (e.g. active, ended)")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance session list
  $ invariance session list --limit 10 --status active
  $ invariance session list --json`,
  )
  .action(async (options: { limit?: number; status?: string }, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching sessions...").start();
      const result = await client.listSessions({
        limit: options.limit,
        status: options.status,
      });
      spinner.stop();

      printTable(
        result.data,
        [
          { key: "id", label: "ID", width: 24 },
          { key: "agent_id", label: "Agent ID", width: 20 },
          { key: "status", label: "Status", width: 12 },
          { key: "started_at", label: "Started", width: 20 },
          { key: "ended_at", label: "Ended", width: 20 },
        ],
        { json: globalOpts.json },
      );
    } catch (error) {
      handleError(error);
    }
  });
