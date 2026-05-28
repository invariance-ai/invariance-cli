import { Command } from "commander";
import { action, parseJsonFlag, printValue } from "../../lib/cmd.js";

/**
 * `inv eval case create-from-run` — promote a production run into a regression
 * test in one command. Wraps POST /v1/eval-suites/:id/cases/from-run, which
 * snapshots the run + its nodes into the case input bundle and (when finding
 * or signal IDs are passed) carries the originating alert's evidence into
 * metadata.source_evidence.
 */
export const caseCommand = new Command("case").description(
  "Eval cases: create a regression case from a production run.",
);

caseCommand.addCommand(
  action(
    new Command("create-from-run")
      .description(
        "Snapshot a run (and optionally a finding/signal) into an eval case. " +
          "Output (--json): EvalCaseRecord.",
      )
      .requiredOption("--suite <id>", "Suite id to attach the case to")
      .requiredOption("--run <id>", "Source production run id")
      .option("--name <name>", "Case name (defaults to run name)")
      .option("--finding <id>", "Optional finding id whose evidence is copied into metadata")
      .option("--signal <id>", "Optional signal id whose evidence is copied into metadata")
      .option("--expected <json>", "EvalExpectedOutput JSON blob")
      .option("--assertions <json>", "EvalAssertion[] JSON array")
      .option("--mutations <json>", "CounterfactualReplayMutation[] JSON array")
      .option("--metadata <json>", "Free-form JSON metadata"),
    async ({ client, globals, opts }) => {
      const o = opts as {
        suite: string;
        run: string;
        name?: string;
        finding?: string;
        signal?: string;
        expected?: string;
        assertions?: string;
        mutations?: string;
        metadata?: string;
      };
      const caseRow = await client.createEvalCaseFromRun(o.suite, {
        source_run_id: o.run,
        source_finding_id: o.finding,
        source_signal_id: o.signal,
        name: o.name,
        expected: parseJsonFlag("expected", o.expected) as Record<string, unknown> | undefined,
        assertions: parseJsonFlag("assertions", o.assertions) as unknown[] | undefined,
        mutations: parseJsonFlag("mutations", o.mutations) as unknown[] | undefined,
        metadata: parseJsonFlag("metadata", o.metadata) as Record<string, unknown> | undefined,
      });
      printValue(caseRow, globals);
    },
  ) as Command,
);
