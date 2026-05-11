import { readFileSync } from "node:fs";
import { Command } from "commander";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";

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
      const lines = readFileSync(o.file, "utf8")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const examples = [];
      for (const [i, line] of lines.entries()) {
        let row: { input: Record<string, unknown>; expected?: Record<string, unknown>; metadata?: Record<string, unknown> };
        try {
          row = JSON.parse(line);
        } catch (err) {
          throw new Error(`Invalid JSON on line ${i + 1}: ${(err as Error).message}`);
        }
        if (!row.input || typeof row.input !== "object") {
          throw new Error(`Line ${i + 1}: missing "input" object`);
        }
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
