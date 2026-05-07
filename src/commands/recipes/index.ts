import { Command } from "commander";
import { emitApiNotAvailable } from "../../lib/stub.js";
import type { GlobalOptions } from "../../types/index.js";

export const recipesCommand = new Command("recipes").description(
  "Recipe library (stub — backend pending)",
);

const g = (cmd: Command) => cmd.optsWithGlobals<GlobalOptions>();

recipesCommand
  .command("list")
  .description("List recipes (stub).")
  .action((_o: unknown, cmd: Command) => emitApiNotAvailable("inv recipes list", g(cmd)));

recipesCommand
  .command("get <recipe-id>")
  .description("Show a recipe (stub).")
  .action((_id: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv recipes get", g(cmd)),
  );

recipesCommand
  .command("test <recipe-id>")
  .description("Test a recipe against a run (stub).")
  .requiredOption("--run <run-id>", "Run id to test against")
  .action((_id: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv recipes test", g(cmd)),
  );
