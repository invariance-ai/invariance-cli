import { Command } from "commander";
import chalk from "chalk";
import { resolveConfig, isConfigValid, configFileExists } from "../lib/config.js";
import { InvarianceClient } from "../lib/client.js";
import type { GlobalOptions } from "../types/index.js";
import { formatOutput } from "../lib/output.js";

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

async function runChecks(profile?: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Check 1: Node version
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split(".")[0] ?? "0", 10);
  if (major >= 20) {
    results.push({ name: "Node.js version", status: "pass", message: `v${nodeVersion}` });
  } else {
    results.push({
      name: "Node.js version",
      status: "fail",
      message: `v${nodeVersion} (requires >= 20)`,
    });
  }

  // Check 2: Config file
  if (configFileExists()) {
    if (isConfigValid()) {
      results.push({ name: "Config file", status: "pass", message: "Valid" });
    } else {
      results.push({ name: "Config file", status: "fail", message: "Invalid format" });
    }
  } else {
    results.push({
      name: "Config file",
      status: "warn",
      message: "Not found (using env vars or defaults)",
    });
  }

  // Check 3: API key configured
  const config = resolveConfig(profile);
  if (config.apiKey) {
    results.push({
      name: "API key",
      status: "pass",
      message: `Configured (${config.apiKey.slice(0, 8)}...)`,
    });
  } else {
    results.push({
      name: "API key",
      status: "fail",
      message: "Not configured. Run `invariance auth login`.",
    });
  }

  // Check 4: API reachable
  if (config.apiKey) {
    try {
      const client = new InvarianceClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
      await client.whoami();
      results.push({ name: "API reachable", status: "pass", message: config.baseUrl });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      results.push({ name: "API reachable", status: "fail", message: msg });
    }
  } else {
    results.push({
      name: "API reachable",
      status: "warn",
      message: "Skipped (no API key)",
    });
  }

  return results;
}

export const doctorCommand = new Command("doctor")
  .description("Check your Invariance CLI setup for common issues")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance doctor
  $ invariance doctor --json`,
  )
  .action(async (_opts: Record<string, unknown>, cmd: Command) => {
    const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
    const results = await runChecks(globalOpts.profile);

    if (globalOpts.json) {
      formatOutput(results, { json: true });
      return;
    }

    console.log(chalk.bold("\nInvariance CLI Doctor\n"));

    for (const check of results) {
      const icon =
        check.status === "pass"
          ? chalk.green("✓")
          : check.status === "warn"
            ? chalk.yellow("⚠")
            : chalk.red("✗");
      console.log(`  ${icon} ${chalk.bold(check.name)}: ${check.message}`);
    }

    const failures = results.filter((r) => r.status === "fail");
    console.log();
    if (failures.length === 0) {
      console.log(chalk.green("All checks passed."));
    } else {
      console.log(chalk.red(`${failures.length} check${failures.length > 1 ? "s" : ""} failed.`));
      process.exit(1);
    }
  });
