import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import type { Command } from "commander";
import { COMMANDS } from "../commands/completions.js";

process.env.INVARIANCE_CLI_SKIP_PARSE = "1";

let buildProgram: () => Command;
const originalEnv = { ...process.env };

beforeAll(async () => {
  ({ buildProgram } = await import("../index.js"));
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
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

  it("node tail --once fetches one page and exits", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
    const node = {
      id: "node_1",
      run_id: "run_1",
      agent_id: "agent_1",
      parent_id: null,
      action_type: "tool_call",
      type: null,
      input: { prompt: "ship" },
      output: { result: "ok" },
      error: null,
      metadata: {},
      custom_fields: {},
      timestamp: 1,
      duration_ms: null,
      hash: "hash_1",
      previous_hashes: [],
      signature: null,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [node], next_cursor: "next" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const program = buildProgram();
    program.exitOverride();

    await program.parseAsync(["--json", "node", "tail", "run_1", "--once"], {
      from: "user",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.test/v1/runs/run_1/nodes",
    );
    expect(JSON.parse(String(logSpy.mock.calls[0]?.[0]))).toEqual(node);
  });
});
