import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InvarianceClient, buildUrl } from "../lib/client.js";
import { AuthenticationError, NetworkError, ApiError } from "../lib/errors.js";

describe("InvarianceClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should construct correct URL for API calls", () => {
    expect(buildUrl("https://api.invariance.ai", "/v1/auth/whoami")).toBe(
      "https://api.invariance.ai/v1/auth/whoami",
    );
  });

  it("should strip trailing slashes from base URL", () => {
    expect(buildUrl("https://api.invariance.ai/", "/v1/traces")).toBe(
      "https://api.invariance.ai/v1/traces",
    );
  });

  it("should send Authorization header with API key", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: "usr_1", email: "test@example.com", name: "Test" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = new InvarianceClient({
      apiKey: "test-key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.whoami();

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.invariance.ai/v1/auth/whoami",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("should throw AuthenticationError on 401", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }),
    );

    const client = new InvarianceClient({
      apiKey: "bad-key",
      baseUrl: "https://api.invariance.ai",
    });

    await expect(client.whoami()).rejects.toThrow(AuthenticationError);
  });

  it("should throw ApiError on non-401/404 errors", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Rate limited" }), { status: 429 }),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await expect(client.listTraces()).rejects.toThrow(ApiError);
  });

  it("should throw NetworkError on fetch failure", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("fetch failed"));

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await expect(client.whoami()).rejects.toThrow(NetworkError);
  });

  it("should pass query params for listTraces", async () => {
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

    await client.listTraces({ limit: 5, status: "completed" });

    const calledUrl = fetchSpy.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("limit=5");
    expect(calledUrl).toContain("status=completed");
  });

  it("should send POST body for query", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ result: "answer" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = new InvarianceClient({
      apiKey: "key",
      baseUrl: "https://api.invariance.ai",
    });

    await client.query("test prompt");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "test prompt" }),
      }),
    );
  });
});
