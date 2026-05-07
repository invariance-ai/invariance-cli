import { Command } from "commander";
import { action, parseIntFlag, printValue } from "../../lib/cmd.js";

export const metricsCommand = new Command("metrics").description("Aggregate metrics");

metricsCommand.addCommand(
  action(
    new Command("overview")
      .description("Metrics overview across runs in a time window")
      .option("--window-hours <n>", "Time window in hours", parseIntFlag),
    async ({ client, globals, opts }) => {
      printValue(await client.metricsOverview({ window_hours: opts.windowHours }), globals);
    },
  ) as Command,
);

metricsCommand.addCommand(
  action(
    new Command("agents")
      .description("Per-agent activity rollup (node + handoff counts) in a time window")
      .option("--window-hours <n>", "Time window in hours", parseIntFlag),
    async ({ client, globals, opts }) => {
      printValue(await client.metricsAgents({ window_hours: opts.windowHours }), globals);
    },
  ) as Command,
);
