import { Command } from "commander";
import { action, printPage, printValue } from "../../lib/cmd.js";

const COLUMNS = [
  { key: "id", label: "ID", width: 26 },
  { key: "name", label: "Name", width: 24 },
  { key: "project_id", label: "Project", width: 26 },
  { key: "created_at", label: "Created", width: 24 },
];

export const agentCommand = new Command("agent").description("Manage agents");

agentCommand.addCommand(
  action(new Command("me").description("Show the caller agent + API key info"), async ({ client, globals }) => {
    printValue(await client.me(), globals);
  }) as Command,
);

agentCommand.addCommand(
  action(
    new Command("list").description("List agents in a project").requiredOption("--project-id <id>", "Project id"),
    async ({ client, globals, opts }) => {
      printPage(await client.listAgents(opts.projectId), COLUMNS, globals);
    },
  ) as Command,
);

agentCommand.addCommand(
  action(new Command("get").description("Show an agent").argument("<id>"), async ({ client, globals, cmd }) => {
    printValue(await client.getAgent(cmd.args[0]!), globals);
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
