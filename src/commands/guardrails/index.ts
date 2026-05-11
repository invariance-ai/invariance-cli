import { Command } from "commander";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";
import type { GuardrailStatus } from "../../types/index.js";

const COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "title", label: "Title", width: 32 },
  { key: "mode", label: "Mode", width: 16 },
  { key: "status", label: "Status", width: 16 },
];

const STATUS_VALUES: GuardrailStatus[] = [
  "suggested",
  "accepted",
  "shadow",
  "active_monitor",
  "rejected",
];

function parseStatus(value: string): GuardrailStatus {
  if (!(STATUS_VALUES as string[]).includes(value)) {
    throw new Error(
      `--status must be one of: ${STATUS_VALUES.join(", ")}`,
    );
  }
  return value as GuardrailStatus;
}

export const guardrailsCommand = new Command("guardrails").description(
  "Manage per-agent guardrails and their lifecycle.",
);

guardrailsCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List guardrails. Output (--json): {data: Guardrail[], next_cursor} where Guardrail = {id, agent_id, recipe_id, finding_id, title, rule, mode, status, monitor_id, ...}",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Opaque pagination token")
      .option("--status <status>", "Filter by status")
      .option("--recipe <recipe-id>", "Filter by originating recipe id"),
    async ({ client, globals, opts }) => {
      const page = await client.listGuardrails({
        cursor: opts.cursor as string | undefined,
        limit: opts.limit as number | undefined,
        status: opts.status ? parseStatus(opts.status as string) : undefined,
        recipe_id: opts.recipe as string | undefined,
      });
      printPage(page, COLUMNS, globals);
    },
  ) as Command,
);

guardrailsCommand.addCommand(
  action(
    new Command("get")
      .description("Show a guardrail. Output (--json): full Guardrail object.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getGuardrail(cmd.args[0]!), globals);
    },
  ) as Command,
);

guardrailsCommand.addCommand(
  action(
    new Command("promote")
      .description(
        "Promote a guardrail along its lifecycle. Valid transitions: suggested → accepted → shadow → active_monitor (rejected also allowed).",
      )
      .argument("<id>")
      .requiredOption(
        "--to <status>",
        "suggested | accepted | shadow | active_monitor | rejected",
        (value: string) => parseStatus(value),
      ),
    async ({ client, globals, opts, cmd }) => {
      printValue(
        await client.promoteGuardrail(cmd.args[0]!, opts.to as GuardrailStatus),
        globals,
      );
    },
  ) as Command,
);
