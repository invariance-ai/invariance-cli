import { Command } from "commander";

import { loginCommand, makeLoginCommand } from "./commands/auth/login.js";
import { logoutCommand, makeLogoutCommand } from "./commands/auth/logout.js";
import { whoamiCommand } from "./commands/auth/whoami.js";
import { signupCommand } from "./commands/auth/signup.js";
import { signinCommand } from "./commands/auth/signin.js";
import { refreshCommand } from "./commands/auth/refresh.js";
import { issueKeyCommand } from "./commands/auth/issue-key.js";
import { configGetCommand } from "./commands/config/get.js";
import { configSetCommand } from "./commands/config/set.js";
import { configSetAiKeyCommand } from "./commands/config/set-ai-key.js";
import { configListAiKeysCommand } from "./commands/config/list-ai-keys.js";
import { runCommand } from "./commands/run/index.js";
import { caseCommand } from "./commands/case/index.js";
import { nodeCommand } from "./commands/node/index.js";
import { monitorCommand } from "./commands/monitor/index.js";
import { signalCommand } from "./commands/signal/index.js";
import { findingCommand } from "./commands/finding/index.js";
import { reviewCommand } from "./commands/review/index.js";
import { agentCommand } from "./commands/agent/index.js";
import { operatorCommand } from "./commands/operator/index.js";
import { sessionCommand } from "./commands/session/index.js";
import { memoryCommand } from "./commands/memory/index.js";
import { metricsCommand } from "./commands/metrics/index.js";
import { dnaCommand } from "./commands/dna/index.js";
import { graphCommand } from "./commands/graph/index.js";
import { recipesCommand } from "./commands/recipes/index.js";
import { guardrailsCommand } from "./commands/guardrails/index.js";
import { evalCommand } from "./commands/eval/index.js";
import { evalsCommand } from "./commands/evals/index.js";
import { recordCommand } from "./commands/record/index.js";
import { statusCommand } from "./commands/status.js";
import { doctorCommand } from "./commands/doctor.js";
import { completionsCommand } from "./commands/completions.js";
import { versionCommand } from "./commands/version.js";

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("inv")
    .description(
      "The Invariance AI command-line interface (`inv`, alias `invariance`).\n\n" +
        "Designed for agents and humans: every read command supports --json and emits\n" +
        "stable IDs so coding/ops agents can chain commands without scraping output.\n\n" +
        "Covers cases, runs, nodes, monitors, signals, findings, reviews, agents, metrics, eval,\n" +
        "and stub command groups for graph/recipes/guardrails/evals (backend pending).\n\n" +
        "Get started:\n" +
        "  $ inv login\n" +
        "  $ inv status\n" +
        "  $ inv case list --json\n" +
        "  $ inv run start --name triage --case-id case_abc --json",
    )
    .option("--json", "Output results as JSON")
    .option("--profile <name>", "Use a named configuration profile")
    .option("--no-color", "Disable colored output");

  const auth = new Command("auth").description("Manage authentication");
  auth.addCommand(loginCommand);
  auth.addCommand(logoutCommand);
  auth.addCommand(whoamiCommand);
  auth.addCommand(signupCommand);
  auth.addCommand(signinCommand);
  auth.addCommand(refreshCommand);
  auth.addCommand(issueKeyCommand);
  program.addCommand(auth);

  const config = new Command("config").description("Manage CLI configuration");
  config.addCommand(configGetCommand);
  config.addCommand(configSetCommand);
  config.addCommand(configSetAiKeyCommand);
  config.addCommand(configListAiKeysCommand);
  program.addCommand(config);

  // Plural aliases (`runs`, `nodes`, `signals`, `findings`, `reviews`) match
  // the agent-tool surface in the spec while the singular forms remain primary
  // for backward compatibility with existing scripts and docs. `buildProgram`
  // is called per-test, so guard against duplicate-alias errors from commander.
  const ensureAlias = (cmd: Command, alias: string) => {
    if (!cmd.aliases().includes(alias)) cmd.alias(alias);
  };
  ensureAlias(runCommand, "runs");
  ensureAlias(caseCommand, "cases");
  ensureAlias(nodeCommand, "nodes");
  ensureAlias(signalCommand, "signals");
  ensureAlias(findingCommand, "findings");
  ensureAlias(reviewCommand, "reviews");

  program.addCommand(caseCommand);
  program.addCommand(runCommand);
  program.addCommand(nodeCommand);
  program.addCommand(monitorCommand);
  program.addCommand(signalCommand);
  program.addCommand(findingCommand);
  program.addCommand(reviewCommand);
  program.addCommand(agentCommand);
  program.addCommand(operatorCommand);
  program.addCommand(sessionCommand);
  program.addCommand(memoryCommand);
  program.addCommand(metricsCommand);
  program.addCommand(dnaCommand);
  program.addCommand(graphCommand);
  program.addCommand(recipesCommand);
  program.addCommand(guardrailsCommand);
  program.addCommand(evalCommand);
  program.addCommand(evalsCommand);
  program.addCommand(recordCommand);
  program.addCommand(statusCommand);

  // Top-level ergonomics: `invariance login` / `invariance logout` mirror
  // `invariance auth login` / `invariance auth logout` (Netlify/Vercel style).
  // Fresh Command instances are used (not the ones already attached under
  // `auth`), since a Command can only belong to one parent.
  program.addCommand(makeLoginCommand("login"));
  program.addCommand(makeLogoutCommand("logout"));

  program.addCommand(completionsCommand);
  program.addCommand(doctorCommand);
  program.addCommand(versionCommand);

  return program;
}

if (process.env.INVARIANCE_CLI_SKIP_PARSE !== "1") {
  buildProgram().parse();
}
