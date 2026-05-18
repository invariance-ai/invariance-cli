import { Command } from "commander";
import { readFileSync } from "node:fs";
import { action, printValue } from "../../lib/cmd.js";
import {
  CortexJobKindSchema,
  CortexTargetTypeSchema,
  type CortexJobCreateRequest,
  type CortexJobKind,
  type CortexTargetType,
} from "../../types/index.js";

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
