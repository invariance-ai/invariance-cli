import { Command } from "commander";
import { action, printValue } from "../../lib/cmd.js";

export const askCommand = action(
  new Command("ask")
    .description(
      "Ask the Invariance knowledge agent a question. Maps to POST /v1/ask (requires an AGENT API KEY — 403 on operator tokens). Output (--json): the raw response object returned as-is by the backend (not enveloped).",
    )
    .argument("<question>", "Natural-language question")
    .option("--session-id <id>", "Continue an existing KB chat session")
    .option("--model <model>", "Override the answering model"),
  async ({ client, globals, opts, cmd }) => {
    const body: { message: string; session_id?: string; model?: string } = {
      message: cmd.args[0]!,
    };
    if (opts.sessionId !== undefined) body.session_id = opts.sessionId;
    if (opts.model !== undefined) body.model = opts.model;
    printValue(await client.ask(body), globals);
  },
) as Command;
