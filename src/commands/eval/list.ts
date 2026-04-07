import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printTable } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const evalListCommand = new Command("list")
  .description("List evaluation runs")
  .option("--suite-id <id>", "Filter by eval suite ID")
  .option("--agent-id <id>", "Filter by agent ID")
  .option("--status <status>", "Filter by status")
  .option("--dataset-id <id>", "Filter by dataset ID")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance eval list
  $ invariance eval list --suite-id suite_abc123 --agent-id owner/agent
  $ invariance eval list --json`,
  )
  .action(async (
    options: { suiteId?: string; agentId?: string; status?: string; datasetId?: string },
    cmd: Command,
  ) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching evaluation runs...").start();
      const result = await client.listEvals({
        suiteId: options.suiteId,
        agentId: options.agentId,
        status: options.status,
        datasetId: options.datasetId,
      });
      spinner.stop();

      printTable(
        result,
        [
          { key: "id", label: "ID", width: 24 },
          { key: "suite_id", label: "Suite ID", width: 24 },
          { key: "agent_id", label: "Agent ID", width: 24 },
          { key: "status", label: "Status", width: 12 },
          { key: "pass_rate", label: "Pass Rate", width: 10 },
          { key: "created_at", label: "Created", width: 20 },
        ],
        { json: globalOpts.json },
      );
    } catch (error) {
      handleError(error);
    }
  });
