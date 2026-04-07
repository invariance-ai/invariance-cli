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
    expect(buildUrl("https://api.invariance.ai", "/v1/evals")).toBe(
      "https://api.invariance.ai/v1/evals",
    );
  });

  it("should construct correct URL for sessions", () => {
    expect(buildUrl("https://api.invariance.ai", "/v1/sessions")).toBe(
      "https://api.invariance.ai/v1/sessions",
    );
  });

  it("should pass query params for listDatasets", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], has_more: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.listDatasets({ limit: 5 });

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/v1/datasets");
    expect(calledUrl).toContain("limit=5");
  });

  it("should pass query params for listEvals with datasetId", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], has_more: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.listEvals({ limit: 10, datasetId: "ds_123" });

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/v1/evals");
    expect(calledUrl).toContain("limit=10");
    expect(calledUrl).toContain("dataset_id=ds_123");
  });

  it("should pass query params for listSessions", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], has_more: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.listSessions({ limit: 5, status: "active" });

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/v1/sessions");
    expect(calledUrl).toContain("limit=5");
    expect(calledUrl).toContain("status=active");
  });

  it("should send POST body for runEval", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: "eval_1", status: "running" }),
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

    await client.runEval("ds_123", { name: "test-run" });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ dataset_id: "ds_123", name: "test-run" }),
      }),
    );
  });

  it("should call correct URL for getDataset", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: "ds_1", name: "test" }),
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
        JSON.stringify({ id: "eval_1", status: "completed" }),
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
    expect(calledUrl).toContain("/v1/evals/eval_1");
  });

  it("should call correct URL for getSession", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: "sess_1", status: "active" }),
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
