import { Command } from "commander";
import ora from "ora";
import { action, printValue } from "../../lib/cmd.js";
import { printTable } from "../../lib/output.js";
import type { InvarianceClient } from "../../lib/client.js";
import type {
  EvalResultRecord,
  EvalRunRecord,
  ScorerSpec,
} from "../../types/index.js";

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function parseScorers(arg: string): ScorerSpec[] {
  return arg
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((name) => ({ name }));
}

async function waitForCompletion(
  client: InvarianceClient,
  evalRunId: string,
): Promise<EvalRunRecord> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const run = await client.getEvalRun(evalRunId);
    if (run.status !== "queued" && run.status !== "running") return run;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out waiting for eval run ${evalRunId} to finish`);
}

function aggregateScores(
  results: EvalResultRecord[],
): Array<{ scorer: string; mean: number; count: number }> {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const r of results) {
    for (const [scorer, value] of Object.entries(r.scores ?? {})) {
      if (typeof value !== "number" || Number.isNaN(value)) continue;
      const cur = totals.get(scorer) ?? { sum: 0, count: 0 };
      cur.sum += value;
      cur.count += 1;
      totals.set(scorer, cur);
    }
  }
  return [...totals.entries()].map(([scorer, { sum, count }]) => ({
    scorer,
    mean: count === 0 ? 0 : sum / count,
    count,
  }));
}

async function collectResults(
  client: InvarianceClient,
  evalRunId: string,
): Promise<EvalResultRecord[]> {
  const all: EvalResultRecord[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 50; i++) {
    const page = await client.listEvalResults(evalRunId, { cursor, limit: 100 });
    all.push(...page.data);
    if (!page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return all;
}

export const experimentCommand = new Command("experiment").description(
  "Run an eval experiment over a suite with scorer specs and view aggregate scores.",
);

experimentCommand.addCommand(
  action(
    new Command("run")
      .description(
        "Kick off an experiment for a suite, wait for completion, and print aggregate scores. " +
          "Output (--json): {eval_run: EvalRun, aggregate: [{scorer, mean, count}]}",
      )
      .requiredOption("--suite <id>", "Eval suite id")
      .requiredOption(
        "--scorers <names>",
        "Comma-separated scorer names (e.g. exact_match,contains)",
      )
      .option("--baseline <runId>", "Baseline eval-run id for delta comparison"),
    async ({ client, globals, opts }) => {
      const o = opts as { suite: string; scorers: string; baseline?: string };
      const scorerSpecs = parseScorers(o.scorers);
      if (scorerSpecs.length === 0) {
        throw new Error("--scorers must list at least one scorer");
      }
      const spinner = globals.json ? null : ora(`Starting experiment on suite ${o.suite}...`).start();
      const started = await client.runEvalSuite(o.suite, {
        scorer_specs: scorerSpecs,
        baseline_run_id: o.baseline ?? null,
      });
      if (spinner) spinner.text = `Eval run ${started.id} — waiting...`;
      const finished = await waitForCompletion(client, started.id);
      const results = await collectResults(client, started.id);
      const aggregate = aggregateScores(results);
      spinner?.stop();

      if (globals.json) {
        printValue({ eval_run: finished, aggregate, id: finished.id }, globals);
        return;
      }
      printValue(
        {
          id: finished.id,
          suite_id: finished.suite_id,
          status: finished.status,
          baseline_run_id: finished.baseline_run_id,
          completed_at: finished.completed_at,
        },
        globals,
      );
      printTable(
        aggregate.map((a) => ({ ...a, mean: a.mean.toFixed(4) })),
        [
          { key: "scorer", label: "Scorer", width: 24 },
          { key: "mean", label: "Mean", width: 10 },
          { key: "count", label: "Count", width: 8 },
        ],
      );
    },
  ) as Command,
);
