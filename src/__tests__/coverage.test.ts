import { describe, it, expect, beforeAll } from "vitest";
import type { Command } from "commander";

process.env.INVARIANCE_CLI_SKIP_PARSE = "1";

let buildProgram: () => Command;

beforeAll(async () => {
  ({ buildProgram } = await import("../index.js"));
});

/**
 * In-scope data + observability-plane command groups every CLI build must
 * register (using the repo's actual command/alias names). This is the CLI
 * tripwire from the parity-closeout plan (Part 3): if a group is dropped or
 * renamed, this fails. Names here are matched against either a command's
 * primary name OR one of its registered aliases.
 */
const IN_SCOPE_GROUPS = [
  "agent",
  "operator",
  "run",
  "node",
  "case",
  "event",
  "session",
  "capture",
  "dna",
  "cortex",
  "monitor",
  "signal",
  "finding",
  "review",
  "eval",
  "guardrails",
  "recipes",
  "kb",
  "ask",
  "node-type",
  "divergence",
  "saved-view",
  "receipt",
  "workflow-observability",
  "workflow",
  "metrics",
];

describe("CLI coverage (in-scope command groups)", () => {
  it("registers every in-scope data/observability-plane group", () => {
    const program = buildProgram();
    const registered = new Set<string>();
    for (const cmd of program.commands) {
      registered.add(cmd.name());
      for (const alias of cmd.aliases()) registered.add(alias);
    }
    const missing = IN_SCOPE_GROUPS.filter((g) => !registered.has(g));
    expect(missing, `missing CLI command groups: ${missing.join(", ")}`).toEqual([]);
  });

  it("exposes the seven new dataplane groups (with plural/short aliases)", () => {
    const program = buildProgram();
    const byName = new Map<string, Command>();
    for (const cmd of program.commands) {
      byName.set(cmd.name(), cmd);
      for (const alias of cmd.aliases()) byName.set(alias, cmd);
    }
    expect(byName.get("workflow-observability")).toBe(byName.get("wfobs"));
    expect(byName.get("divergence")).toBe(byName.get("divergences"));
    expect(byName.get("saved-view")).toBe(byName.get("saved-views"));
    expect(byName.get("receipt")).toBe(byName.get("receipts"));
    expect(byName.get("node-type")).toBe(byName.get("node-types"));
    // kb + ask have no plural alias by design.
    expect(byName.has("kb")).toBe(true);
    expect(byName.has("ask")).toBe(true);
  });
});
