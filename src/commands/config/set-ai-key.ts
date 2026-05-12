import { Command } from "commander";
import { aiKeyEnvVar, isAiProvider, setAiKey } from "../../lib/config.js";
import { success } from "../../lib/output.js";
import { ConfigError, handleError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";
import { AI_PROVIDERS } from "../../types/index.js";

export const configSetAiKeyCommand = new Command("set-ai-key")
  .description(
    "Store an AI provider API key (Anthropic / OpenAI / Braintrust) for running eval models. " +
      "These keys are kept locally and never sent to the Invariance API.",
  )
  .argument(
    "<provider>",
    `One of: ${AI_PROVIDERS.join(", ")} (braintrustBaseUrl sets the Braintrust proxy base URL)`,
  )
  .argument("<value>", "API key value (or URL for braintrustBaseUrl)")
  .addHelpText(
    "after",
    `
Providers and their env-var equivalents:
  anthropic           → ANTHROPIC_API_KEY
  openai              → OPENAI_API_KEY
  braintrust          → BRAINTRUST_API_KEY
  braintrustBaseUrl   → BRAINTRUST_OPENAI_BASE_URL

Env vars take precedence over stored values, in this order:
  env > profile aiKeys > root aiKeys

Examples:
  $ inv config set-ai-key anthropic sk-ant-...
  $ inv config set-ai-key openai sk-...
  $ inv config set-ai-key braintrustBaseUrl https://api.braintrust.dev/v1/proxy
  $ inv config set-ai-key anthropic sk-ant-... --profile staging`,
  )
  .action((provider: string, value: string, _opts: Record<string, unknown>, cmd: Command) => {
    try {
      if (!isAiProvider(provider)) {
        throw new ConfigError(
          `Unknown AI provider: '${provider}'. Valid: ${AI_PROVIDERS.join(", ")}.`,
        );
      }
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      setAiKey(provider, value, globalOpts.profile);
      const env = aiKeyEnvVar(provider);
      const scope = globalOpts.profile ? ` (profile: ${globalOpts.profile})` : "";
      success(`Stored ${provider}${scope}. Overridable via $${env}.`);
    } catch (error) {
      handleError(error);
    }
  });
