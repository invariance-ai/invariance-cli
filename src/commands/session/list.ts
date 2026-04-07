import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printTable } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const sessionListCommand = new Command("list")
  .description("List sessions")
  .option("--limit <n>", "Maximum number of sessions to return", parseInt)
  .option("--offset <n>", "Offset for pagination", parseInt)
  .option("--status <status>", "Filter by status (e.g. active, ended)")
  .option("--agent-id <id>", "Filter by agent ID")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance session list
  $ invariance session list --limit 10 --status open
  $ invariance session list --json`,
  )
  .action(async (
    options: { limit?: number; offset?: number; status?: string; agentId?: string },
    cmd: Command,
  ) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching sessions...").start();
      const result = await client.listSessions({
        limit: options.limit,
        offset: options.offset,
        status: options.status,
        agentId: options.agentId,
      });
      spinner.stop();

      printTable(
        result,
        [
          { key: "id", label: "ID", width: 24 },
          { key: "name", label: "Name", width: 24 },
          { key: "created_by", label: "Created By", width: 24 },
          { key: "status", label: "Status", width: 12 },
          { key: "created_at", label: "Created", width: 20 },
          { key: "closed_at", label: "Closed", width: 20 },
        ],
        { json: globalOpts.json },
      );
    } catch (error) {
      handleError(error);
    }
  });
