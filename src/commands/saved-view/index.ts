import { Command } from "commander";
import { action, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";
import {
  DashboardVizSchema,
  QuerySourceSchema,
  SavedViewVisibilitySchema,
  type CreateSavedViewRequest,
  type DashboardViz,
  type QuerySource,
  type QuerySpec,
  type RunQueryRequest,
  type SavedViewVisibility,
  type UpdateSavedViewRequest,
} from "../../types/index.js";

const COLUMNS = [
  { key: "id", label: "ID", width: 28 },
  { key: "name", label: "Name", width: 28 },
  { key: "source", label: "Source", width: 12 },
  { key: "viz", label: "Viz", width: 8 },
  { key: "visibility", label: "Visibility", width: 10 },
];

function parseSource(value: string): QuerySource {
  const parsed = QuerySourceSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`--source must be one of: ${QuerySourceSchema.options.join(", ")}`);
  }
  return parsed.data;
}

function parseViz(value: string): DashboardViz {
  const parsed = DashboardVizSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`--viz must be one of: ${DashboardVizSchema.options.join(", ")}`);
  }
  return parsed.data;
}

function parseVisibility(value: string): SavedViewVisibility {
  const parsed = SavedViewVisibilitySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`--visibility must be one of: ${SavedViewVisibilitySchema.options.join(", ")}`);
  }
  return parsed.data;
}

export const savedViewCommand = new Command("saved-view").description(
  "Create, manage, and run saved dashboard queries over executions/events/runs/nodes/captures.",
);

savedViewCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List saved views. Maps to GET /v1/saved-views (no pagination). Output (--json): {data: SavedView[]} where SavedView = {id, agent_id, name, source, spec, viz, visibility, created_at, updated_at}",
      ),
    async ({ client, globals }) => {
      printPage(await client.listSavedViews(), COLUMNS, globals);
    },
  ) as Command,
);

savedViewCommand.addCommand(
  action(
    new Command("create")
      .description(
        "Create a saved view. Maps to POST /v1/saved-views. Output (--json): the created SavedView.",
      )
      .requiredOption("--name <name>", "Display name")
      .requiredOption("--source <source>", QuerySourceSchema.options.join(" | "))
      .requiredOption("--spec <json>", "QuerySpec as JSON, e.g. '{\"aggregation\":\"count\"}'")
      .option("--viz <viz>", DashboardVizSchema.options.join(" | "))
      .option("--visibility <vis>", SavedViewVisibilitySchema.options.join(" | ")),
    async ({ client, globals, opts }) => {
      const spec = parseJsonFlag("spec", opts.spec) as QuerySpec;
      const body: CreateSavedViewRequest = {
        name: opts.name,
        source: parseSource(opts.source),
        spec,
      };
      if (opts.viz) body.viz = parseViz(opts.viz);
      if (opts.visibility) body.visibility = parseVisibility(opts.visibility);
      printValue(await client.createSavedView(body), globals);
    },
  ) as Command,
);

savedViewCommand.addCommand(
  action(
    new Command("get")
      .description("Show a saved view. Maps to GET /v1/saved-views/:id. Output (--json): the SavedView.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getSavedView(cmd.args[0]!), globals);
    },
  ) as Command,
);

savedViewCommand.addCommand(
  action(
    new Command("update")
      .description(
        "Update a saved view (any subset of fields). Maps to PATCH /v1/saved-views/:id. Output (--json): the updated SavedView.",
      )
      .argument("<id>")
      .option("--name <name>")
      .option("--source <source>", QuerySourceSchema.options.join(" | "))
      .option("--spec <json>", "QuerySpec as JSON")
      .option("--viz <viz>", DashboardVizSchema.options.join(" | "))
      .option("--visibility <vis>", SavedViewVisibilitySchema.options.join(" | ")),
    async ({ client, globals, opts, cmd }) => {
      const patch: UpdateSavedViewRequest = {};
      if (opts.name !== undefined) patch.name = opts.name;
      if (opts.source !== undefined) patch.source = parseSource(opts.source);
      if (opts.spec !== undefined) patch.spec = parseJsonFlag("spec", opts.spec) as QuerySpec;
      if (opts.viz !== undefined) patch.viz = parseViz(opts.viz);
      if (opts.visibility !== undefined) patch.visibility = parseVisibility(opts.visibility);
      printValue(await client.updateSavedView(cmd.args[0]!, patch), globals);
    },
  ) as Command,
);

savedViewCommand.addCommand(
  action(
    new Command("delete")
      .description("Delete a saved view. Maps to DELETE /v1/saved-views/:id. Output (--json): {ok: true}.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      await client.deleteSavedView(cmd.args[0]!);
      printValue({ ok: true }, globals);
    },
  ) as Command,
);

savedViewCommand.addCommand(
  action(
    new Command("run")
      .description(
        "Run a saved view by id, or an ad-hoc query. Maps to POST /v1/saved-views/run. Pass EITHER --id OR (--source + --spec), not both. Output (--json): {source, scalar?, groups?, rows?, row_count, truncated}.",
      )
      .option("--id <saved-view-id>", "Run a stored saved view by id")
      .option("--source <source>", `Ad-hoc query source: ${QuerySourceSchema.options.join(" | ")}`)
      .option("--spec <json>", "Ad-hoc QuerySpec as JSON"),
    async ({ client, globals, opts }) => {
      const hasId = opts.id !== undefined;
      const hasAdhoc = opts.source !== undefined || opts.spec !== undefined;
      if (hasId === hasAdhoc) {
        throw new Error("Pass exactly one of --id OR (--source + --spec).");
      }
      let body: RunQueryRequest;
      if (hasId) {
        body = { saved_view_id: opts.id };
      } else {
        if (opts.source === undefined || opts.spec === undefined) {
          throw new Error("Ad-hoc query requires both --source and --spec.");
        }
        body = {
          source: parseSource(opts.source),
          spec: parseJsonFlag("spec", opts.spec) as QuerySpec,
        };
      }
      printValue(await client.runSavedView(body), globals);
    },
  ) as Command,
);
