import { Command } from "commander";
import { action, parseIntFlag, printPage } from "../../lib/cmd.js";

/**
 * `inv eval run results` — inspect per-case results for a finished eval run.
 * Compare lives at the sibling `inv eval compare` command; it isn't duplicated
 * here because commander Commands can only attach to one parent.
 */
export const runCommand = new Command("run").description(
  "Eval runs: inspect results. See `inv eval compare` for regression compare.",
);

runCommand.addCommand(
  action(
    new Command("results")
      .description(
        "List per-case results for an eval run. " +
          "Output (--json): {data: EvalResultRecord[], next_cursor}.",
      )
      .argument("<eval_run_id>", "Eval run id")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Pagination cursor"),
    async ({ client, globals, opts, cmd }) => {
      const id = cmd.processedArgs[0] as string;
      const o = opts as { limit?: number; cursor?: string };
      const page = await client.listEvalResults(id, { limit: o.limit, cursor: o.cursor });
      printPage(
        page,
        [
          { key: "case_id", label: "Case", width: 26 },
          { key: "status", label: "Status", width: 8 },
          { key: "created_at", label: "Created", width: 24 },
        ],
        globals,
      );
    },
  ) as Command,
);

