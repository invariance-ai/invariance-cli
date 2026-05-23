import { Command } from "commander";
import { readFileSync } from "node:fs";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";
import {
  CortexJobKindSchema,
  CortexTargetTypeSchema,
  CortexLaunchModeSchema,
  CORTEX_TERMINAL_STATUSES,
  type CortexJobCreateRequest,
  type CortexJobKind,
  type CortexTargetType,
  type CortexLaunchMode,
  type CortexLaunchJobRequest,
  type ComplexQueryResult,
} from "../../types/index.js";
import type { InvarianceClient } from "../../lib/client.js";

const CORTEX_JOB_COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "job_kind", label: "Kind", width: 26 },
  { key: "status", label: "Status", width: 10 },
  { key: "target_type", label: "Target", width: 12 },
  { key: "target_ref", label: "Ref", width: 24 },
  { key: "created_at", label: "Created", width: 24 },
];

/** Default poll interval / timeout for async (or non-terminal sync) launches. */
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll the job result until it reaches a terminal status. Mirrors the SDK's
 * `waitForResult`; throws on timeout.
 */
async function waitForResult(
  client: InvarianceClient,
  jobId: string,
  intervalMs = POLL_INTERVAL_MS,
  timeoutMs = POLL_TIMEOUT_MS,
): Promise<{ status: string; result?: Record<string, unknown> | null; error?: string | null }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await client.getCortexJobResult(jobId);
    if (CORTEX_TERMINAL_STATUSES.includes(res.status)) return res;
    if (Date.now() + intervalMs >= deadline) {
      throw new Error(
        `Cortex job ${jobId} did not finish within ${timeoutMs}ms (last status: ${res.status}).`,
      );
    }
    await sleep(intervalMs);
  }
}

export const cortexCommand = new Command("cortex").description(
  "Cortex: run generic evals, counterfactuals, attribution, and other Cortex jobs.",
);

/** Parse `--target <type>:<ref>` into its two pieces. */
export function parseTarget(input: string): {
  target_type: CortexTargetType;
  target_ref: string;
} {
  const idx = input.indexOf(":");
  if (idx <= 0 || idx === input.length - 1) {
    throw new Error(
      `Invalid --target "${input}". Expected <type>:<ref>, e.g. case:case_123.`,
    );
  }
  const rawType = input.slice(0, idx);
  const ref = input.slice(idx + 1);
  const parsed = CortexTargetTypeSchema.safeParse(rawType);
  if (!parsed.success) {
    throw new Error(
      `Unknown target type "${rawType}". Allowed: ${CortexTargetTypeSchema.options.join(", ")}.`,
    );
  }
  return { target_type: parsed.data, target_ref: ref };
}

function readJsonFile(flag: string, path: string): Record<string, unknown> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(`Could not read --${flag} file "${path}": ${(err as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in --${flag} file "${path}": ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`--${flag} file "${path}" must contain a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

const job = new Command("job").description("Manage generic Cortex jobs.");

job.addCommand(
  action(
    new Command("run")
      .description(
        "Enqueue a Cortex job. Maps to POST /v1/cortex/jobs. Output (--json): {job_id, status}.",
      )
      .requiredOption(
        "--kind <kind>",
        `Job kind: ${CortexJobKindSchema.options.join(", ")}`,
      )
      .requiredOption(
        "--target <type:ref>",
        "Target as <type>:<ref>, e.g. case:case_123, run:run_1, external:cust_sys_42",
      )
      .option("--question <str>", "Natural-language question or hypothesis")
      .option("--criteria <file>", "Path to JSON file with eval criteria")
      .option("--payload <file>", "Path to JSON file with input_payload (e.g. for external targets)")
      .requiredOption("--project-id <id>", "Project id"),
    async ({ client, globals, opts }) => {
      const kindParsed = CortexJobKindSchema.safeParse(opts.kind);
      if (!kindParsed.success) {
        throw new Error(
          `Unknown --kind "${opts.kind}". Allowed: ${CortexJobKindSchema.options.join(", ")}.`,
        );
      }
      const { target_type, target_ref } = parseTarget(opts.target);
      const body: CortexJobCreateRequest = {
        project_id: opts.projectId,
        job_kind: kindParsed.data as CortexJobKind,
        target_type,
        target_ref,
      };
      if (opts.question) body.question = opts.question;
      if (opts.criteria) body.criteria = readJsonFile("criteria", opts.criteria);
      if (opts.payload) body.input_payload = readJsonFile("payload", opts.payload);
      printValue(await client.createCortexJob(body), globals);
    },
  ) as Command,
);

job.addCommand(
  action(
    new Command("get")
      .description("Get a Cortex job by id. Maps to GET /v1/cortex/jobs/:id.")
      .argument("<id>", "Cortex job id (e.g. ctxjob_123)"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getCortexJob(cmd.args[0]!), globals);
    },
  ) as Command,
);

job.addCommand(
  action(
    new Command("result")
      .description("Get the result for a Cortex job. Maps to GET /v1/cortex/jobs/:id/result.")
      .argument("<id>", "Cortex job id (e.g. ctxjob_123)"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getCortexJobResult(cmd.args[0]!), globals);
    },
  ) as Command,
);

cortexCommand.addCommand(job);

const counterfactual = new Command("counterfactual").description(
  "Counterfactual evals: estimate what would have happened under a changed assumption.",
);

counterfactual.addCommand(
  action(
    new Command("run")
      .description(
        "Enqueue a counterfactual_eval Cortex job. Sugar over `cortex job run --kind counterfactual_eval`.",
      )
      .requiredOption(
        "--target <type:ref>",
        "Target as <type>:<ref>, e.g. case:case_123",
      )
      .requiredOption(
        "--question <str>",
        "Hypothesis to evaluate (e.g. 'What if Alice owned this from the start?')",
      )
      .option("--criteria <file>", "Path to JSON file with eval criteria")
      .option("--payload <file>", "Path to JSON file with input_payload")
      .requiredOption("--project-id <id>", "Project id"),
    async ({ client, globals, opts }) => {
      const { target_type, target_ref } = parseTarget(opts.target);
      const body: CortexJobCreateRequest = {
        project_id: opts.projectId,
        job_kind: "counterfactual_eval",
        target_type,
        target_ref,
        question: opts.question,
      };
      if (opts.criteria) body.criteria = readJsonFile("criteria", opts.criteria);
      if (opts.payload) body.input_payload = readJsonFile("payload", opts.payload);
      printValue(await client.createCortexJob(body), globals);
    },
  ) as Command,
);

cortexCommand.addCommand(counterfactual);

// ── Governed launcher + read-only analyst ──

function parseMode(value: string | undefined): CortexLaunchMode {
  if (value === undefined) return "sync";
  const parsed = CortexLaunchModeSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Invalid --mode "${value}". Allowed: ${CortexLaunchModeSchema.options.join(", ")}.`,
    );
  }
  return parsed.data;
}

function parseTargetType(flag: string, value: string): CortexTargetType {
  const parsed = CortexTargetTypeSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Unknown --${flag} "${value}". Allowed: ${CortexTargetTypeSchema.options.join(", ")}.`,
    );
  }
  return parsed.data;
}

/** Render a ComplexQueryResult for humans. */
function printComplexQueryAnswer(r: ComplexQueryResult): void {
  const out = process.stdout;
  out.write(`${r.short_answer}\n`);
  out.write(`\nconfidence: ${r.confidence}\n`);
  if (r.recommended_action) out.write(`recommended action: ${r.recommended_action}\n`);
  if (r.evidence_refs.length) out.write(`evidence: ${r.evidence_refs.join(", ")}\n`);
  if (r.affected_entities.length) {
    out.write(`affected entities: ${r.affected_entities.join(", ")}\n`);
  }
  if (r.restricted_evidence_count > 0) {
    out.write(`restricted evidence withheld: ${r.restricted_evidence_count}\n`);
  }
  if (r.follow_up_questions.length) {
    out.write(`follow-ups:\n${r.follow_up_questions.map((q) => `  - ${q}`).join("\n")}\n`);
  }
}

cortexCommand.addCommand(
  action(
    new Command("ask")
      .description(
        "Ask the read-only complex_query analyst a cited question. Launches a governed job and prints the answer; --json prints the full ComplexQueryResult.",
      )
      .argument("<question>", "Natural-language question to answer")
      .requiredOption("--project <id>", "Project id to scope the analyst to")
      .option(
        "--target-type <type>",
        `What to anchor on (default: project). One of: ${CortexTargetTypeSchema.options.join(", ")}`,
      )
      .option("--target-ref <id>", "Id of the target entity (defaults to --project when targeting project)")
      .option("--mode <mode>", "sync (default, blocks) or async (launch + poll)"),
    async ({ client, globals, opts, cmd }) => {
      const question = cmd.args[0]!;
      const mode = parseMode(opts.mode);
      const targetType: CortexTargetType = opts.targetType
        ? parseTargetType("target-type", opts.targetType)
        : "project";
      const targetRef =
        opts.targetRef ?? (targetType === "project" ? opts.project : undefined);
      if (!targetRef) {
        throw new Error(`--target-ref is required for --target-type "${targetType}".`);
      }

      const body: CortexLaunchJobRequest = {
        project_id: opts.project,
        job_kind: "complex_query",
        target_type: targetType,
        target_ref: targetRef,
        question,
        mode,
      };
      const launched = await client.launchCortexJob(body);

      let status: string = launched.status;
      let result: Record<string, unknown> | null = launched.result ?? null;
      let error: string | null = launched.error ?? null;

      // A sync launch returns a terminal status with result/error embedded; only
      // poll when the job is still in flight (async, or a non-terminal sync).
      if (!CORTEX_TERMINAL_STATUSES.includes(status as never)) {
        const polled = await waitForResult(client, launched.job_id);
        status = polled.status;
        result = polled.result ?? null;
        error = polled.error ?? null;
      }

      if (status !== "succeeded" || result == null) {
        throw new Error(
          `cortex ask: job ${launched.job_id} ${status}${error ? `: ${error}` : ""}`,
        );
      }
      if (result.kind !== "complex_query") {
        throw new Error(
          `cortex ask: expected complex_query result, got "${String(result.kind)}".`,
        );
      }

      const answer = result as unknown as ComplexQueryResult;
      if (globals.json) {
        printValue(answer, globals);
        return;
      }
      printComplexQueryAnswer(answer);
    },
  ) as Command,
);

cortexCommand.addCommand(
  action(
    new Command("launch")
      .description(
        "Launch a Cortex job through the governed launcher. Maps to POST /v1/cortex/jobs/launch. Output (--json): {job_id, status, mode, deduplicated, result?, error?}.",
      )
      .requiredOption("--project <id>", "Project id")
      .requiredOption("--kind <kind>", `Job kind: ${CortexJobKindSchema.options.join(", ")}`)
      .requiredOption(
        "--target-type <type>",
        `Target type: ${CortexTargetTypeSchema.options.join(", ")}`,
      )
      .requiredOption("--target-ref <id>", "Id of the target entity")
      .option("--mode <mode>", "sync (default, blocks) or async (enqueue)")
      .option("--question <str>", "Natural-language question or hypothesis")
      .option("--idempotency-key <key>", "Dedup key; a repeat returns the prior job")
      .option("--criteria <file>", "Path to JSON file with eval criteria")
      .option("--payload <file>", "Path to JSON file with input_payload"),
    async ({ client, globals, opts }) => {
      const kindParsed = CortexJobKindSchema.safeParse(opts.kind);
      if (!kindParsed.success) {
        throw new Error(
          `Unknown --kind "${opts.kind}". Allowed: ${CortexJobKindSchema.options.join(", ")}.`,
        );
      }
      const body: CortexLaunchJobRequest = {
        project_id: opts.project,
        job_kind: kindParsed.data as CortexJobKind,
        target_type: parseTargetType("target-type", opts.targetType),
        target_ref: opts.targetRef,
        mode: parseMode(opts.mode),
      };
      if (opts.question) body.question = opts.question;
      if (opts.idempotencyKey) body.idempotency_key = opts.idempotencyKey;
      if (opts.criteria) body.criteria = readJsonFile("criteria", opts.criteria);
      if (opts.payload) body.input_payload = readJsonFile("payload", opts.payload);
      printValue(await client.launchCortexJob(body), globals);
    },
  ) as Command,
);

cortexCommand.addCommand(
  action(
    new Command("list")
      .description("List Cortex jobs, newest first. Maps to GET /v1/cortex/jobs. Output (--json): {data, next_cursor}.")
      .option("--status <s>", `Filter by status: ${["queued", "leased", "running", "succeeded", "failed", "dead", "cancelled"].join(", ")}`)
      .option("--kind <k>", `Filter by kind: ${CortexJobKindSchema.options.join(", ")}`)
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor"),
    async ({ client, globals, opts }) => {
      const page = await client.listCortexJobs({
        status: opts.status,
        kind: opts.kind,
        limit: opts.limit,
        cursor: opts.cursor,
      });
      printPage(page, CORTEX_JOB_COLUMNS, globals);
    },
  ) as Command,
);

cortexCommand.addCommand(
  action(
    new Command("retry")
      .description("Re-queue a failed/dead Cortex job. Maps to POST /v1/cortex/jobs/:id/retry.")
      .argument("<job-id>", "Cortex job id (e.g. ctxjob_123)"),
    async ({ client, globals, cmd }) => {
      printValue(await client.retryCortexJob(cmd.args[0]!), globals);
    },
  ) as Command,
);

cortexCommand.addCommand(
  action(
    new Command("runs")
      .description("List the attempt history (audit-trail runs) for a Cortex job. Maps to GET /v1/cortex/jobs/:id/runs. Output (--json): {runs}.")
      .argument("<job-id>", "Cortex job id (e.g. ctxjob_123)"),
    async ({ client, globals, cmd }) => {
      printValue(await client.listCortexJobRuns(cmd.args[0]!), globals);
    },
  ) as Command,
);
