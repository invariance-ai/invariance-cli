import { readFileSync } from "node:fs";
import { Command } from "commander";
import ora from "ora";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";
import type { InvarianceClient } from "../../lib/client.js";
import type { Finding, Run } from "../../types/index.js";

const FAIL_SEVERITIES = new Set<Finding["severity"]>(["medium", "high", "critical"]);

interface EvalCaseSpec {
  name: string;
  input?: unknown;
  expected?: unknown;
  monitors?: string[];
}

interface EvalSpec {
  suite: string;
  cases: EvalCaseSpec[];
  monitors?: string[];
}

interface EvalRunResult {
  case: string;
  run_id: string;
  status: "pass" | "fail";
  findings: Array<Pick<Finding, "id" | "severity" | "title" | "status">>;
}

function readEvalMeta(run: Run): { suite: string; case: string } | null {
  const e = (run.metadata as Record<string, unknown>)?.eval;
  if (!e || typeof e !== "object") return null;
  const ev = e as Record<string, unknown>;
  if (typeof ev.suite !== "string" || typeof ev.case !== "string") return null;
  return { suite: ev.suite, case: ev.case };
}

function deriveStatus(findings: Finding[]): "pass" | "fail" {
  for (const f of findings) {
    if (f.status !== "open" && f.status !== "review_requested") continue;
    if (FAIL_SEVERITIES.has(f.severity)) return "fail";
  }
  return "pass";
}

async function findingsForRun(client: InvarianceClient, runId: string): Promise<Finding[]> {
  const page = await client.listFindings({ run_id: runId, limit: 100 });
  return page.data;
}

async function runOneCase(
  client: InvarianceClient,
  suite: string,
  spec: EvalCaseSpec,
  defaultMonitors: string[],
): Promise<EvalRunResult> {
  const monitors = spec.monitors ?? defaultMonitors;
  const run = await client.startRun({
    name: `eval:${suite}:${spec.name}`,
    metadata: {
      eval: {
        suite,
        case: spec.name,
        expected: spec.expected,
        inputs: spec.input,
      },
    },
  });
  if (spec.input !== undefined) {
    await client.writeNodes(run.id, [
      { action_type: "log", input: { eval_input: spec.input }, output: null },
    ]);
  }
  await client.updateRun(run.id, { status: "completed" });
  for (const id of monitors) {
    await client.evaluateMonitor(id, { run_id: run.id });
  }
  const findings = await findingsForRun(client, run.id);
  return {
    case: spec.name,
    run_id: run.id,
    status: deriveStatus(findings),
    findings: findings.map((f) => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      status: f.status,
    })),
  };
}

export const evalCommand = new Command("eval").description(
  "Run starter eval suites and inspect their results. " +
    "An eval suite is a set of runs sharing metadata.eval.suite; pass/fail is " +
    "derived from open findings of severity >= medium.",
);

evalCommand.addCommand(
  action(
    new Command("run")
      .description(
        "Execute every case in a spec file as Invariance runs. " +
          "Output (--json): {suite, total, passed, failed, results: EvalRunResult[]}",
      )
      .argument("<spec>", "Path to JSON spec: {suite, cases:[{name, input?, expected?, monitors?:string[]}], monitors?:string[]}")
      .option("--suite <name>", "Override suite name from the spec")
      .addHelpText(
        "after",
        "\nExample:\n  $ invariance eval run ./suites/regression.json --json\n",
      ),
    async ({ client, globals, opts, cmd }) => {
      const specPath = cmd.processedArgs[0] as string;
      const spec: EvalSpec = JSON.parse(readFileSync(specPath, "utf8"));
      const suite = (opts as { suite?: string }).suite ?? spec.suite;
      const spinner = globals.json ? null : ora(`Running suite ${suite}...`).start();
      const results: EvalRunResult[] = [];
      for (const c of spec.cases) {
        const r = await runOneCase(client, suite, c, spec.monitors ?? []);
        results.push(r);
        if (spinner) spinner.text = `[${results.length}/${spec.cases.length}] ${c.name}: ${r.status}`;
      }
      spinner?.stop();
      const passed = results.filter((r) => r.status === "pass").length;
      const summary = {
        suite,
        total: results.length,
        passed,
        failed: results.length - passed,
        results,
      };
      printValue(summary, globals);
    },
  ) as Command,
);

evalCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List runs tagged with metadata.eval.suite. Output (--json): {data: EvalCaseRecord[], next_cursor}",
      )
      .requiredOption("--suite <name>", "Suite to filter by")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Pagination cursor"),
    async ({ client, globals, opts }) => {
      const o = opts as { suite: string; limit?: number; cursor?: string };
      const page = await client.listRuns({
        eval_suite: o.suite,
        limit: o.limit,
        cursor: o.cursor,
      });
      const records = [];
      for (const run of page.data) {
        const meta = readEvalMeta(run);
        if (!meta) continue;
        const findings = await findingsForRun(client, run.id);
        records.push({
          run_id: run.id,
          case: meta.case,
          status: deriveStatus(findings),
          created_at: run.created_at,
        });
      }
      printPage(
        { data: records, next_cursor: page.next_cursor },
        [
          { key: "run_id", label: "Run", width: 26 },
          { key: "case", label: "Case", width: 30 },
          { key: "status", label: "Status", width: 8 },
          { key: "created_at", label: "Created", width: 24 },
        ],
        globals,
      );
    },
  ) as Command,
);

evalCommand.addCommand(
  action(
    new Command("summarize")
      .description(
        "Aggregate pass/fail counts for a suite. Output (--json): {suite, total, passed, failed}",
      )
      .requiredOption("--suite <name>", "Suite name"),
    async ({ client, globals, opts }) => {
      const suite = (opts as { suite: string }).suite;
      let cursor: string | undefined;
      let passed = 0;
      let failed = 0;
      for (let i = 0; i < 20; i++) {
        const page = await client.listRuns({ eval_suite: suite, cursor, limit: 100 });
        for (const run of page.data) {
          if (!readEvalMeta(run)) continue;
          const findings = await findingsForRun(client, run.id);
          if (deriveStatus(findings) === "pass") passed++;
          else failed++;
        }
        if (!page.next_cursor) break;
        cursor = page.next_cursor;
      }
      printValue({ suite, total: passed + failed, passed, failed, id: suite }, globals);
    },
  ) as Command,
);
