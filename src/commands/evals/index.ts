import { Command } from "commander";
import { emitApiNotAvailable } from "../../lib/stub.js";
import type { GlobalOptions } from "../../types/index.js";

export const evalsCommand = new Command("evals").description(
  "Evals over Invariance outputs (stub — backend pending)",
);

const g = (cmd: Command) => cmd.optsWithGlobals<GlobalOptions>();

evalsCommand
  .command("create-case")
  .description(
    "Create an eval case from a run, finding, or graph. Exactly one --from-* is required.",
  )
  .option("--from-run <run-id>", "Source: run id")
  .option("--from-finding <finding-id>", "Source: finding id")
  .option("--from-graph <run-id>", "Source: run id (graph view)")
  .requiredOption("--suite <suite>", "Eval suite to attach the case to")
  .action((opts: Record<string, string | undefined>, cmd: Command) => {
    const sources = [opts.fromRun, opts.fromFinding, opts.fromGraph].filter(Boolean);
    if (sources.length !== 1) {
      const globals = g(cmd);
      const payload = {
        error: {
          code: "INVALID_ARGS",
          message: "Exactly one of --from-run, --from-finding, --from-graph is required.",
          retryable: false,
          suggested_fix:
            "Pass exactly one source flag, e.g. `inv evals create-case --from-run <id> --suite <suite>`.",
        },
      };
      if (globals.json) process.stdout.write(JSON.stringify(payload) + "\n");
      else process.stderr.write(`Error: ${payload.error.message}\n`);
      process.exit(2);
    }
    emitApiNotAvailable("inv evals create-case", g(cmd));
  });

evalsCommand
  .command("list")
  .description("List eval suites (stub).")
  .action((_o: unknown, cmd: Command) => emitApiNotAvailable("inv evals list", g(cmd)));

evalsCommand
  .command("run <suite>")
  .description("Run an eval suite against a target (stub).")
  .action((_s: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv evals run", g(cmd)),
  );

evalsCommand
  .command("export <suite>")
  .description("Export an eval suite (stub).")
  .option("--format <fmt>", "Export format: jsonl|json", "jsonl")
  .action((_s: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv evals export", g(cmd)),
  );

evalsCommand
  .command("run-byo <suite>")
  .description("Run a bring-your-own-runner eval (stub). Pass runner cmd after `--`.")
  .allowUnknownOption(true)
  .action((_s: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv evals run-byo", g(cmd)),
  );

evalsCommand
  .command("ingest-results <file>")
  .description("Ingest external eval run results (stub).")
  .action((_f: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv evals ingest-results", g(cmd)),
  );

evalsCommand
  .command("results <eval-run-id>")
  .description("Show results for an eval run (stub).")
  .action((_id: string, _o: unknown, cmd: Command) =>
    emitApiNotAvailable("inv evals results", g(cmd)),
  );
