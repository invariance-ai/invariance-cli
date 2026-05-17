import { Command } from "commander";
import ora from "ora";
import { action, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";

const WORKFLOW_COLUMNS = [
  { key: "key", label: "Key", width: 28 },
  { key: "display_name", label: "Name", width: 28 },
  { key: "description", label: "Description", width: 36 },
  { key: "updated_at", label: "Updated", width: 24 },
];

function definitionBody(
  opts: Record<string, unknown>,
  includeKey: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (includeKey && typeof opts.key === "string") body.key = opts.key;
  if (typeof opts.displayName === "string") body.display_name = opts.displayName;
  if (typeof opts.description === "string") body.description = opts.description;
  if (opts.description === null) body.description = null;
  if (typeof opts.expectedFields === "string") {
    body.expected_fields = parseJsonFlag("expected-fields", opts.expectedFields);
  }
  if (typeof opts.expectedSteps === "string") {
    body.expected_steps = parseJsonFlag("expected-steps", opts.expectedSteps);
  }
  if (typeof opts.allowedOutcomes === "string") {
    body.allowed_outcomes = parseJsonFlag("allowed-outcomes", opts.allowedOutcomes);
  }
  if (typeof opts.customMetrics === "string") {
    body.custom_metrics = parseJsonFlag("custom-metrics", opts.customMetrics);
  }
  return body;
}

export const workflowCommand = new Command("workflow").description(
  "Manage workflow definitions: typed fields, required steps, outcomes, and custom metrics.",
);

workflowCommand.addCommand(
  action(
    new Command("list").description("List workflow definitions."),
    async ({ client, globals }) => {
      const spinner = globals.json ? null : ora("Fetching workflow definitions...").start();
      const data = await client.listWorkflowDefinitions();
      spinner?.stop();
      printPage({ data }, WORKFLOW_COLUMNS, globals);
    },
  ) as Command,
);

workflowCommand.addCommand(
  action(
    new Command("get")
      .description("Show one workflow definition.")
      .argument("<key>", "Workflow key, e.g. support.escalation"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getWorkflowDefinition(cmd.args[0]!), globals);
    },
  ) as Command,
);

workflowCommand.addCommand(
  action(
    new Command("create")
      .description("Create a workflow definition.")
      .requiredOption("--key <key>", "Stable workflow id, e.g. support.escalation")
      .requiredOption("--display-name <name>", "Human display name")
      .option("--description <text>")
      .option("--expected-fields <json>", "JSON array of typed fields")
      .option("--expected-steps <json>", "JSON array of required/optional step definitions")
      .option("--allowed-outcomes <json>", "JSON array of allowed outcome definitions")
      .option("--custom-metrics <json>", "JSON array of custom metric widgets"),
    async ({ client, globals, opts }) => {
      printValue(await client.createWorkflowDefinition(definitionBody(opts, true)), globals);
    },
  ) as Command,
);

workflowCommand.addCommand(
  action(
    new Command("update")
      .description("Patch a workflow definition.")
      .argument("<key>", "Workflow key")
      .option("--display-name <name>", "Human display name")
      .option("--description <text>")
      .option("--clear-description", "Set description to null")
      .option("--expected-fields <json>", "JSON array of typed fields")
      .option("--expected-steps <json>", "JSON array of required/optional step definitions")
      .option("--allowed-outcomes <json>", "JSON array of allowed outcome definitions")
      .option("--custom-metrics <json>", "JSON array of custom metric widgets"),
    async ({ client, globals, opts, cmd }) => {
      const body = definitionBody(
        { ...opts, description: opts.clearDescription ? null : opts.description },
        false,
      );
      printValue(await client.updateWorkflowDefinition(cmd.args[0]!, body), globals);
    },
  ) as Command,
);

workflowCommand.addCommand(
  action(
    new Command("delete")
      .description("Delete a workflow definition. Existing cases/runs/events are retained.")
      .argument("<key>", "Workflow key"),
    async ({ client, globals, cmd }) => {
      await client.deleteWorkflowDefinition(cmd.args[0]!);
      printValue({ ok: true }, globals);
    },
  ) as Command,
);
