import { Command } from "commander";
import { aiKeyEnvVar, resolveAiKeys } from "../../lib/config.js";
import { formatOutput } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";
import { AI_PROVIDERS, type AiProvider } from "../../types/index.js";

function mask(value: string | undefined): string {
  if (!value) return "(not set)";
  if (value.length <= 8) return "***";
  return value.slice(0, 8) + "…" + value.slice(-4);
}

export const configListAiKeysCommand = new Command("list-ai-keys")
  .description("Show which AI provider keys are resolvable (env var or stored config)")
  .action((_opts: Record<string, unknown>, cmd: Command) => {
    try {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const resolved = resolveAiKeys(globalOpts.profile);

      const rows = AI_PROVIDERS.map((provider: AiProvider) => {
        const env = aiKeyEnvVar(provider);
        const fromEnv = process.env[env];
        const source = fromEnv ? "env" : resolved[provider] ? "config" : "none";
        return {
          provider,
          env_var: env,
          source,
          value: provider === "braintrustBaseUrl" ? (resolved[provider] ?? null) : mask(resolved[provider]),
        };
      });

      if (globalOpts.json) {
        formatOutput({ keys: rows }, { json: true });
      } else {
        for (const r of rows) {
          console.log(
            `${r.provider.padEnd(20)} ${r.source.padEnd(8)} ${r.value ?? "(not set)"}  [$${r.env_var}]`,
          );
        }
      }
    } catch (error) {
      handleError(error);
    }
  });
