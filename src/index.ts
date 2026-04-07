import { Command } from "commander";

import { loginCommand } from "./commands/auth/login.js";
import { logoutCommand } from "./commands/auth/logout.js";
import { whoamiCommand } from "./commands/auth/whoami.js";
import { configGetCommand } from "./commands/config/get.js";
import { configSetCommand } from "./commands/config/set.js";
import { traceListCommand } from "./commands/trace/list.js";
import { traceGetCommand } from "./commands/trace/get.js";
import { monitorListCommand } from "./commands/monitor/list.js";
import { monitorRunCommand } from "./commands/monitor/run.js";
import { signalListCommand } from "./commands/signal/list.js";
import { queryCommand } from "./commands/query.js";
import { initCommand } from "./commands/init.js";
import { doctorCommand } from "./commands/doctor.js";
import { versionCommand } from "./commands/version.js";

const program = new Command();

program
  .name("invariance")
  .description("The Invariance AI command-line interface")
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

// trace
const trace = new Command("trace").description("Inspect and manage traces");
trace.addCommand(traceListCommand);
trace.addCommand(traceGetCommand);
program.addCommand(trace);

// monitor
const monitor = new Command("monitor").description("Manage and run monitors");
monitor.addCommand(monitorListCommand);
monitor.addCommand(monitorRunCommand);
program.addCommand(monitor);

// signal
const signal = new Command("signal").description("View signals");
signal.addCommand(signalListCommand);
program.addCommand(signal);

// top-level commands
program.addCommand(queryCommand);
program.addCommand(initCommand);
program.addCommand(doctorCommand);
program.addCommand(versionCommand);

program.parse();
