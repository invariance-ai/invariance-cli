import { Command } from "commander";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";
import type { ReviewDecision } from "../../types/index.js";

const COLUMNS = [
  { key: "id", label: "ID", width: 26 },
  { key: "finding_id", label: "Finding", width: 26 },
  { key: "status", label: "Status", width: 14 },
  { key: "decision", label: "Decision", width: 12 },
];

export const reviewCommand = new Command("review").description("Manage reviews (resolution workflow)");

reviewCommand.addCommand(
  action(
    new Command("list")
      .description("List reviews")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Cursor"),
    async ({ client, globals, opts }) => {
      printPage(
        await client.listReviews({ cursor: opts.cursor, limit: opts.limit }),
        COLUMNS,
        globals,
      );
    },
  ) as Command,
);

reviewCommand.addCommand(
  action(new Command("get").description("Show a review").argument("<id>"), async ({ client, globals, cmd }) => {
    printValue(await client.getReview(cmd.args[0]!), globals);
  }) as Command,
);

reviewCommand.addCommand(
  action(
    new Command("claim")
      .description("Claim a review")
      .argument("<id>")
      .option("--notes <text>", "Optional notes"),
    async ({ client, globals, opts, cmd }) => {
      printValue(await client.claimReview(cmd.args[0]!, opts.notes), globals);
    },
  ) as Command,
);

reviewCommand.addCommand(
  action(
    new Command("unclaim")
      .description("Release a claimed review")
      .argument("<id>")
      .option("--notes <text>", "Optional notes"),
    async ({ client, globals, opts, cmd }) => {
      printValue(await client.unclaimReview(cmd.args[0]!, opts.notes), globals);
    },
  ) as Command,
);

reviewCommand.addCommand(
  action(
    new Command("resolve")
      .description("Resolve a review with a decision")
      .argument("<id>")
      .requiredOption("--decision <d>", "passed|failed|needs_fix")
      .option("--notes <text>", "Reviewer notes"),
    async ({ client, globals, opts, cmd }) => {
      printValue(
        await client.resolveReview(cmd.args[0]!, opts.decision as ReviewDecision, opts.notes),
        globals,
      );
    },
  ) as Command,
);
