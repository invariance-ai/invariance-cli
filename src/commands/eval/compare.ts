import { Command } from "commander";
import { action, printValue } from "../../lib/cmd.js";
import { printTable } from "../../lib/output.js";
function parseFloatFlag(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Expected a number, got "${value}"`);
  return n;
}

export const compareCommand = action(
  new Command("compare")
    .description(
      "Compare two eval runs by scorer. Exit code 1 if any aggregate score regresses by " +
        "more than --regression-threshold. Output (--json): CompareResponse + {regressions}.",
    )
    .argument("<runA>", "Current eval-run id")
    .argument("<runB>", "Baseline eval-run id")
    .option(
      "--regression-threshold <delta>",
      "Fail if any score drops by more than this absolute delta (default 0.05)",
      parseFloatFlag,
      0.05,
    )
    .option("--json", "Emit JSON (overrides global formatting)"),
  async ({ client, globals, opts, cmd }) => {
    const runA = cmd.processedArgs[0] as string;
    const runB = cmd.processedArgs[1] as string;
    const o = opts as { regressionThreshold: number };
    const threshold = o.regressionThreshold;

    const compare = await client.compareEvalRuns(runA, runB);
    const regressions = compare.aggregate.filter(
      (d) => typeof d.delta === "number" && d.delta < -Math.abs(threshold),
    );

    if (globals.json) {
      printValue(
        { ...compare, regressions, regression_threshold: threshold, id: compare.run_id },
        globals,
      );
    } else {
      printValue(
        {
          id: compare.run_id,
          baseline_run_id: compare.baseline_run_id,
          regression_threshold: threshold,
          regressions: regressions.length,
        },
        globals,
      );
      printTable(
        compare.aggregate.map((d) => ({
          scorer: d.scorer,
          baseline: d.baseline ?? "",
          current: d.current ?? "",
          delta: d.delta ?? "",
        })),
        [
          { key: "scorer", label: "Scorer", width: 24 },
          { key: "baseline", label: "Baseline", width: 12 },
          { key: "current", label: "Current", width: 12 },
          { key: "delta", label: "Delta", width: 12 },
        ],
      );
    }

    if (regressions.length > 0) process.exitCode = 1;
  },
) as Command;
