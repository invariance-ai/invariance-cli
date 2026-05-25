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

const divergence = {
  id: "div_1",
  agent_id: "agent_1",
  run_id: "run_1",
  kind: "policy",
  severity: "high",
  title: "Policy bypassed",
  summary: "Refund issued without approval",
  expected: { approval: true },
  observed: { approval: false },
  evidence: { node_ids: ["node_1"] },
  suggested_action: "Require approval",
  confidence: 0.9,
  status: "open",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("divergence command", () => {
  beforeEach(() => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
  });

  it("list GETs /v1/divergences with filters", async () => {
    const fetchSpy = mockFetch({ data: [divergence], next_cursor: null });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      ["--json", "divergence", "list", "--run", "run_1", "--kind", "policy", "--status", "open"],
      { from: "user" },
    );
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.test/v1/divergences?run_id=run_1&kind=policy&status=open",
    );
  });

  it("get GETs /v1/divergences/:id and unwraps {divergence}", async () => {
    const fetchSpy = mockFetch({ divergence });
    const writes = captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "divergences", "get", "div_1"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/divergences/div_1");
    expect(JSON.parse(writes.join("").trimEnd())).toEqual(divergence);
  });

  it("update PATCHes /v1/divergences/:id with {status}", async () => {
    const fetchSpy = mockFetch({ divergence: { ...divergence, status: "accepted" } });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "divergence", "update", "div_1", "--status", "accepted"], {
      from: "user",
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/divergences/div_1");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH" });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({ status: "accepted" });
  });

  it("update rejects an invalid status", async () => {
    const errSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const program = buildProgram();
    program.exitOverride();
    await expect(
      program.parseAsync(["divergence", "update", "div_1", "--status", "bogus"], { from: "user" }),
    ).rejects.toThrow();
    errSpy.mockRestore();
  });
});
