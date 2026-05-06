import { Command } from "commander";
import { emitApiNotAvailable } from "../../lib/stub.js";
import type { GlobalOptions } from "../../types/index.js";

/**
 * Operational graph commands. The backend graph API is not implemented yet
 * (tracked in platform); these commands are stubs that emit a structured
 * `API_NOT_AVAILABLE` error so coding agents can branch on it without
 * scraping stack traces.
 */
export const graphCommand = new Command("graph").description(
  "Operational graph: entities and edges per run (stub — backend pending)",
);

function globals(cmd: Command): GlobalOptions {
  return cmd.optsWithGlobals<GlobalOptions>();
}

graphCommand
  .command("get <run-id>")
  .description(
    "Fetch the operational graph for a run. Output (--json): {run_id, entities, edges} (stub).",
  )
  .action((_id: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv graph get", globals(cmd)),
  );

graphCommand
  .command("entities <run-id>")
  .description("List graph entities for a run (stub — backend pending).")
  .action((_id: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv graph entities", globals(cmd)),
  );

graphCommand
  .command("edges <run-id>")
  .description("List graph edges for a run (stub — backend pending).")
  .action((_id: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv graph edges", globals(cmd)),
  );

graphCommand
  .command("explain-edge <edge-id>")
  .description("Explain a graph edge (stub — backend pending).")
  .action((_id: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv graph explain-edge", globals(cmd)),
  );
