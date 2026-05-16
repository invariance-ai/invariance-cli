import { Command } from "commander";
import ora from "ora";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";

const CASE_COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "workflow_key", label: "Workflow", width: 24 },
  { key: "tenant_id", label: "Tenant", width: 18 },
  { key: "status", label: "Status", width: 8 },
  { key: "outcome", label: "Outcome", width: 14 },
  { key: "opened_at", label: "Opened", width: 24 },
];

export const caseCommand = new Command("case").description(
  "Inspect and manage cases — workflow instances owning many runs across time, agents, and humans (one loan, one audit, one claim)",
);

caseCommand.addCommand(
  action(
    new Command("create")
      .description(
        "Create a case. Output (--json): {id, agent_id, tenant_id, end_user_id, workflow_key, status, outcome, owner, custom_attrs, opened_at, ...}",
      )
      .requiredOption("--workflow-key <key>", "Stable workflow id, e.g. 'mortgage.refi'")
      .option("--tenant-id <id>", "Your customer (the platform user / firm)")
      .option("--end-user-id <id>", "Human the workflow is acting on behalf of")
      .option("--owner <name>", "Assigned team or reviewer")
      .option("--custom-attrs <json>", "Domain attributes JSON object")
      .option("--opened-at <iso>", "ISO-8601 open time (defaults to now)")
      .addHelpText(
        "after",
        "\nExample:\n  $ invariance case create --workflow-key mortgage.refi --tenant-id acme --end-user-id u_42\n",
      ),
    async ({ client, globals, opts }) => {
      const c = await client.createCase({
        workflow_key: opts.workflowKey,
        tenant_id: opts.tenantId,
        end_user_id: opts.endUserId,
        owner: opts.owner,
        custom_attrs: parseJsonFlag("custom-attrs", opts.customAttrs) as
          | Record<string, unknown>
          | undefined,
        opened_at: opts.openedAt,
      });
      printValue(c, globals);
    },
  ) as Command,
);

caseCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List cases. Output (--json): {data: Case[], next_cursor}. Filter by tenant, workflow, status, or outcome.",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token")
      .option("--all", "Paginate through every page")
      .option("--tenant-id <id>")
      .option("--end-user-id <id>")
      .option("--workflow-key <key>")
      .option("--status <s>", "open | closed")
      .option("--outcome <o>"),
    async ({ client, globals, opts }) => {
      const useSpinner = !globals.json;
      const baseFilters = {
        tenant_id: opts.tenantId,
        end_user_id: opts.endUserId,
        workflow_key: opts.workflowKey,
        status: opts.status,
        outcome: opts.outcome,
      };
      if (opts.all) {
        let cursor: string | undefined;
        const all: unknown[] = [];
        const spinner = useSpinner ? ora("Fetching cases...").start() : null;
        do {
          const page = await client.listCases({ cursor, limit: opts.limit, ...baseFilters });
          all.push(...page.data);
          cursor = page.next_cursor ?? undefined;
        } while (cursor);
        spinner?.stop();
        printPage({ data: all }, CASE_COLUMNS, globals);
        return;
      }
      const spinner = useSpinner ? ora("Fetching cases...").start() : null;
      const page = await client.listCases({ cursor: opts.cursor, limit: opts.limit, ...baseFilters });
      spinner?.stop();
      printPage(page, CASE_COLUMNS, globals);
    },
  ) as Command,
);

caseCommand.addCommand(
  action(
    new Command("get")
      .description(
        "Show a case with its linked runs. Output (--json): {id, ..., runs: Run[]}",
      )
      .argument("<id>", "Case id, e.g. case_abc123"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getCase(cmd.args[0]!), globals);
    },
  ) as Command,
);

caseCommand.addCommand(
  action(
    new Command("update")
      .description("Update a case (status, owner, custom_attrs). Outcome is only valid when status=closed.")
      .argument("<id>")
      .option("--status <s>", "open | closed")
      .option("--outcome <o>")
      .option("--outcome-value-usd <n>", "Realized $ value", parseFloat)
      .option("--owner <name>")
      .option("--custom-attrs <json>", "Merged shallowly into existing attrs"),
    async ({ client, globals, opts, cmd }) => {
      const patch: Record<string, unknown> = {};
      if (opts.status) patch.status = opts.status;
      if (opts.outcome !== undefined) patch.outcome = opts.outcome;
      if (opts.outcomeValueUsd !== undefined) patch.outcome_value_usd = opts.outcomeValueUsd;
      if (opts.owner !== undefined) patch.owner = opts.owner;
      if (opts.customAttrs) patch.custom_attrs = parseJsonFlag("custom-attrs", opts.customAttrs);
      printValue(await client.updateCase(cmd.args[0]!, patch), globals);
    },
  ) as Command,
);

caseCommand.addCommand(
  action(
    new Command("close")
      .description("Close a case with an outcome. Sugar for `case update <id> --status closed --outcome <o>`.")
      .argument("<id>")
      .requiredOption("--outcome <o>", 'e.g. "approved", "denied", "escalated"')
      .option("--value-usd <n>", "Realized $ value", parseFloat),
    async ({ client, globals, opts, cmd }) => {
      const patch: Record<string, unknown> = { status: "closed", outcome: opts.outcome };
      if (opts.valueUsd !== undefined) patch.outcome_value_usd = opts.valueUsd;
      printValue(await client.updateCase(cmd.args[0]!, patch), globals);
    },
  ) as Command,
);
