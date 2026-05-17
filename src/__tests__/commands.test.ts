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
      "workflow",
      "event",
      "case",
      "run",
      "node",
      "monitor",
      "signal",
      "finding",
      "review",
      "agent",
      "metrics",
      "eval",
      "completions",
      "doctor",
      "version",
      "login",
      "logout",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("workflow create posts workflow definitions", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
    const definition = {
      key: "support.escalation",
      agent_id: "agent_1",
      display_name: "Support Escalation",
      description: null,
      expected_fields: [],
      expected_steps: [],
      allowed_outcomes: [],
      custom_metrics: [],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ definition }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
    const program = buildProgram();
    program.exitOverride();

    await program.parseAsync(
      [
        "--json",
        "workflow",
        "create",
        "--key",
        "support.escalation",
        "--display-name",
        "Support Escalation",
        "--expected-fields",
        '[{"name":"priority","type":"enum","enum":["p0","p1"]}]',
      ],
      { from: "user" },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/workflow-definitions");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      key: "support.escalation",
      display_name: "Support Escalation",
      expected_fields: [{ name: "priority", type: "enum", enum: ["p0", "p1"] }],
    });
    expect(JSON.parse(writes.join("").trimEnd())).toEqual(definition);
    writeSpy.mockRestore();
  });

  it("event list filters /v1/events", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], next_cursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const program = buildProgram();
    program.exitOverride();

    await program.parseAsync(
      [
        "--json",
        "event",
        "list",
        "--workflow-key",
        "support.escalation",
        "--actor-type",
        "human",
        "--limit",
        "5",
      ],
      { from: "user" },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.test/v1/events?limit=5&workflow_key=support.escalation&actor_type=human",
    );
    writeSpy.mockRestore();
  });

  it("every group's subcommands match the completions table (no drift)", () => {
    const byName = new Map(buildProgram().commands.map((c) => [c.name(), c]));
    for (const [group, advertised] of Object.entries(COMMANDS)) {
      if (group === "completions") continue;
      const cmd = byName.get(group);
      expect(cmd, `completions references unknown group "${group}"`).toBeDefined();
      expect(subs(cmd!), `drift for "${group}"`).toEqual([...advertised].sort());
    }
  });

  it("top-level login/logout aliases exist alongside auth login/auth logout", () => {
    const program = buildProgram();
    const names = subs(program);
    expect(names).toContain("login");
    expect(names).toContain("logout");
    const auth = program.commands.find((c) => c.name() === "auth")!;
    expect(subs(auth)).toEqual(
      ["login", "logout", "whoami", "signup", "signin", "refresh", "issue-key"].sort(),
    );
  });

  it("dna query posts to /v1/dna/query", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
    const response = {
      query: { q: "Acme discharge", kinds: ["patient"], include_edges: true, limit: 5 },
      entities: [],
      edges: [],
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
    const program = buildProgram();
    program.exitOverride();

    await program.parseAsync(
      ["--json", "dna", "query", "Acme discharge", "--kind", "patient", "--limit", "5"],
      { from: "user" },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/dna/query");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      q: "Acme discharge",
      kinds: ["patient"],
      limit: 5,
      include_edges: true,
    });
    expect(JSON.parse(writes.join("").trimEnd())).toEqual(response);
    writeSpy.mockRestore();
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
    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
    const program = buildProgram();
    program.exitOverride();

    await program.parseAsync(["--json", "node", "tail", "run_1", "--once"], {
      from: "user",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/runs/run_1/nodes");
    const out = writes.join("");
    expect(out.endsWith("\n")).toBe(true);
    expect(JSON.parse(out.trimEnd())).toEqual(node);
    writeSpy.mockRestore();
  });

  it("finding list --status filters client-side and only emits matching rows", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";

    const mkFinding = (id: string, status: string) => ({
      id,
      agent_id: "agent_1",
      monitor_id: "monitor_1",
      signal_id: "signal_1",
      run_id: "run_1",
      node_id: null,
      severity: "high",
      title: `Finding ${id}`,
      summary: "summary",
      status,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const findings = [
      mkFinding("f_open_1", "open"),
      mkFinding("f_resolved_1", "resolved"),
      mkFinding("f_open_2", "open"),
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: findings, next_cursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const writes: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      writes.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
    });
    const program = buildProgram();
    program.exitOverride();

    await program.parseAsync(["--json", "finding", "list", "--status", "open"], { from: "user" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // formatOutput uses console.log with pretty-printed JSON. Joining all log
    // calls reconstructs the JSON document.
    const out = writes.join("\n");
    const parsed = JSON.parse(out) as { data: { id: string; status: string }[] };
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data.every((f) => f.status === "open")).toBe(true);
    expect(parsed.data.map((f) => f.id).sort()).toEqual(["f_open_1", "f_open_2"]);
    logSpy.mockRestore();
  });

  it("run inspect returns composite shape {run, metrics, narrative, recent_nodes, open_findings}", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";

    const run = {
      id: "run_1",
      agent_id: "agent_1",
      name: "demo",
      status: "running",
      metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      closed_at: null,
    };
    const metrics = { run_id: "run_1", llm_call_count: 3 };
    const narrative = {
      run_id: "run_1",
      agent_id: "agent_1",
      narrative: "did things",
      key_moments: [],
      root_cause: "",
      scorer: "default",
      model: "claude",
      provider: "anthropic",
      scored_node_count: 1,
      total_node_count: 1,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const node = {
      id: "node_1",
      run_id: "run_1",
      agent_id: "agent_1",
      parent_id: null,
      action_type: "tool_call",
      type: null,
      input: {},
      output: {},
      error: null,
      metadata: {},
      custom_fields: {},
      timestamp: 1,
      duration_ms: null,
      hash: "h",
      previous_hashes: [],
      signature: null,
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const findingForRun = {
      id: "f_1",
      agent_id: "agent_1",
      monitor_id: "monitor_1",
      signal_id: "signal_1",
      run_id: "run_1",
      node_id: null,
      severity: "high",
      title: "open one",
      summary: "s",
      status: "open",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const findingOtherRun = { ...findingForRun, id: "f_2", run_id: "run_other" };
    const findingResolved = { ...findingForRun, id: "f_3", status: "resolved" };

    const respond = (url: string): Response => {
      if (url.endsWith("/v1/runs/run_1")) {
        return new Response(JSON.stringify({ run }), { status: 200 });
      }
      if (url.endsWith("/v1/runs/run_1/metrics")) {
        return new Response(JSON.stringify(metrics), { status: 200 });
      }
      if (url.includes("/v1/runs/run_1/narrative")) {
        return new Response(JSON.stringify({ narrative }), { status: 200 });
      }
      if (url.includes("/v1/runs/run_1/nodes")) {
        return new Response(JSON.stringify({ data: [node], next_cursor: null }), {
          status: 200,
        });
      }
      if (url.includes("/v1/findings")) {
        return new Response(
          JSON.stringify({
            data: [findingForRun, findingOtherRun, findingResolved],
            next_cursor: null,
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input: RequestInfo | URL) => respond(String(input)));

    const writes: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });

    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "run", "inspect", "run_1"], {
      from: "user",
    });

    expect(fetchSpy).toHaveBeenCalled();
    const out = writes.join("");
    const result = JSON.parse(out.trimEnd()) as {
      run: unknown;
      metrics: unknown;
      narrative: unknown;
      recent_nodes: { id: string }[];
      open_findings: { id: string; run_id: string; status: string }[];
    };
    expect(Object.keys(result).sort()).toEqual(
      ["metrics", "narrative", "open_findings", "recent_nodes", "run"].sort(),
    );
    expect(result.recent_nodes).toHaveLength(1);
    expect(result.open_findings).toHaveLength(1);
    expect(result.open_findings[0]?.id).toBe("f_1");
    expect(result.open_findings[0]?.run_id).toBe("run_1");
    expect(result.open_findings[0]?.status).toBe("open");
    writeSpy.mockRestore();
  });
});
