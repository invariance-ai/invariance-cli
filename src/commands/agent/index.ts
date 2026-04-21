import { Command } from "commander";
import { action, printValue } from "../../lib/cmd.js";

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
