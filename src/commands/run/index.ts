import { Command } from "commander";
import ora from "ora";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";
import { paginate } from "../../lib/paginate.js";
import type { Finding } from "../../types/index.js";

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
      .description(
        "Start a new run. Output (--json): {id, agent_id, name, status, metadata, created_at, updated_at, parent_run_id, fork_point_node_id, total_input_tokens, total_output_tokens, llm_call_count, tool_call_count, ...}",
      )
      .option("--name <name>", "Run name")
      .option("--metadata <json>", "Metadata JSON object")
      .addHelpText(
        "after",
        "\nExample:\n  $ invariance run start --name 'nightly-eval' --metadata '{\"env\":\"prod\"}'\n",
      ),
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
      .description(
        "List runs. Output (--json): {data: Run[], next_cursor} where Run = {id, agent_id, name, status, created_at, updated_at, ...}",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor")
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
  action(
    new Command("get")
      .description(
        "Show a run. Output (--json): {id, agent_id, name, status, metadata, created_at, updated_at, closed_at, parent_run_id, total_input_tokens, total_output_tokens, llm_call_count, tool_call_count, ...}",
      )
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      const id = cmd.args[0]!;
      printValue(await client.getRun(id), globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("update")
      .description(
        "Update a run (status, metadata). Output (--json): the updated Run = {id, agent_id, name, status, metadata, created_at, updated_at, closed_at, ...}",
      )
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
      .description(
        "Mark a run as failed. Output (--json): the updated Run = {id, status: 'failed', metadata, ...}",
      )
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
      .description(
        "Fork a run from a checkpoint. Output (--json): the new forked Run = {id, parent_run_id, fork_point_node_id, status: 'open', ...}",
      )
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
    new Command("metrics")
      .description(
        "Show aggregate metrics for a run. Output (--json): {run_id, total_input_tokens, total_output_tokens, llm_call_count, tool_call_count, cost_usd, latency_ms, ...}",
      )
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      const id = cmd.args[0]!;
      printValue(await client.runMetrics(id), globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("verify")
      .description(
        "Verify the cryptographic proof chain for a run. Output (--json): {run_id, valid, node_count, broken_links, ...}",
      )
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
      .description(
        "Fetch the LLM-generated narrative for a run. Output (--json): {run_id, summary, scorer, sections, generated_at, ...}",
      )
      .argument("<id>")
      .option("--refresh", "Force regeneration")
      // Narrative is a single document (not paginated); --all is accepted for
      // symmetry with other run subcommands and is a no-op here.
      .option("--all", "Reserved for symmetry; narrative is a single document"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      printValue(await client.getRunNarrative(id, !!opts.refresh), globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("llm-calls")
      .description(
        "List LLM calls in a run. Output (--json): {data: LlmCall[], next_cursor} where LlmCall = {id, run_id, node_id, agent_id, provider, model, input_tokens, output_tokens, cache_read_tokens, ...}",
      )
      .argument("<id>")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor")
      .option("--all", "Cursor-walk every page and emit a single combined result"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      if (opts.all) {
        const data = await paginate(async (cursor) => {
          const r = (await client.runLlmCalls(id, { cursor, limit: opts.limit })) as {
            data: unknown[];
            next_cursor?: string | null;
          };
          return { data: r.data ?? [], next_cursor: r.next_cursor };
        });
        printValue({ data }, globals);
        return;
      }
      printValue(await client.runLlmCalls(id, { cursor: opts.cursor, limit: opts.limit }), globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("nodes")
      .description(
        "List nodes for a run. Output (--json): {data: Node[], next_cursor} where Node = {id, run_id, agent_id, parent_id, action_type, type, input, output, error, metadata, timestamp, hash, ...}",
      )
      .argument("<id>")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor")
      .option("--all", "Cursor-walk every page and emit a single combined result"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      if (opts.all) {
        const data = await paginate((cursor) =>
          client.listRunNodes(id, { cursor, limit: opts.limit }),
        );
        printPage({ data }, NODE_COLUMNS, globals);
        return;
      }
      const page = await client.listRunNodes(id, { cursor: opts.cursor, limit: opts.limit });
      printPage(page, NODE_COLUMNS, globals);
    },
  ) as Command,
);

runCommand.addCommand(
  action(
    new Command("inspect")
      .description(
        "Composite triage view for a run: returns {run, metrics, narrative, recent_nodes, open_findings} as JSON.",
      )
      .argument("<id>")
      .option(
        "--limit <n>",
        "Max nodes/llm-calls subsection size (default 50)",
        parseIntFlag,
        50,
      ),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.args[0]!;
      const limit: number = opts.limit ?? 50;

      const [run, metrics, narrative, nodesPage, findingsPage] = await Promise.all([
        client.getRun(id).catch(() => null),
        client.runMetrics(id).catch(() => null),
        client.getRunNarrative(id).catch(() => null),
        client.listRunNodes(id, { limit }).catch(() => ({ data: [] as unknown[] })),
        // /v1/findings does not accept a run_id filter today (future API gap),
        // so fetch a page and filter client-side for run_id + status=open.
        client
          .listFindings({ limit: Math.max(limit, 50) })
          .catch(() => ({ data: [] as Finding[] })),
      ]);

      const open_findings = (findingsPage.data as Finding[]).filter(
        (f) => f.run_id === id && f.status === "open",
      );

      const result = {
        run,
        metrics,
        narrative,
        recent_nodes: nodesPage.data,
        open_findings,
      };

      // Composite output is naturally structured; default to JSON regardless
      // of the global --json flag. Compact when --json was set, else pretty.
      if (globals.json) {
        process.stdout.write(JSON.stringify(result) + "\n");
      } else {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      }
    },
  ) as Command,
);
