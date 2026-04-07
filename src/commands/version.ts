import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatOutput } from "../lib/output.js";
import type { GlobalOptions } from "../types/index.js";

function getVersion(): string {
  try {
    // Walk up from dist/index.js or src/index.ts to find package.json
    let dir = path.dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 5; i++) {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        const pkg: unknown = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg && typeof pkg === "object" && "version" in pkg) {
          return String((pkg as { version: unknown }).version);
        }
      }
      dir = path.dirname(dir);
    }
  } catch {
    // fall through
  }
  return "unknown";
}

export const versionCommand = new Command("version")
  .description("Print the CLI version")
  .addHelpText(
    "after",
    `
Examples:
  $ invariance version
  $ invariance version --json`,
  )
  .action((_opts: Record<string, unknown>, cmd: Command) => {
    const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
    const version = getVersion();

    if (globalOpts.json) {
      formatOutput({ version }, { json: true });
    } else {
      console.log(`invariance/${version}`);
    }
  });
