import { Command } from "commander";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";
import { getSessionClient } from "../../lib/auth.js";
import { handleError } from "../../lib/errors.js";

function buildOperatorCommand(name: string, description: string): Command {
  const command = new Command(name).description(description);

command.addCommand(
  action(new Command("me").description("Show the caller agent + API key info"), async ({ client, globals }) => {
    printValue(await client.me(), globals);
  }) as Command,
);

command.addCommand(
  action(
    new Command("set-key")
      .description("Register an Ed25519 public key for the caller agent")
      .requiredOption("--public-key <hex>", "Ed25519 public key (64-char hex)"),
    async ({ client, globals, opts }) => {
      printValue(await client.rotateAgentKey(opts.publicKey), globals);
    },
  ) as Command,
);

// `create`, `list`, and `get` use the user-session bearer (Supabase JWT) since
// the platform requires user auth on these routes — API-key auth would 401.
// Run `inv auth signin` (or `inv auth signup`) first.

command.addCommand(
  new Command("create")
    .description("Create a new operator in one of your projects (requires signed-in user session)")
    .requiredOption("--name <name>", "Operator name")
    .option("--project-id <id>", "Project ID (default: first accessible project)")
    .option("--type <agent|human>", "Operator type", "agent")
    .option("--public-key <hex>", "Optional Ed25519 public key (64-char hex)")
    .action(async (opts: { name: string; projectId?: string; type?: "agent" | "human"; publicKey?: string }, cmd: Command) => {
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
          project_id: projectId,
          operator_type: opts.type === "human" ? "human" : "agent",
          ...(opts.publicKey ? { public_key: opts.publicKey } : {}),
        });
        printValue(operator, { json: globals.json });
      } catch (error) {
        handleError(error);
      }
    }),
);

command.addCommand(
  new Command("list")
    .description("List operators in a project (requires signed-in user session)")
    .option("--project-id <id>", "Project ID (default: first accessible project)")
    .option("--cursor <cursor>", "Pagination cursor")
    .option("--limit <n>", "Page size", parseIntFlag)
    .action(async (opts: { projectId?: string; cursor?: string; limit?: number }, cmd: Command) => {
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
        const page = await client.listOperators(projectId);
        printPage(
          page,
          [
            { key: "id", label: "ID" },
            { key: "name", label: "NAME" },
            { key: "operator_type", label: "TYPE" },
            { key: "project_id", label: "PROJECT" },
            { key: "created_at", label: "CREATED" },
          ],
          { json: globals.json },
        );
      } catch (error) {
        handleError(error);
      }
    }),
);

command.addCommand(
  new Command("get")
    .description("Get an operator by ID (requires signed-in user session)")
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

  return command;
}

export const agentCommand = buildOperatorCommand("agent", "Manage agents");
export const operatorCommand = buildOperatorCommand("operator", "Manage operators");
