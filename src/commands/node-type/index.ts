import { Command } from "commander";
import { action, parseJsonFlag, printPage, printValue } from "../../lib/cmd.js";
import type { CreateNodeTypeRequest } from "../../types/index.js";

const COLUMNS = [
  { key: "name", label: "Name", width: 28 },
  { key: "display_name", label: "Display", width: 28 },
  { key: "builtin", label: "Builtin", width: 9 },
];

export const nodeTypeCommand = new Command("node-type").description(
  "List and register custom node types (with field schemas + aggregation hints).",
);

nodeTypeCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List node types. Maps to GET /v1/node-types. Output (--json): {data: NodeType[], next_cursor} where NodeType = {name, agent_id, display_name, custom_fields_schema, aggregation_hints, builtin, created_at, updated_at}",
      ),
    async ({ client, globals }) => {
      printPage(await client.listNodeTypes(), COLUMNS, globals);
    },
  ) as Command,
);

nodeTypeCommand.addCommand(
  action(
    new Command("register")
      .description(
        "Register a custom node type. Maps to POST /v1/node-types. Output (--json): the created NodeType.",
      )
      .requiredOption("--name <name>", "Node-type identifier, e.g. payment.refund")
      .option("--display-name <name>", "Human-friendly label")
      .option("--custom-fields-schema <json>", "JSON schema object for custom fields")
      .option("--aggregation-hints <json>", "JSON object of aggregation hints"),
    async ({ client, globals, opts }) => {
      const body: CreateNodeTypeRequest = { name: opts.name };
      if (opts.displayName !== undefined) body.display_name = opts.displayName;
      if (opts.customFieldsSchema !== undefined) {
        body.custom_fields_schema = parseJsonFlag(
          "custom-fields-schema",
          opts.customFieldsSchema,
        ) as Record<string, unknown>;
      }
      if (opts.aggregationHints !== undefined) {
        body.aggregation_hints = parseJsonFlag(
          "aggregation-hints",
          opts.aggregationHints,
        ) as Record<string, unknown>;
      }
      printValue(await client.registerNodeType(body), globals);
    },
  ) as Command,
);
