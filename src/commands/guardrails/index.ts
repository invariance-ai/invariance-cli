import { Command } from "commander";
import { emitApiNotAvailable } from "../../lib/stub.js";
import type { GlobalOptions } from "../../types/index.js";

export const guardrailsCommand = new Command("guardrails").description(
  "Guardrails (stub — backend pending)",
);

const g = (cmd: Command) => cmd.optsWithGlobals<GlobalOptions>();

guardrailsCommand
  .command("list")
  .description("List guardrails (stub).")
  .action((_o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv guardrails list", g(cmd)),
  );

guardrailsCommand
  .command("promote <guardrail-id>")
  .description("Promote a guardrail to a deployment mode (stub).")
  .requiredOption(
    "--mode <mode>",
    "Promotion mode: shadow | active-monitor",
    (value) => {
      if (!["shadow", "active-monitor"].includes(value)) {
        throw new Error("--mode must be one of: shadow, active-monitor");
      }
      return value;
    },
  )
  .action((_id: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv guardrails promote", g(cmd)),
  );
