import { Command } from "commander";
import { action, parseIntFlag, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";
import type { EvalScorerKind } from "../../types/index.js";

const SCORER_KINDS: EvalScorerKind[] = ["assertion", "code", "llm", "builtin"];

export const scorerCommand = new Command("scorer").description(
  "Manage eval scorers (assertion / code / llm / builtin).",
);

scorerCommand.addCommand(
  action(
    new Command("list")
      .description("List eval scorers. Output (--json): {data: EvalScorer[], next_cursor}")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Pagination cursor"),
    async ({ client, globals, opts }) => {
      const o = opts as { limit?: number; cursor?: string };
      const page = await client.listEvalScorers({ limit: o.limit, cursor: o.cursor });
      printPage(
        page,
        [
          { key: "id", label: "ID", width: 26 },
          { key: "name", label: "Name", width: 24 },
          { key: "kind", label: "Kind", width: 10 },
          { key: "description", label: "Description", width: 40 },
        ],
        globals,
      );
    },
  ) as Command,
);

scorerCommand.addCommand(
  action(
    new Command("create")
      .description("Create a scorer.")
      .requiredOption("--name <name>", "Scorer name")
      .requiredOption(
        "--kind <kind>",
        `Scorer kind: ${SCORER_KINDS.join("|")}`,
      )
      .option("--description <text>", "Description")
      .option("--definition <json>", "Definition JSON (assertion/code/llm config)")
      .option("--metadata <json>", "Metadata JSON"),
    async ({ client, globals, opts }) => {
      const o = opts as {
        name: string;
        kind: string;
        description?: string;
        definition?: string;
        metadata?: string;
      };
      if (!SCORER_KINDS.includes(o.kind as EvalScorerKind)) {
        throw new Error(`Invalid --kind: ${o.kind}. Must be one of: ${SCORER_KINDS.join(", ")}`);
      }
      const definition = parseJsonFlag("definition", o.definition) as
        | Record<string, unknown>
        | undefined;
      const metadata = parseJsonFlag("metadata", o.metadata) as
        | Record<string, unknown>
        | undefined;
      const scorer = await client.createEvalScorer({
        name: o.name,
        description: o.description,
        kind: o.kind as EvalScorerKind,
        definition,
        metadata,
      });
      printValue(scorer, globals);
    },
  ) as Command,
);
