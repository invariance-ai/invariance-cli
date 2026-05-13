import { Command } from "commander";
import { parseIntFlag, printPage, printValue } from "../../lib/cmd.js";
import { getAuthenticatedClient, getSessionClient } from "../../lib/auth.js";
import { handleError } from "../../lib/errors.js";
import type { OperatorType } from "../../types/index.js";

export const operatorCommand = new Command("operator").description(
  "Manage operators (canonical superset of agents; type = agent | human)",
);

const OPERATOR_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "name", label: "NAME" },
  { key: "operator_type", label: "TYPE" },
  { key: "project_id", label: "PROJECT" },
];

function parseOperatorType(value: string): OperatorType {
  if (value !== "agent" && value !== "human") {
    throw new Error(`Invalid --type "${value}". Expected "agent" or "human".`);
  }
  return value;
}

operatorCommand.addCommand(
  new Command("me")
    .description("Show the caller operator (uses API key, mirrors `inv agent me`)")
    .action(async (_opts: object, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<{ json?: boolean; profile?: string }>();
        // /v1/operators/me is API-key-authed on the server, same as /v1/agents/me.
        const client = getAuthenticatedClient(globals.profile);
        const { operator } = await client.meOperator();
        printValue(operator, { json: globals.json });
      } catch (error) {
        handleError(error);
      }
    }),
);

operatorCommand.addCommand(
  new Command("create")
    .description("Create a new operator (agent or human) in one of your projects")
    .requiredOption("--name <name>", "Operator name")
    .requiredOption("--type <type>", "Operator type: agent | human", parseOperatorType)
    .option("--project-id <id>", "Project ID (default: first accessible project)")
    .option("--public-key <hex>", "Optional Ed25519 public key (agent operators only)")
    .action(
      async (
        opts: { name: string; type: OperatorType; projectId?: string; publicKey?: string },
        cmd: Command,
      ) => {
        try {
          const globals = cmd.optsWithGlobals<{ json?: boolean; profile?: string }>();
          const client = getSessionClient(globals.profile);
          let projectId = opts.projectId;
          if (!projectId) {
            const me = await client.authMe();
            if (me.projects.length === 0) {
              throw new Error("No accessible projects found on your account.");
            }
            projectId = me.projects[0]!.id;
          }
          const operator = await client.createOperator({
            name: opts.name,
            operator_type: opts.type,
            project_id: projectId,
            ...(opts.publicKey ? { public_key: opts.publicKey } : {}),
          });
          printValue(operator, { json: globals.json });
        } catch (error) {
          handleError(error);
        }
      },
    ),
);

operatorCommand.addCommand(
  new Command("list")
    .description("List operators in a project")
    .option("--project-id <id>", "Project ID (default: first accessible project)")
    .option("--type <type>", "Filter by type: agent | human", parseOperatorType)
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--limit <n>", "Page size", parseIntFlag)
    .action(
      async (
        opts: { projectId?: string; type?: OperatorType; cursor?: string; limit?: number },
        cmd: Command,
      ) => {
        try {
          const globals = cmd.optsWithGlobals<{ json?: boolean; profile?: string }>();
          const client = getSessionClient(globals.profile);
          let projectId = opts.projectId;
          if (!projectId) {
            const me = await client.authMe();
            if (me.projects.length === 0) {
              throw new Error("No accessible projects found on your account.");
            }
            projectId = me.projects[0]!.id;
          }
          const page = await client.listOperators({ project_id: projectId, type: opts.type });
          printPage(page, OPERATOR_COLUMNS, { json: globals.json });
        } catch (error) {
          handleError(error);
        }
      },
    ),
);

operatorCommand.addCommand(
  new Command("get")
    .description("Get an operator by ID")
    .argument("<id>", "Operator ID")
    .action(async (id: string, _opts: object, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<{ json?: boolean; profile?: string }>();
        const client = getSessionClient(globals.profile);
        printValue(await client.getOperator(id), { json: globals.json });
      } catch (error) {
        handleError(error);
      }
    }),
);
