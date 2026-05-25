import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import type { Command } from "commander";

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

function mockFetch(body: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function captureStdout(): string[] {
  const writes: string[] = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    writes.push(String(chunk));
    return true;
  });
  return writes;
}

const view = {
  id: "view_1",
  agent_id: "agent_1",
  name: "Open escalations",
  source: "executions",
  spec: { aggregation: "count" },
  viz: "metric",
  visibility: "agent",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("saved-view command", () => {
  beforeEach(() => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
  });

  it("list GETs /v1/saved-views", async () => {
    const fetchSpy = mockFetch({ data: [view] });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "saved-view", "list"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/saved-views");
  });

  it("create POSTs /v1/saved-views with parsed spec", async () => {
    const fetchSpy = mockFetch({ view }, 201);
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      [
        "--json",
        "saved-views",
        "create",
        "--name",
        "Open escalations",
        "--source",
        "executions",
        "--spec",
        '{"aggregation":"count"}',
        "--viz",
        "metric",
      ],
      { from: "user" },
    );
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/saved-views");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      name: "Open escalations",
      source: "executions",
      spec: { aggregation: "count" },
      viz: "metric",
    });
  });

  it("run by --id POSTs /v1/saved-views/run with {saved_view_id}", async () => {
    const result = { source: "executions", scalar: 3, row_count: 1, truncated: false };
    const fetchSpy = mockFetch({ result });
    const writes = captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "saved-view", "run", "--id", "view_1"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/saved-views/run");
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({ saved_view_id: "view_1" });
    expect(JSON.parse(writes.join("").trimEnd())).toEqual(result);
  });

  it("run with ad-hoc --source/--spec POSTs {source, spec}", async () => {
    const result = { source: "runs", scalar: 5, row_count: 1, truncated: false };
    const fetchSpy = mockFetch({ result });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      ["--json", "saved-view", "run", "--source", "runs", "--spec", '{"aggregation":"count"}'],
      { from: "user" },
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      source: "runs",
      spec: { aggregation: "count" },
    });
  });

  it("run rejects passing both --id and --source", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit");
    }) as never);
    const program = buildProgram();
    program.exitOverride();
    await expect(
      program.parseAsync(["saved-view", "run", "--id", "view_1", "--source", "runs"], {
        from: "user",
      }),
    ).rejects.toThrow();
    errSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("delete DELETEs /v1/saved-views/:id", async () => {
    const fetchSpy = mockFetch({ ok: true });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "saved-view", "delete", "view_1"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/saved-views/view_1");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
  });
});
