import { Command } from "commander";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";

const ENTITY_COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "kind", label: "Kind", width: 16 },
  { key: "title", label: "Title", width: 34 },
  { key: "source", label: "Source", width: 18 },
  { key: "created_at", label: "Created", width: 24 },
];

const EDGE_COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "kind", label: "Kind", width: 16 },
  { key: "source_id", label: "From", width: 24 },
  { key: "target_id", label: "To", width: 24 },
  { key: "label", label: "Label", width: 28 },
];

const CANDIDATE_COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "status", label: "Status", width: 10 },
  { key: "relation_kind", label: "Relation", width: 14 },
  { key: "source_object_id", label: "From", width: 22 },
  { key: "target_object_id", label: "To", width: 22 },
  { key: "confidence", label: "Conf", width: 6 },
];

export const dnaCommand = new Command("dna").description(
  "Company DNA: query operational objects, links, evidence, and context.",
);

dnaCommand.addCommand(
  action(
    new Command("entities")
      .description("List DNA entities. Output (--json): {data: DnaEntity[], next_cursor}.")
      .option("--run-id <id>", "Filter to entities derived from one run")
      .option("--kind <kind>", "Filter by entity kind, e.g. customer, patient, ticket")
      .option("--q <text>", "Search title, external id, kind, or source")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor"),
    async ({ client, globals, opts }) => {
      const page = await client.listDnaEntities({
        run_id: opts.runId,
        kind: opts.kind,
        q: opts.q,
        limit: opts.limit,
        cursor: opts.cursor,
      });
      printPage(page, ENTITY_COLUMNS, globals);
    },
  ) as Command,
);

dnaCommand.addCommand(
  action(
    new Command("edges")
      .description("List DNA edges. Output (--json): {data: DnaEdge[], next_cursor}.")
      .option("--run-id <id>", "Filter to edges derived from one run")
      .option("--kind <kind>", "Filter by edge kind, e.g. TOUCHED, USED_CONTEXT")
      .option("--entity-id <id>", "Show edges connected to this entity")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor"),
    async ({ client, globals, opts }) => {
      const page = await client.listDnaEdges({
        run_id: opts.runId,
        kind: opts.kind,
        entity_id: opts.entityId,
        limit: opts.limit,
        cursor: opts.cursor,
      });
      printPage(page, EDGE_COLUMNS, globals);
    },
  ) as Command,
);

dnaCommand.addCommand(
  action(
    new Command("explain-edge")
      .description("Explain a DNA edge with source/target entity context.")
      .argument("<edge-id>", "DNA edge id"),
    async ({ client, globals, cmd }) => {
      printValue(await client.explainDnaEdge(cmd.args[0]!), globals);
    },
  ) as Command,
);

dnaCommand.addCommand(
  action(
    new Command("query")
      .description(
        "Query Company DNA. Output (--json): {query, entities, edges}.",
      )
      .argument("<q>", "Natural-language or keyword query")
      .option("--kind <csv>", "Comma-separated entity kinds to restrict")
      .option("--run-id <id>", "Restrict to context derived from one run")
      .option("--limit <n>", "Max matching entities", parseIntFlag)
      .option("--no-edges", "Do not include first-hop edges around matched entities"),
    async ({ client, globals, opts, cmd }) => {
      const kinds = typeof opts.kind === "string"
        ? opts.kind.split(",").map((k: string) => k.trim()).filter(Boolean)
        : undefined;
      printValue(
        await client.queryDna({
          q: cmd.args[0]!,
          kinds,
          run_id: opts.runId,
          limit: opts.limit,
          include_edges: opts.edges,
        }),
        globals,
      );
    },
  ) as Command,
);

dnaCommand.addCommand(
  action(
    new Command("candidates")
      .description(
        "List DNA edge candidates (discovered relationships awaiting review). Output (--json): {data: DnaEdgeCandidate[], next_cursor}.",
      )
      .option("--status <status>", "Filter by status: proposed, accepted, rejected, expired, promoted")
      .option("--object-id <id>", "Filter to candidates touching this object")
      .option("--relation-kind <kind>", "Filter by relation kind")
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "opaque pagination token from previous response's next_cursor"),
    async ({ client, globals, opts }) => {
      const page = await client.listDnaEdgeCandidates({
        status: opts.status,
        object_id: opts.objectId,
        relation_kind: opts.relationKind,
        limit: opts.limit,
        cursor: opts.cursor,
      });
      printPage(page, CANDIDATE_COLUMNS, globals);
    },
  ) as Command,
);

dnaCommand.addCommand(
  action(
    new Command("accept-candidate")
      .description("Accept a proposed edge candidate, making it eligible for promotion.")
      .argument("<candidate-id>", "DNA edge candidate id"),
    async ({ client, globals, cmd }) => {
      printValue(await client.acceptDnaEdgeCandidate(cmd.args[0]!), globals);
    },
  ) as Command,
);

dnaCommand.addCommand(
  action(
    new Command("reject-candidate")
      .description("Reject an edge candidate so it is never promoted.")
      .argument("<candidate-id>", "DNA edge candidate id"),
    async ({ client, globals, cmd }) => {
      printValue(await client.rejectDnaEdgeCandidate(cmd.args[0]!), globals);
    },
  ) as Command,
);

dnaCommand.addCommand(
  action(
    new Command("promote-candidate")
      .description(
        "Promote an accepted candidate into a durable semantic link. Requires a semantic_similarity signal and >=2 evidence chunks. Idempotent. Output (--json): {semantic_link, candidate, already_promoted, dry_run}.",
      )
      .argument("<candidate-id>", "DNA edge candidate id")
      .option("--dry-run", "Preview the would-be link without writing anything"),
    async ({ client, globals, opts, cmd }) => {
      printValue(
        await client.promoteDnaEdgeCandidate(cmd.args[0]!, { dryRun: !!opts.dryRun }),
        globals,
      );
    },
  ) as Command,
);
