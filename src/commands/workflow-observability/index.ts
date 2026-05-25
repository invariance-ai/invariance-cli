import { Command } from "commander";
import { action, printPage, printValue } from "../../lib/cmd.js";

const ROLLUP_COLUMNS = [
  { key: "workflow_key", label: "Workflow", width: 28 },
  { key: "execution_count", label: "Execs", width: 8 },
  { key: "open_count", label: "Open", width: 8 },
  { key: "stale_open_count", label: "Stale", width: 8 },
  { key: "failed_run_count", label: "Failed", width: 8 },
  { key: "total_cost_usd", label: "Cost($)", width: 10 },
];

const EXEC_COLUMNS = [
  { key: "case_id", label: "Case", width: 28 },
  { key: "status", label: "Status", width: 8 },
  { key: "health", label: "Health", width: 12 },
  { key: "stale", label: "Stale", width: 7 },
  { key: "error_count", label: "Errors", width: 8 },
  { key: "total_cost_usd", label: "Cost($)", width: 10 },
];

export const workflowObservabilityCommand = new Command("workflow-observability").description(
  "Read-only workflow health rollups: per-workflow execution counts, staleness, errors, cost.",
);

workflowObservabilityCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List per-workflow observability rollups. Maps to GET /v1/workflow-observability. Output (--json): {data: WorkflowObservabilityRollup[], next_cursor: null} where each rollup = {workflow_key, execution_count, open_count, closed_count, stale_open_count, missing_outcome_count, failed_run_count, node_error_count, event_count, run_count, capture_count, node_count, executions_with_{events,runs,captures,nodes}, total_cost_usd, total_input_tokens, total_output_tokens, avg_duration_ms, first_seen_at, last_seen_at}",
      ),
    async ({ client, globals }) => {
      printPage(await client.listWorkflowObservability(), ROLLUP_COLUMNS, globals);
    },
  ) as Command,
);

workflowObservabilityCommand.addCommand(
  action(
    new Command("get")
      .description(
        "Show one workflow's observability rollup. Maps to GET /v1/workflow-observability/:workflow_key. Output (--json): the WorkflowObservabilityRollup object.",
      )
      .argument("<workflow-key>", "Workflow key, e.g. support.escalation"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getWorkflowObservability(cmd.args[0]!), globals);
    },
  ) as Command,
);

workflowObservabilityCommand.addCommand(
  action(
    new Command("executions")
      .description(
        "List per-execution health for a workflow. Maps to GET /v1/workflow-observability/:workflow_key/executions. Output (--json): {data: WorkflowExecutionHealth[], next_cursor: null} where each = {case_id, workflow_key, status, opened_at, closed_at, last_seen_at, stale, health, reasons, event_count, run_count, capture_count, node_count, error_count, total_cost_usd, total_tokens, evidence_mix:{events,runs,captures,nodes}}",
      )
      .argument("<workflow-key>", "Workflow key, e.g. support.escalation"),
    async ({ client, globals, cmd }) => {
      printPage(await client.listWorkflowExecutions(cmd.args[0]!), EXEC_COLUMNS, globals);
    },
  ) as Command,
);
