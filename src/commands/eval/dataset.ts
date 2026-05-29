import { readFileSync } from "node:fs";
import { Command } from "commander";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";
import type { CounterfactualReplayMutation, EvalAssertion } from "../../types/index.js";

interface DatasetJsonlRow {
  name?: string;
  input: Record<string, unknown>;
  expected?: Record<string, unknown>;
  assertions?: EvalAssertion[];
  mutations?: CounterfactualReplayMutation[];
  metadata?: Record<string, unknown>;
}

function readDatasetRows(path: string): DatasetJsonlRow[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line, i) => {
      let row: DatasetJsonlRow;
      try {
        row = JSON.parse(line);
      } catch (err) {
        throw new Error(`Invalid JSON on line ${i + 1}: ${(err as Error).message}`);
      }
      if (!row.input || typeof row.input !== "object" || Array.isArray(row.input)) {
        throw new Error(`Line ${i + 1}: missing "input" object`);
      }
      if (row.name !== undefined && typeof row.name !== "string") {
        throw new Error(`Line ${i + 1}: "name" must be a string`);
      }
      if (
        row.expected !== undefined &&
        (typeof row.expected !== "object" || row.expected === null || Array.isArray(row.expected))
      ) {
        throw new Error(`Line ${i + 1}: "expected" must be an object`);
      }
      if (row.assertions !== undefined && !Array.isArray(row.assertions)) {
        throw new Error(`Line ${i + 1}: "assertions" must be an array`);
      }
      if (row.mutations !== undefined && !Array.isArray(row.mutations)) {
        throw new Error(`Line ${i + 1}: "mutations" must be an array`);
      }
      if (
        row.metadata !== undefined &&
        (typeof row.metadata !== "object" || row.metadata === null || Array.isArray(row.metadata))
      ) {
        throw new Error(`Line ${i + 1}: "metadata" must be an object`);
      }
      return row;
    });
}

export const datasetCommand = new Command("dataset").description(
  "Manage eval datasets (collections of input/expected examples).",
);

datasetCommand.addCommand(
  action(
    new Command("list")
      .description("List eval datasets. Output (--json): {data: EvalDataset[], next_cursor}")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Pagination cursor"),
    async ({ client, globals, opts }) => {
      const o = opts as { limit?: number; cursor?: string };
      const page = await client.listEvalDatasets({ limit: o.limit, cursor: o.cursor });
      printPage(
        page,
        [
          { key: "id", label: "ID", width: 26 },
          { key: "name", label: "Name", width: 30 },
          { key: "description", label: "Description", width: 40 },
          { key: "created_at", label: "Created", width: 24 },
        ],
        globals,
      );
    },
  ) as Command,
);

datasetCommand.addCommand(
  action(
    new Command("get")
      .description("Get a dataset by id.")
      .argument("<id>", "Dataset id"),
    async ({ client, globals, cmd }) => {
      const id = cmd.processedArgs[0] as string;
      const dataset = await client.getEvalDataset(id);
      printValue(dataset, globals);
    },
  ) as Command,
);

datasetCommand.addCommand(
  action(
    new Command("create")
      .description("Create a dataset.")
      .requiredOption("--name <name>", "Dataset name")
      .option("--description <text>", "Description")
      .option("--metadata <json>", "Metadata JSON"),
    async ({ client, globals, opts }) => {
      const o = opts as { name: string; description?: string; metadata?: string };
      const metadata = parseJsonFlag("metadata", o.metadata) as
        | Record<string, unknown>
        | undefined;
      const dataset = await client.createEvalDataset({
        name: o.name,
        description: o.description,
        metadata,
      });
      printValue(dataset, globals);
    },
  ) as Command,
);

datasetCommand.addCommand(
  action(
    new Command("append-rows")
      .description(
        "Append rows from a JSONL file. Each line: {input, expected?, metadata?}. " +
          "Output (--json): {dataset_id, appended, examples: EvalDatasetExample[]}",
      )
      .argument("<id>", "Dataset id")
      .requiredOption("--file <path>", "Path to JSONL file"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.processedArgs[0] as string;
      const o = opts as { file: string };
      const rows = readDatasetRows(o.file);
      const examples = [];
      for (const row of rows) {
        const example = await client.appendEvalDatasetExample(id, {
          input: row.input,
          expected: row.expected,
          metadata: row.metadata,
        });
        examples.push(example);
      }
      printValue(
        { dataset_id: id, appended: examples.length, examples, id },
        globals,
      );
    },
  ) as Command,
);

datasetCommand.addCommand(
  action(
    new Command("seed-suite")
      .description(
        "Create a dataset, append JSONL rows, create a linked eval suite, and create one case per row. " +
          "Each JSONL line: {name?, input, expected?, assertions?, mutations?, metadata?}. " +
          "Output (--json): {dataset, suite, examples, cases, eval_run?}.",
      )
      .requiredOption("--name <name>", "Dataset name")
      .requiredOption("--file <path>", "Path to JSONL dataset")
      .option("--suite-name <name>", "Suite name (defaults to dataset name)")
      .option("--description <text>", "Dataset and suite description")
      .option("--target-type <type>", "Eval target_type for the suite", "custom")
      .option("--metadata <json>", "Metadata JSON copied to the dataset and suite")
      .option("--run", "Start the suite after seeding cases"),
    async ({ client, globals, opts }) => {
      const o = opts as {
        name: string;
        file: string;
        suiteName?: string;
        description?: string;
        targetType: string;
        metadata?: string;
        run?: boolean;
      };
      const rows = readDatasetRows(o.file);
      if (rows.length === 0) {
        throw new Error("Dataset file did not contain any JSONL rows");
      }
      const metadata = parseJsonFlag("metadata", o.metadata) as
        | Record<string, unknown>
        | undefined;
      const mappedRows = rows.map((row, i) => ({
        name: row.name ?? `case-${String(i + 1).padStart(3, "0")}`,
        input: row.input,
        expected: row.expected,
        assertions: row.assertions,
        mutations: row.mutations,
        metadata: row.metadata,
      }));
      const canUseServerSeed = !o.suiteName || o.suiteName === o.name;
      const seeded = canUseServerSeed
        ? await client.seedEvalSuite({
            name: o.name,
            description: o.description,
            target_type: o.targetType,
            dataset_metadata: metadata,
            suite_metadata: metadata,
            rows: mappedRows,
            run: !!o.run,
          })
        : await (async () => {
            const dataset = await client.createEvalDataset({
              name: o.name,
              description: o.description,
              metadata,
            });
            const suite = await client.createEvalSuite({
              name: o.suiteName ?? o.name,
              description: o.description,
              target_type: o.targetType,
              dataset_id: dataset.id,
              metadata,
            });
            const examples = [];
            const cases = [];
            for (const row of mappedRows) {
              const example = await client.appendEvalDatasetExample(dataset.id, {
                input: row.input,
                expected: row.expected,
                metadata: row.metadata,
              });
              examples.push(example);
              const caseRow = await client.createEvalCase(suite.id, {
                name: row.name,
                dataset_example_id: example.id,
                input_bundle: row.input,
                expected: row.expected,
                assertions: row.assertions,
                mutations: row.mutations,
                metadata: row.metadata,
              });
              cases.push(caseRow);
            }
            const evalRun = o.run ? await client.runEvalSuite(suite.id) : undefined;
            return { dataset, suite, examples, cases, ...(evalRun ? { eval_run: evalRun } : {}) };
          })();
      printValue(
        {
          ...seeded,
          id: seeded.suite.id,
          dataset_id: seeded.dataset.id,
          suite_id: seeded.suite.id,
          case_count: seeded.cases.length,
        },
        globals,
      );
    },
  ) as Command,
);
