import { Command } from "commander";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";
import {
  DivergenceKindSchema,
  DivergenceStatusSchema,
  type DivergenceKind,
  type DivergenceStatus,
} from "../../types/index.js";

const COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "kind", label: "Kind", width: 18 },
  { key: "severity", label: "Severity", width: 10 },
  { key: "title", label: "Title", width: 34 },
  { key: "status", label: "Status", width: 20 },
];

function parseStatus(value: string): DivergenceStatus {
  const parsed = DivergenceStatusSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`--status must be one of: ${DivergenceStatusSchema.options.join(", ")}`);
  }
  return parsed.data;
}

export const divergenceCommand = new Command("divergence").description(
  "Inspect run-level divergences (intent/policy/workflow/outcome deviations) and resolve them.",
);

divergenceCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List divergences. Maps to GET /v1/divergences. Output (--json): {data: Divergence[], next_cursor} where Divergence = {id, agent_id, run_id, kind, severity, title, summary, expected, observed, evidence, suggested_action, confidence, status, created_at, updated_at}",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor")
      .option("--run <run_id>", "Filter by run id")
      .option("--kind <kind>", `Filter by kind: ${DivergenceKindSchema.options.join(", ")}`)
      .option("--severity <sev>", "Filter by severity (info|low|medium|high|critical)")
      .option("--status <status>", `Filter by status: ${DivergenceStatusSchema.options.join(", ")}`),
    async ({ client, globals, opts }) => {
      const page = await client.listDivergences({
        cursor: opts.cursor,
        limit: opts.limit,
        run_id: opts.run,
        kind: opts.kind ? (opts.kind as DivergenceKind) : undefined,
        severity: opts.severity,
        status: opts.status ? parseStatus(opts.status) : undefined,
      });
      printPage(page, COLUMNS, globals);
    },
  ) as Command,
);

divergenceCommand.addCommand(
  action(
    new Command("get")
      .description("Show a divergence. Maps to GET /v1/divergences/:id. Output (--json): full Divergence object.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getDivergence(cmd.args[0]!), globals);
    },
  ) as Command,
);

divergenceCommand.addCommand(
  action(
    new Command("update")
      .description(
        "Update a divergence's status. Maps to PATCH /v1/divergences/:id. Output (--json): the updated Divergence.",
      )
      .argument("<id>")
      .requiredOption(
        "--status <status>",
        `open | accepted | dismissed | converted_to_monitor`,
        (value: string) => parseStatus(value),
      ),
    async ({ client, globals, opts, cmd }) => {
      printValue(
        await client.updateDivergence(cmd.args[0]!, opts.status as DivergenceStatus),
        globals,
      );
    },
  ) as Command,
);
