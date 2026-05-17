import { Command } from "commander";
import ora from "ora";
import { action, parseIntFlag, printPage } from "../../lib/cmd.js";

const EVENT_COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "case_id", label: "Case", width: 28 },
  { key: "type", label: "Type", width: 30 },
  { key: "actor_type", label: "Actor", width: 12 },
  { key: "actor_id", label: "Actor ID", width: 18 },
  { key: "occurred_at", label: "Occurred", width: 24 },
];

export const eventCommand = new Command("event").description(
  "Inspect workflow events across cases. Events are semantic facts over run/node evidence.",
);

eventCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List workflow events. Filter by case, workflow, tenant, actor, type, or time window.",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token")
      .option("--all", "Paginate through every page")
      .option("--case-id <id>")
      .option("--tenant-id <id>")
      .option("--end-user-id <id>")
      .option("--workflow-key <key>")
      .option("--type <type>", "Event type, e.g. approval.requested")
      .option("--actor-type <type>", "human|agent|llm|service|integration|policy|system")
      .option("--actor-id <id>")
      .option("--from <iso>", "Only events at or after this ISO timestamp")
      .option("--to <iso>", "Only events before this ISO timestamp"),
    async ({ client, globals, opts }) => {
      const filters = {
        case_id: opts.caseId,
        tenant_id: opts.tenantId,
        end_user_id: opts.endUserId,
        workflow_key: opts.workflowKey,
        type: opts.type,
        actor_type: opts.actorType,
        actor_id: opts.actorId,
        from: opts.from,
        to: opts.to,
      };
      if (opts.all) {
        const spinner = globals.json ? null : ora("Fetching workflow events...").start();
        let cursor: string | undefined;
        const all: unknown[] = [];
        do {
          const page = await client.listWorkflowEvents({ ...filters, cursor, limit: opts.limit });
          all.push(...page.data);
          cursor = page.next_cursor ?? undefined;
        } while (cursor);
        spinner?.stop();
        printPage({ data: all }, EVENT_COLUMNS, globals);
        return;
      }

      const spinner = globals.json ? null : ora("Fetching workflow events...").start();
      const page = await client.listWorkflowEvents({
        ...filters,
        cursor: opts.cursor,
        limit: opts.limit,
      });
      spinner?.stop();
      printPage(page, EVENT_COLUMNS, globals);
    },
  ) as Command,
);
