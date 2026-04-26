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
      .description(
        "List reviews. Output (--json): {data: Review[], next_cursor} where Review = {id, agent_id, finding_id, status: 'pending'|'claimed'|'passed'|'failed'|'needs_fix', reviewer_agent_id, decision: 'passed'|'failed'|'needs_fix'|null, notes, created_at, updated_at, resolved_at}",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor")
      // NOTE: --status, --unclaimed, --since are applied client-side. The
      // /v1/reviews backend route does not accept these as query params today
      // (future API gap).
      .option("--status <status>", "Filter by status (pending|claimed|passed|failed|needs_fix)")
      .option("--unclaimed", "Only show unclaimed (pending) reviews")
      .option("--since <iso>", "Only include reviews created at/after this ISO timestamp"),
    async ({ client, globals, opts }) => {
      const page = await client.listReviews({ cursor: opts.cursor, limit: opts.limit });
      const filtered = {
        ...page,
        data: page.data.filter((r) => {
          if (opts.status && r.status !== opts.status) return false;
          if (opts.unclaimed && r.status !== "pending") return false;
          if (opts.since && r.created_at && r.created_at < opts.since) return false;
          return true;
        }),
      };
      printPage(filtered, COLUMNS, globals);
    },
  ) as Command,
);

reviewCommand.addCommand(
  action(
    new Command("get")
      .description(
        "Show a review. Output (--json): {id, agent_id, finding_id, status, reviewer_agent_id, decision, notes, created_at, updated_at, resolved_at}",
      )
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getReview(cmd.args[0]!), globals);
    },
  ) as Command,
);

reviewCommand.addCommand(
  action(
    new Command("claim")
      .description(
        "Claim a review. Output (--json): the updated Review = {id, status: 'claimed', reviewer_agent_id, notes, updated_at, ...}",
      )
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
      .description(
        "Release a claimed review. Output (--json): the updated Review = {id, status: 'pending', reviewer_agent_id: null, notes, updated_at, ...}",
      )
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
      .description(
        "Resolve a review with a decision. Output (--json): the updated Review = {id, status: 'passed'|'failed'|'needs_fix', decision, notes, resolved_at, updated_at, ...}",
      )
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
