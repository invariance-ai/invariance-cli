import { Command } from "commander";
import ora from "ora";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";

const RUN_COLUMNS = [
  { key: "id", label: "ID", width: 26 },
  { key: "name", label: "Name", width: 30 },
  { key: "status", label: "Status", width: 10 },
  { key: "created_at", label: "Created", width: 24 },
];

const NODE_COLUMNS = [
  { key: "id", label: "ID", width: 20 },
  { key: "action_type", label: "Action", width: 24 },
  { key: "type", label: "Type", width: 16 },
  { key: "timestamp", label: "Timestamp", width: 15 },
];

export const runCommand = new Command("run").description("Inspect and manage runs (agent execution sessions)");

runCommand.addCommand(
  action(
    new Command("start")
      .description("Start a new run")
      .option("--name <name>", "Run name")
      .option("--metadata <json>", "Metadata JSON object"),
    async ({ client, globals, opts }) => {
      const run = await client.startRun({
        name: opts.name,
        metadata: parseJsonFlag("metadata", opts.metadata) as Record<string, unknown> | undefined,
      });
      printValue(run, globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("list")
      .description("List runs")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Pagination cursor")
      .option("--all", "Paginate through every page"),
    async ({ client, globals, opts }) => {
      if (opts.all) {
        let cursor: string | undefined;
        const all: unknown[] = [];
        const spinner = ora("Fetching runs...").start();
        do {
          const page = await client.listRuns({ cursor, limit: opts.limit });
          all.push(...page.data);
          cursor = page.next_cursor ?? undefined;
        } while (cursor);
        spinner.stop();
        printPage({ data: all }, RUN_COLUMNS, globals);
        return;
      }
      const spinner = ora("Fetching runs...").start();
      const page = await client.listRuns({ cursor: opts.cursor, limit: opts.limit });
      spinner.stop();
      printPage(page, RUN_COLUMNS, globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(new Command("get").description("Show a run").argument("<id>"), async ({ client, globals, cmd }) => {
    const id = cmd.args[0]!;
    printValue(await client.getRun(id), globals);
  }) as Command,
);

runCommand.addCommand(
  action(
    new Command("update")
      .description("Update a run (status, metadata)")
      .argument("<id>")
      .option("--status <s>", "open | completed | failed")
      .option("--metadata <json>", "Metadata JSON"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      const patch: Record<string, unknown> = {};
      if (opts.status) patch.status = opts.status;
      if (opts.metadata) patch.metadata = parseJsonFlag("metadata", opts.metadata);
      printValue(await client.updateRun(id, patch), globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("cancel")
      .description("Mark a run as failed")
      .argument("<id>")
      .option("--reason <text>", "Failure reason"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      const patch: Record<string, unknown> = { status: "failed" };
      if (opts.reason) patch.metadata = { error: opts.reason };
      printValue(await client.updateRun(id, patch), globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("fork")
      .description("Fork a run from a checkpoint")
      .argument("<id>")
      .option("--from-node <node_id>", "Node id to fork from"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      printValue(await client.forkRun(id, opts.fromNode), globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("metrics").description("Show aggregate metrics for a run").argument("<id>"),
    async ({ client, globals, cmd }) => {
      const id = cmd.args[0]!;
      printValue(await client.runMetrics(id), globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("verify")
      .description("Verify the cryptographic proof chain for a run")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      const id = cmd.args[0]!;
      const spinner = ora("Verifying...").start();
      const proof = await client.verifyRun(id);
      spinner.stop();
      printValue(proof, globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("narrative")
      .description("Fetch the LLM-generated narrative for a run")
      .argument("<id>")
      .option("--refresh", "Force regeneration"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      printValue(await client.getRunNarrative(id, !!opts.refresh), globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("llm-calls")
      .description("List LLM calls in a run")
      .argument("<id>")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Pagination cursor"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      printValue(await client.runLlmCalls(id, { cursor: opts.cursor, limit: opts.limit }), globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("nodes")
      .description("List nodes for a run")
      .argument("<id>")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Pagination cursor"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      const page = await client.listRunNodes(id, { cursor: opts.cursor, limit: opts.limit });
      printPage(page, NODE_COLUMNS, globals);
    },
  ) as Command,
);
