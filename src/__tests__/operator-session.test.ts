import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import type { Command } from "commander";
import { InvarianceClient } from "../lib/client.js";

process.env.INVARIANCE_CLI_SKIP_PARSE = "1";

const BASE = "https://api.test";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const sampleOperator = {
  id: "op_1",
  name: "Alice",
  operator_type: "human",
  public_key: null,
  project_id: "p_1",
  created_at: "2026-05-01T00:00:00Z",
};

const sampleSession = {
  id: "sess_1",
  agent_id: "ag_1",
  operator_id: null,
  run_id: null,
  source: "claude_code",
  session_type: "claude_code",
  external_session_id: "ext_abc",
  title: "demo",
  status: "open",
  metadata: {},
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

describe("InvarianceClient — operators", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createOperator POSTs to /v1/operators with operator_type", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ operator: sampleOperator }));
    const c = new InvarianceClient({ accessToken: "jwt", baseUrl: BASE });
    const out = await c.createOperator({ name: "Alice", operator_type: "human", project_id: "p_1" });
    expect(out.id).toBe("op_1");
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Alice",
      operator_type: "human",
      project_id: "p_1",
    });
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${BASE}/v1/operators`);
  });

  it("listOperators passes project_id + operator_type query params", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [sampleOperator], next_cursor: null }),
    );
    const c = new InvarianceClient({ accessToken: "jwt", baseUrl: BASE });
    await c.listOperators({ project_id: "p_1", type: "human" });
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain("project_id=p_1");
    expect(url).toContain("operator_type=human");
  });

  it("getOperator hits /v1/operators/:id", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ operator: sampleOperator }));
    const c = new InvarianceClient({ accessToken: "jwt", baseUrl: BASE });
    const op = await c.getOperator("op_1");
    expect(op.name).toBe("Alice");
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${BASE}/v1/operators/op_1`);
  });

  it("meOperator hits /v1/operators/me", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ operator: sampleOperator }));
    const c = new InvarianceClient({ accessToken: "jwt", baseUrl: BASE });
    const { operator } = await c.meOperator();
    expect(operator.id).toBe("op_1");
  });
});

describe("InvarianceClient — agent sessions", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("createAgentSession POSTs the full body to /v1/agent-sessions", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ session: sampleSession }));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const out = await c.createAgentSession({
      source: "claude_code",
      external_session_id: "ext_abc",
      session_type: "claude_code",
      title: "demo",
    });
    expect(out.id).toBe("sess_1");
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${BASE}/v1/agent-sessions`);
    expect(JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string)).toEqual({
      source: "claude_code",
      external_session_id: "ext_abc",
      session_type: "claude_code",
      title: "demo",
    });
  });

  it("listAgentSessions passes source filter as query param", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [sampleSession], next_cursor: null }),
    );
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    await c.listAgentSessions({ source: "granola_note", limit: 5 });
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain("source=granola_note");
    expect(url).toContain("limit=5");
  });

  it("updateAgentSession PATCHes /v1/agent-sessions/:id", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ session: { ...sampleSession, run_id: "run_42" } }),
    );
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const out = await c.updateAgentSession("sess_1", { run_id: "run_42" });
    expect(out.run_id).toBe("run_42");
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ run_id: "run_42" });
  });
});

describe("CLI command surface — operator / session", () => {
  let buildProgram: () => Command;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    ({ buildProgram } = await import("../index.js"));
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  function configureApiKey() {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = BASE;
  }

  it("registers `operator` and `session` top-level groups", () => {
    const names = buildProgram().commands.map((c) => c.name());
    expect(names).toContain("operator");
    expect(names).toContain("session");
    expect(names).toContain("agent"); // compatibility alias
  });

  it("`session create --source ... --external-id ...` POSTs to /v1/agent-sessions", async () => {
    configureApiKey();
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({ session: sampleSession });
    });
    const writes: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((c: unknown) => {
      writes.push(String(c));
      return true;
    });

    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      ["--json", "session", "create", "--source", "claude_code", "--external-id", "ext_abc", "--title", "demo"],
      { from: "user" },
    );

    expect(calls[0]!.url).toBe(`${BASE}/v1/agent-sessions`);
    expect(JSON.parse((calls[0]!.init!.body as string))).toEqual({
      source: "claude_code",
      external_session_id: "ext_abc",
      title: "demo",
    });
    const parsed = JSON.parse(writes.join("").trimEnd()) as { id: string };
    expect(parsed.id).toBe("sess_1");
  });

  it("`session attach-run <sid> <rid>` PATCHes run_id", async () => {
    configureApiKey();
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({ session: { ...sampleSession, run_id: "run_99" } });
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      ["--json", "session", "attach-run", "sess_1", "run_99"],
      { from: "user" },
    );

    expect(calls[0]!.url).toBe(`${BASE}/v1/agent-sessions/sess_1`);
    expect(calls[0]!.init!.method).toBe("PATCH");
    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({ run_id: "run_99" });
  });

  it("`session start` defaults to source=cli, session_type=claude_code", async () => {
    configureApiKey();
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse({ session: sampleSession });
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "session", "start"], { from: "user" });

    expect(JSON.parse(calls[0]!.init!.body as string)).toEqual({
      source: "cli",
      session_type: "claude_code",
    });
  });
});
