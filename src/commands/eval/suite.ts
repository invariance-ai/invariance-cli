import { Command } from "commander";
import ora from "ora";
import { action, parseJsonFlag, printValue } from "../../lib/cmd.js";
import { printTable } from "../../lib/output.js";

/**
 * `inv eval suite <create|run>` — the agent-facing path for the
 * production-run → eval-case workflow. Wraps the platform suite endpoints
 * (POST /v1/eval-suites, POST /v1/eval-suites/:id/run) and surfaces the
 * inline `failures` + `results_url` that the API returns so a coding agent
 * can act on a regression without a second round-trip.
 */
export const suiteCommand = new Command("suite").description(
  "Eval suites: create a suite and run all its cases.",
);

suiteCommand.addCommand(
  action(
    new Command("create")
      .description(
        "Create an eval suite. Output (--json): EvalSuiteRecord.",
      )
      .requiredOption("--name <name>", "Suite name")
      .option("--description <text>", "Suite description")
      .option("--target-type <type>", 'Target kind: "run" (default) or "workflow"', "run")
      .option("--metadata <json>", "JSON metadata blob"),
    async ({ client, globals, opts }) => {
      const o = opts as {
        name: string;
        description?: string;
        targetType?: string;
        metadata?: string;
      };
      const suite = await client.createEvalSuite({
        name: o.name,
        description: o.description,
        target_type: o.targetType ?? "run",
        metadata: parseJsonFlag("metadata", o.metadata) as Record<string, unknown> | undefined,
      });
      printValue(suite, globals);
    },
  ) as Command,
);

suiteCommand.addCommand(
  action(
    new Command("run")
      .description(
        "Run every case in a suite. Output (--json): EvalRunRecord with " +
          "{failures: [{case_id, message, path?}], results_url?}.",
      )
      .argument("<suite_id>", "Suite id")
      .option("--baseline <runId>", "Optional baseline eval-run id for downstream compare")
      .option("--json", "Emit JSON (overrides global formatting)"),
    async ({ client, globals, opts, cmd }) => {
      const suiteId = cmd.processedArgs[0] as string;
      const o = opts as { baseline?: string };
      const spinner = globals.json ? null : ora(`Running suite ${suiteId}...`).start();
      const evalRun = await client.runEvalSuite(suiteId, {
        baseline_run_id: o.baseline,
      });
      spinner?.stop();

      if (globals.json) {
        printValue({ ...evalRun, id: evalRun.id }, globals);
        if (evalRun.status === "failed" || evalRun.status === "errored") {
          process.exitCode = 1;
        }
        return;
      }

      const summary = evalRun.summary as
        | { case_count?: number; passed?: number; failed?: number; errored?: number }
        | undefined;
      printValue(
        {
          id: evalRun.id,
          status: evalRun.status,
          case_count: summary?.case_count ?? 0,
          passed: summary?.passed ?? 0,
          failed: summary?.failed ?? 0,
          errored: summary?.errored ?? 0,
          results_url: evalRun.results_url ?? "",
        },
        globals,
      );
      if (evalRun.failures && evalRun.failures.length > 0) {
        printTable(
          evalRun.failures.map((f) => ({
            case_id: f.case_id,
            path: f.path ?? "",
            message: f.message,
          })),
          [
            { key: "case_id", label: "Case", width: 26 },
            { key: "path", label: "Path", width: 24 },
            { key: "message", label: "Message", width: 60 },
          ],
        );
      }
      if (evalRun.status === "failed" || evalRun.status === "errored") {
        process.exitCode = 1;
      }
    },
  ) as Command,
);
