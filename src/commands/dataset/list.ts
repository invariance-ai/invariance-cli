import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printTable } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const datasetListCommand = new Command("list")
  .description("List datasets")
  .option("--agent-id <id>", "Filter by agent ID")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance dataset list
  $ invariance dataset list --limit 10
  $ invariance dataset list --json`,
  )
  .action(async (options: { agentId?: string }, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching datasets...").start();
      const result = await client.listDatasets({
        agentId: options.agentId,
      });
      spinner.stop();

      printTable(
        result,
        [
          { key: "id", label: "ID", width: 24 },
          { key: "name", label: "Name", width: 30 },
          { key: "row_count", label: "Rows", width: 10 },
          { key: "agent_id", label: "Agent ID", width: 24 },
          { key: "created_at", label: "Created", width: 20 },
        ],
        { json: globalOpts.json },
      );
    } catch (error) {
      handleError(error);
    }
  });
