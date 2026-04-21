import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InvarianceClient, buildUrl } from "../lib/client.js";
import { AuthenticationError, NetworkError, ApiError } from "../lib/errors.js";

const BASE = "https://api.invariance.ai";

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
});
