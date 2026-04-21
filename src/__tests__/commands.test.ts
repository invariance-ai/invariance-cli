import { describe, it, expect, beforeAll } from "vitest";
import type { Command } from "commander";
import { COMMANDS } from "../commands/completions.js";

process.env.INVARIANCE_CLI_SKIP_PARSE = "1";

let buildProgram: () => Command;

beforeAll(async () => {
  ({ buildProgram } = await import("../index.js"));
});

function subs(cmd: Command): string[] {
  return cmd.commands.map((c) => c.name()).sort();
}

describe("command wiring", () => {
  it("registers all expected top-level commands", () => {
    const names = subs(buildProgram());
    for (const expected of [
      "auth",
      "config",
      "run",
      "node",
      "monitor",
      "signal",
      "finding",
      "review",
      "agent",
      "metrics",
      "completions",
      "doctor",
      "version",
      "login",
      "logout",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("every group's subcommands match the completions table (no drift)", () => {
    const byName = new Map(buildProgram().commands.map((c) => [c.name(), c]));
    for (const [group, advertised] of Object.entries(COMMANDS)) {
      if (group === "completions") continue;
      const cmd = byName.get(group);
      expect(cmd, `completions references unknown group "${group}"`).toBeDefined();
      expect(
        subs(cmd!),
        `drift for "${group}"`,
      ).toEqual([...advertised].sort());
    }
  });

  it("top-level login/logout aliases exist alongside auth login/auth logout", () => {
    const program = buildProgram();
    const names = subs(program);
    expect(names).toContain("login");
    expect(names).toContain("logout");
    const auth = program.commands.find((c) => c.name() === "auth")!;
    expect(subs(auth)).toEqual(["login", "logout", "whoami"]);
  });
});
