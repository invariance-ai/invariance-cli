import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InvarianceClient, buildUrl } from "../lib/client.js";

describe("InvarianceClient – new methods", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should construct correct URL for datasets", () => {
    expect(buildUrl("https://api.invariance.ai", "/v1/datasets")).toBe(
      "https://api.invariance.ai/v1/datasets",
    );
  });

  it("should construct correct URL for evals", () => {
    expect(buildUrl("https://api.invariance.ai", "/v1/evals/runs")).toBe(
      "https://api.invariance.ai/v1/evals/runs",
    );
  });

  it("should construct correct URL for sessions", () => {
    expect(buildUrl("https://api.invariance.ai", "/v1/sessions")).toBe(
      "https://api.invariance.ai/v1/sessions",
    );
  });

  it("should pass query params for listDatasets", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.listDatasets({ agentId: "owner/agent" });

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/v1/datasets");
    expect(calledUrl).toContain("agent_id=owner%2Fagent");
  });

  it("should pass query params for listEvals with suiteId and datasetId", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.listEvals({
      suiteId: "suite_123",
      agentId: "owner/agent",
      status: "completed",
      datasetId: "ds_123",
    });

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/v1/evals/runs");
    expect(calledUrl).toContain("suite_id=suite_123");
    expect(calledUrl).toContain("agent_id=owner%2Fagent");
    expect(calledUrl).toContain("status=completed");
    expect(calledUrl).toContain("dataset_id=ds_123");
  });

  it("should pass query params for listSessions", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.listSessions({ limit: 5, status: "open", offset: 10, agentId: "owner/agent" });

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/v1/sessions");
    expect(calledUrl).toContain("limit=5");
    expect(calledUrl).toContain("offset=10");
    expect(calledUrl).toContain("status=open");
    expect(calledUrl).toContain("agent_id=owner%2Fagent");
  });

  it("should send POST body for runEval", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: "eval_1", suite_id: "suite_1", agent_id: "owner/agent", status: "running", started_at: "2026-04-06T00:00:00Z", completed_at: null }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.runEval("suite_123", {
      agentId: "owner/agent",
      versionLabel: "nightly",
      sessionIds: ["sess_1", "sess_2"],
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.invariance.ai/v1/evals/suites/suite_123/run",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          agent_id: "owner/agent",
          version_label: "nightly",
          session_ids: ["sess_1", "sess_2"],
        }),
      }),
    );
  });

  it("should call correct URL for getDataset", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "ds_1",
          name: "test",
          description: null,
          agent_id: null,
          owner_id: "owner_1",
          current_draft_version: 1,
          latest_published_version: 0,
          row_count: 0,
          metadata: {},
          created_at: "2026-04-06T00:00:00Z",
          updated_at: "2026-04-06T00:00:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.getDataset("ds_1");

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/v1/datasets/ds_1");
  });

  it("should call correct URL for getEval", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "eval_1",
          suite_id: "suite_1",
          agent_id: "owner/agent",
          status: "completed",
          started_at: "2026-04-06T00:00:00Z",
          completed_at: "2026-04-06T00:01:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.getEval("eval_1");

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/v1/evals/runs/eval_1");
  });

  it("should call correct URL for getSession", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "sess_1",
          name: "test session",
          created_by: "owner/agent",
          status: "open",
          created_at: "2026-04-06T00:00:00Z",
          closed_at: null,
          root_hash: null,
          close_hash: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.getSession("sess_1");

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/v1/sessions/sess_1");
  });
});
