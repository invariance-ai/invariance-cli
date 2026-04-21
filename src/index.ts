import { Command } from "commander";

import { loginCommand } from "./commands/auth/login.js";
import { logoutCommand } from "./commands/auth/logout.js";
import { whoamiCommand } from "./commands/auth/whoami.js";
import { configGetCommand } from "./commands/config/get.js";
import { configSetCommand } from "./commands/config/set.js";
import { runCommand } from "./commands/run/index.js";
import { nodeCommand } from "./commands/node/index.js";
import { monitorCommand } from "./commands/monitor/index.js";
import { signalCommand } from "./commands/signal/index.js";
import { findingCommand } from "./commands/finding/index.js";
import { reviewCommand } from "./commands/review/index.js";
import { agentCommand } from "./commands/agent/index.js";
import { metricsCommand } from "./commands/metrics/index.js";
import { doctorCommand } from "./commands/doctor.js";
import { completionsCommand } from "./commands/completions.js";
import { versionCommand } from "./commands/version.js";

const program = new Command();

program
  .name("invariance")
  .description(
    "The Invariance AI command-line interface.\n\n" +
      "Covers every dashboard resource: runs, nodes, monitors, signals, findings,\n" +
      "reviews, agents, and metrics. Authenticates with API keys via Bearer auth.\n\n" +
      "Get started:\n" +
      "  $ invariance auth login\n" +
      "  $ invariance agent me",
  )
  .option("--json", "Output results as JSON")
  .option("--profile <name>", "Use a named configuration profile")
  .option("--no-color", "Disable colored output");

// auth
const auth = new Command("auth").description("Manage authentication");
auth.addCommand(loginCommand);
auth.addCommand(logoutCommand);
auth.addCommand(whoamiCommand);
program.addCommand(auth);

// config
const config = new Command("config").description("Manage CLI configuration");
config.addCommand(configGetCommand);
config.addCommand(configSetCommand);
program.addCommand(config);

// Resource commands
program.addCommand(runCommand);
program.addCommand(nodeCommand);
program.addCommand(monitorCommand);
program.addCommand(signalCommand);
program.addCommand(findingCommand);
program.addCommand(reviewCommand);
program.addCommand(agentCommand);
program.addCommand(metricsCommand);

// top-level utilities
program.addCommand(completionsCommand);
program.addCommand(doctorCommand);
program.addCommand(versionCommand);

program.parse();
