import { Command } from "commander";
import ora from "ora";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { printKeyValue, formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

export const datasetGetCommand = new Command("get")
  .description("Get details of a specific dataset")
  .argument("<id>", "Dataset ID")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance dataset get ds_abc123
  $ invariance dataset get ds_abc123 --json`,
  )
  .action(async (id: string, _opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globalOpts.profile);

      const spinner = ora("Fetching dataset...").start();
      const dataset = await client.getDataset(id);
      spinner.stop();

      if (globalOpts.json) {
        formatOutput(dataset, { json: true });
      } else {
        printKeyValue({
          ID: dataset.id,
          Name: dataset.name,
          Description: dataset.description ?? "—",
          "Agent ID": dataset.agent_id ?? "—",
          "Row Count": dataset.row_count,
          "Draft Version": dataset.current_draft_version,
          "Published Version": dataset.latest_published_version,
          Created: dataset.created_at,
          Updated: dataset.updated_at,
        });
      }
    } catch (error) {
      handleError(error);
    }
  });
