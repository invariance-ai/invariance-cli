import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";

import { InvarianceClient } from "../../lib/client.js";
import { resolveConfig, saveApiKey } from "../../lib/config.js";
import { formatOutput, success } from "../../lib/output.js";
import { setJsonMode } from "../../lib/runtime.js";
import type { GlobalOptions } from "../../types/index.js";

type MpcClient = "claude-code" | "codex" | "cursor" | "generic";

interface AgentSetupOutput {
  ok: true;
  base_url: string;
  agent_id: string;
  project_id: string;
  api_key_prefix: string | null;
  saved: boolean;
  env: Record<string, string>;
  commands: {
    smoke_run: string[];
    eval_seed_suite: string;
    counterfactual: string;
  };
  mcp: Record<MpcClient, unknown>;
  agent_prompt: string;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function redactedKey(apiKey: string | undefined, showSecret: boolean): string {
  if (!apiKey) return "<INVARIANCE_API_KEY>";
  if (showSecret) return apiKey;
  if (apiKey.length <= 12) return `${apiKey.slice(0, 4)}...`;
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
}

function mcpEnv(apiKey: string, baseUrl: string, showSecret: boolean): Record<string, string> {
  const env: Record<string, string> = {
    INVARIANCE_API_KEY: redactedKey(apiKey, showSecret),
  };
  if (baseUrl !== "https://api.useinvariance.com") env.INVARIANCE_API_URL = baseUrl;
  return env;
}

function buildOutput(input: {
  apiKey: string;
  baseUrl: string;
  agentId: string;
  projectId: string;
  apiKeyPrefix: string | null;
  saved: boolean;
  showSecret: boolean;
}): AgentSetupOutput {
  const env = mcpEnv(input.apiKey, input.baseUrl, input.showSecret);
  const envPairs = Object.entries(env).map(([key, value]) => `${key}=${shellQuote(value)}`);
  const envPrefix = envPairs.join(" ");
  const smokeRun = [
    "inv status --json",
    'RUN=$(inv run start --name agent-smoke --json | jq -r .id)',
    'inv node write "$RUN" --action-type tool_call --input \'{"tool":"setup"}\' --output \'{"ok":true}\' --json',
    'inv run finish "$RUN" --json',
    'inv run inspect "$RUN" --json',
  ];

  return {
    ok: true,
    base_url: input.baseUrl,
    agent_id: input.agentId,
    project_id: input.projectId,
    api_key_prefix: input.apiKeyPrefix,
    saved: input.saved,
    env,
    commands: {
      smoke_run: smokeRun,
      eval_seed_suite:
        "inv eval dataset seed-suite --name agent-regression --file cases.jsonl --run --json",
      counterfactual:
        'inv cortex counterfactual launch --project-id "$INVARIANCE_PROJECT_ID" --target run:"$RUN" --question "What if the tool result had failed?" --json',
    },
    mcp: {
      "claude-code": {
        command: `claude mcp add invariance --env ${envPairs.join(" --env ")} -- npx -y @invariance/mcp`,
      },
      codex: {
        config_toml:
          `[mcp_servers.invariance]\n` +
          `command = "npx"\n` +
          `args = ["-y", "@invariance/mcp"]\n` +
          `env = ${JSON.stringify(env)}`,
      },
      cursor: {
        mcp_json: {
          mcpServers: {
            invariance: {
              command: "npx",
              args: ["-y", "@invariance/mcp"],
              env,
            },
          },
        },
      },
      generic: {
        command: `${envPrefix} npx -y @invariance/mcp`,
      },
    },
    agent_prompt:
      "Use Invariance for this task: call invariance_doctor first, start or reuse a run, write a node for every tool call/decision, finish or fail the run, then seed eval cases from any useful regression examples.",
  };
}

export const setupCommand = new Command("setup")
  .description("One-command setup helpers for agent observability")
  .addCommand(
    new Command("agent")
      .description(
        "Validate an API key and print agent-ready env, MCP config, smoke-run, eval, and counterfactual commands.",
      )
      .option("--api-key <key>", "API key to validate and optionally save")
      .option("--api-url <url>", "Override API URL for this setup output")
      .option("--no-save", "Do not save --api-key to the CLI config")
      .option("--show-secret", "Print the full API key in generated env/MCP snippets")
      .addHelpText(
        "after",
        `
Examples:
  $ inv setup agent
  $ inv setup agent --api-key inv_live_... --json
  $ inv setup agent --api-key inv_live_... --no-save --show-secret --json`,
      )
      .action(
        async (
          opts: {
            apiKey?: string;
            apiUrl?: string;
            save?: boolean;
            showSecret?: boolean;
          },
          cmd: Command,
        ) => {
          const globals = cmd.optsWithGlobals<GlobalOptions>();
          setJsonMode(!!globals.json);

          const config = resolveConfig(globals.profile);
          const apiKey = opts.apiKey ?? config.apiKey;
          const baseUrl = (opts.apiUrl ?? config.baseUrl).replace(/\/+$/, "");
          if (!apiKey) {
            throw new Error(
              "No API key configured. Run `inv login --api-key <key>` or `inv setup agent --api-key <key>`.",
            );
          }

          const spinner = globals.json ? null : ora("Validating Invariance API key...").start();
          const client = new InvarianceClient({ apiKey, baseUrl });
          const me = await client.me();
          spinner?.succeed("API key validated.");

          const shouldSave = opts.apiKey !== undefined && opts.save !== false;
          if (shouldSave) {
            saveApiKey(opts.apiKey!, globals.profile);
            success(
              globals.profile
                ? `Saved API key to profile ${globals.profile}.`
                : "Saved API key to CLI config.",
            );
          }

          const output = buildOutput({
            apiKey,
            baseUrl,
            agentId: me.agent.id,
            projectId: me.agent.project_id,
            apiKeyPrefix: me.api_key?.prefix ?? null,
            saved: shouldSave,
            showSecret: !!opts.showSecret,
          });

          if (globals.json) {
            formatOutput(output, { json: true });
            return;
          }

          console.log(chalk.bold("\nAgent observability setup\n"));
          console.log(`  Agent: ${output.agent_id}`);
          console.log(`  Project: ${output.project_id}`);
          console.log(`  API: ${output.base_url}`);
          console.log("\nExport for shells/CI:");
          for (const [key, value] of Object.entries(output.env)) {
            console.log(`  export ${key}=${shellQuote(value)}`);
          }
          console.log("\nMCP:");
          console.log(`  Claude Code: ${(output.mcp["claude-code"] as { command: string }).command}`);
          console.log("  Codex config.toml:");
          console.log(
            String((output.mcp.codex as { config_toml: string }).config_toml)
              .split("\n")
              .map((line) => `    ${line}`)
              .join("\n"),
          );
          console.log("\nSmoke run:");
          for (const line of output.commands.smoke_run) console.log(`  ${line}`);
          console.log("\nEval seed:");
          console.log(`  ${output.commands.eval_seed_suite}`);
          console.log("\nCounterfactual:");
          console.log(`  ${output.commands.counterfactual}`);
        },
      ),
  );
