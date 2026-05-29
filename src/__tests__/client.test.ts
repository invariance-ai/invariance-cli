import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  InvarianceClient,
  buildUrl,
  authSignup,
  authSignin,
  authRefresh,
} from "../lib/client.js";
import { AuthenticationError, NetworkError, ApiError } from "../lib/errors.js";

const BASE = "https://api.useinvariance.com";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("InvarianceClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("buildUrl strips trailing slashes", () => {
    expect(buildUrl(BASE + "/", "/v1/runs")).toBe(`${BASE}/v1/runs`);
  });

  it("sends Bearer auth + UA to /v1/agents/me", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        agent: {
          id: "ag_1",
          name: "a",
          public_key: null,
          project_id: "p_1",
          created_at: "2025-01-01T00:00:00Z",
        },
      }),
    );
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    await c.me();
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/v1/agents/me`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer k",
          "User-Agent": "invariance-cli",
        }),
      }),
    );
  });

  it("maps 401 to AuthenticationError", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: "nope" }, 401));
    const c = new InvarianceClient({ apiKey: "bad", baseUrl: BASE });
    await expect(c.me()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("maps 403 to AuthenticationError", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: "forbidden" }, 403));
    const c = new InvarianceClient({ apiKey: "bad", baseUrl: BASE });
    await expect(c.me()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("maps 429 to ApiError", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: "rate" }, 429));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    await expect(c.listRuns()).rejects.toBeInstanceOf(ApiError);
  });

  it("maps fetch TypeError to NetworkError", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    await expect(c.me()).rejects.toBeInstanceOf(NetworkError);
  });

  it("passes cursor + limit as query params for listRuns", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ data: [], next_cursor: null }));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    await c.listRuns({ cursor: "abc", limit: 5 });
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toContain("cursor=abc");
    expect(url).toContain("limit=5");
  });

  it("POSTs runs start with name + metadata body", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        run: {
          id: "run_1",
          agent_id: "ag_1",
          name: "demo",
          status: "open",
          metadata: {},
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          closed_at: null,
        },
      }),
    );
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const run = await c.startRun({ name: "demo", metadata: { env: "dev" } });
    expect(run.id).toBe("run_1");
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/v1/runs`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "demo", metadata: { env: "dev" } }),
      }),
    );
  });

  it("writeNodes posts array with run_id injected", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            id: "node_1",
            run_id: "run_1",
            agent_id: "ag_1",
            parent_id: null,
            action_type: "tool_call",
            type: null,
            input: null,
            output: null,
            error: null,
            metadata: {},
            custom_fields: {},
            timestamp: 1,
            duration_ms: null,
            hash: "h",
            previous_hashes: [],
            signature: null,
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
      }),
    );
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    await c.writeNodes("run_1", [{ action_type: "tool_call" }]);
    const body = (fetchSpy.mock.calls[0]?.[1] as RequestInit).body as string;
    expect(JSON.parse(body)).toEqual([{ run_id: "run_1", action_type: "tool_call" }]);
  });

  it("emitSignal sends Severity + title", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        signal: {
          id: "sig_1",
          agent_id: "ag_1",
          monitor_id: null,
          monitor_execution_id: null,
          run_id: null,
          node_id: null,
          source: "manual",
          severity: "high",
          title: "test",
          message: null,
          status: "open",
          type: null,
          data: null,
          acknowledged_at: null,
          created_at: "2025-01-01T00:00:00Z",
        },
      }),
    );
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const sig = await c.emitSignal({ severity: "high", title: "test" });
    expect(sig.severity).toBe("high");
  });

  it("metricsOverview uses window_hours query param", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ metrics: { totals: { runs: 1 } } }));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    await c.metricsOverview({ window_hours: 72 });
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toContain("window_hours=72");
    expect(url).not.toContain("from=");
    expect(url).not.toContain("to=");
    expect(url).not.toContain("project_id=");
  });

  it("uses accessToken bearer when provided (overrides apiKey)", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ user: { id: "u_1", email: "x@y.z" }, organizations: [], projects: [] }));
    const c = new InvarianceClient({ accessToken: "jwt_abc", baseUrl: BASE });
    await c.authMe();
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/v1/auth/me`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer jwt_abc" }),
      }),
    );
  });

  it("createAgent posts {name, project_id} and returns the parsed agent", async () => {
    const agent = {
      id: "ag_2",
      name: "new",
      public_key: null,
      project_id: "p_1",
      created_at: "2026-01-01T00:00:00Z",
    };
    fetchSpy.mockResolvedValueOnce(jsonResponse({ agent }));
    const c = new InvarianceClient({ accessToken: "jwt", baseUrl: BASE });
    const out = await c.createAgent({ name: "new", project_id: "p_1" });
    expect(out).toEqual(agent);
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ name: "new", project_id: "p_1" });
  });

  it("metricsAgents hits /v1/metrics/agents with window_hours", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ window_hours: 24, agents: [] }));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    await c.metricsAgents({ window_hours: 24 });
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(
      `${BASE}/v1/metrics/agents?window_hours=24`,
    );
  });
});

describe("auth helpers", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("authSignup posts to /v1/auth/signup", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        user: { id: "u", email: "a@b.c" },
        organization: { id: "o", name: "O" },
        project: { id: "p", org_id: "o", name: "P" },
        agent: { id: "ag", name: "A", project_id: "p" },
        api_key_once: "inv_test_x",
        session: { access_token: "a", refresh_token: "r", expires_at: 1 },
      }),
    );
    await authSignup(BASE, { email: "a@b.c", password: "password123" });
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${BASE}/v1/auth/signup`);
  });

  it("authSignin maps 401 to AuthenticationError", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: "bad" }, 401));
    await expect(authSignin(BASE, { email: "a", password: "b" })).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  it("authRefresh posts refresh_token", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ session: { access_token: "a2", refresh_token: "r2", expires_at: 9 } }),
    );
    await authRefresh(BASE, "old_refresh");
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ refresh_token: "old_refresh" });
  });

  // PR4 — production-run → eval-case client methods.
  it("createEvalSuite posts to /v1/eval-suites with a default target_type", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ suite: { id: "es_1", name: "demo" } }));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const suite = await c.createEvalSuite({ name: "demo", dataset_id: "ds_1" });
    expect(suite).toMatchObject({ id: "es_1" });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/v1/eval-suites`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      name: "demo",
      target_type: "run",
      dataset_id: "ds_1",
    });
  });

  it("createEvalCase posts dataset-example backed cases to the suite cases route", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ case: { id: "ec_1", dataset_example_id: "ex_1" } }),
    );
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const created = await c.createEvalCase("es_1", {
      name: "happy",
      dataset_example_id: "ex_1",
      input_bundle: { prompt: "hi" },
      expected: { output: "hello" },
    });
    expect(created).toMatchObject({ id: "ec_1", dataset_example_id: "ex_1" });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/v1/eval-suites/es_1/cases`);
    expect(JSON.parse(init.body as string)).toMatchObject({
      name: "happy",
      dataset_example_id: "ex_1",
      input_bundle: { prompt: "hi" },
      expected: { output: "hello" },
    });
  });

  it("createEvalCaseFromRun posts run + signal provenance to the from-run route", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ case: { id: "ec_1", source_signal_id: "sig_1" } }));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const created = await c.createEvalCaseFromRun("es_1", {
      source_run_id: "run_1",
      source_signal_id: "sig_1",
    });
    expect(created).toMatchObject({ id: "ec_1", source_signal_id: "sig_1" });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/v1/eval-suites/es_1/cases/from-run`);
    expect(JSON.parse(init.body as string)).toMatchObject({
      source_run_id: "run_1",
      source_signal_id: "sig_1",
    });
  });

  it("runEvalSuite returns the inline failures + results_url the API supplies", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        eval_run: {
          id: "erun_1",
          status: "failed",
          summary: { case_count: 1, passed: 0, failed: 1, errored: 0 },
          failures: [{ case_id: "ec_1", message: "expected entity not found", path: "entities" }],
          results_url: "https://app.test/evals?run=erun_1",
        },
      }),
    );
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const run = await c.runEvalSuite("es_1");
    expect(run.status).toBe("failed");
    expect(run.failures).toHaveLength(1);
    expect(run.failures?.[0]).toMatchObject({ case_id: "ec_1", path: "entities" });
    expect(run.results_url).toContain("/evals?run=");
  });

  it("seedEvalSuite posts rows to /v1/eval-datasets/seed-suite", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        dataset: { id: "ds_1", name: "agent-regression" },
        suite: { id: "es_1", name: "agent-regression" },
        examples: [{ id: "ex_1" }],
        cases: [{ id: "ec_1" }],
        eval_run: { id: "erun_1", status: "passed" },
      }),
    );
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const seeded = await c.seedEvalSuite({
      name: "agent-regression",
      rows: [{ name: "happy", input: { prompt: "ship" }, expected: { outcome: "ok" } }],
      run: true,
    });
    expect(seeded.dataset.id).toBe("ds_1");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/v1/eval-datasets/seed-suite`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      name: "agent-regression",
      rows: [{ name: "happy", input: { prompt: "ship" }, expected: { outcome: "ok" } }],
      run: true,
    });
  });
});
