import { Command } from "commander";
import { action, printValue } from "../../lib/cmd.js";

export const metricsCommand = new Command("metrics").description("Aggregate metrics");

metricsCommand.addCommand(
  action(
    new Command("overview")
      .description("Metrics overview across runs in a time window")
      .option("--from <iso>", "ISO lower bound")
      .option("--to <iso>", "ISO upper bound")
      .option("--project-id <id>", "Scope to project"),
    async ({ client, globals, opts }) => {
      printValue(
        await client.metricsOverview({ from: opts.from, to: opts.to, project_id: opts.projectId }),
        globals,
      );
    },
  ) as Command,
);
