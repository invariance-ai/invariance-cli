import { Command } from "commander";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";
import { getSessionClient } from "../../lib/auth.js";
import { handleError } from "../../lib/errors.js";

export const agentCommand = new Command("agent").description("Manage agents");

agentCommand.addCommand(
  action(new Command("me").description("Show the caller agent + API key info"), async ({ client, globals }) => {
    printValue(await client.me(), globals);
  }) as Command,
);

agentCommand.addCommand(
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

agentCommand.addCommand(
  new Command("create")
    .description("Create a new agent in one of your projects (requires signed-in user session)")
    .requiredOption("--name <name>", "Agent name")
    .option("--project-id <id>", "Project ID (default: first accessible project)")
    .option("--public-key <hex>", "Optional Ed25519 public key (64-char hex)")
    .action(async (opts: { name: string; projectId?: string; publicKey?: string }, cmd: Command) => {
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
        const agent = await client.createAgent({
          name: opts.name,
          project_id: projectId,
          ...(opts.publicKey ? { public_key: opts.publicKey } : {}),
        });
        printValue(agent, { json: globals.json });
      } catch (error) {
        handleError(error);
      }
    }),
);

agentCommand.addCommand(
  new Command("list")
    .description("List agents in a project (requires signed-in user session)")
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
        const page = await client.listAgents(projectId);
        printPage(
          page,
          [
            { key: "id", label: "ID" },
            { key: "name", label: "NAME" },
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

agentCommand.addCommand(
  new Command("get")
    .description("Get an agent by ID (requires signed-in user session)")
    .argument("<id>", "Agent ID")
    .action(async (id: string, _opts: object, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<{ json?: boolean; profile?: string }>();
        const client = getSessionClient(globals.profile);
        printValue(await client.getAgent(id), { json: globals.json });
      } catch (error) {
        handleError(error);
      }
    }),
);
