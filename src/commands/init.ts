import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { success, info } from "../lib/output.js";
import { handleError } from "../lib/errors.js";

const TEMPLATE_CONFIG = {
  $schema: "https://invariance.ai/schemas/project-config.json",
  version: "1.0",
  monitors: [],
  signals: [],
};

export const initCommand = new Command("init")
  .description("Initialize Invariance in the current project")
  .option("--force", "Overwrite existing configuration")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance init
  $ invariance init --force`,
  )
  .action((options: { force?: boolean }) => {
    try {
      const projectDir = path.join(process.cwd(), ".invariance");
      const configFile = path.join(projectDir, "config.json");

      if (fs.existsSync(configFile) && !options.force) {
        info("Project already initialized. Use --force to overwrite.");
        return;
      }

      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      fs.writeFileSync(configFile, JSON.stringify(TEMPLATE_CONFIG, null, 2) + "\n");

      // Add .invariance/ to .gitignore if it exists
      const gitignorePath = path.join(process.cwd(), ".gitignore");
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, "utf-8");
        if (!content.includes(".invariance/")) {
          fs.appendFileSync(gitignorePath, "\n# Invariance\n.invariance/\n");
          info("Added .invariance/ to .gitignore");
        }
      }

      success("Initialized Invariance project.");
      console.log(`\n  Config: ${chalk.dim(configFile)}`);
      console.log(
        `\n  Next steps:`,
      );
      console.log(`    1. Run ${chalk.cyan("invariance auth login")} to authenticate`);
      console.log(`    2. Edit ${chalk.cyan(".invariance/config.json")} to configure monitors`);
      console.log(`    3. Run ${chalk.cyan("invariance doctor")} to verify setup`);
    } catch (error) {
      handleError(error);
    }
  });
