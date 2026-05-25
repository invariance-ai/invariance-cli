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

const rollup = {
  workflow_key: "support.escalation",
  execution_count: 4,
  open_count: 1,
  closed_count: 3,
  stale_open_count: 0,
  missing_outcome_count: 0,
  failed_run_count: 1,
  node_error_count: 2,
  event_count: 12,
  run_count: 6,
  capture_count: 0,
  node_count: 30,
  executions_with_events: 4,
  executions_with_runs: 4,
  executions_with_captures: 0,
  executions_with_nodes: 4,
  total_cost_usd: 1.25,
  total_input_tokens: 1000,
  total_output_tokens: 500,
  avg_duration_ms: 4200,
  first_seen_at: "2026-01-01T00:00:00.000Z",
  last_seen_at: "2026-01-02T00:00:00.000Z",
};

describe("workflow-observability command", () => {
  beforeEach(() => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
  });

  it("list GETs /v1/workflow-observability", async () => {
    const fetchSpy = mockFetch({ data: [rollup], next_cursor: null });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "workflow-observability", "list"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/workflow-observability");
  });

  it("get GETs /v1/workflow-observability/:key and unwraps {rollup}", async () => {
    const fetchSpy = mockFetch({ rollup });
    const writes = captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "wfobs", "get", "support.escalation"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.test/v1/workflow-observability/support.escalation",
    );
    expect(JSON.parse(writes.join("").trimEnd())).toEqual(rollup);
  });

  it("executions GETs /v1/workflow-observability/:key/executions", async () => {
    const exec = {
      case_id: "case_1",
      workflow_key: "support.escalation",
      status: "open",
      opened_at: "2026-01-01T00:00:00.000Z",
      closed_at: null,
      last_seen_at: "2026-01-01T01:00:00.000Z",
      stale: false,
      health: "healthy",
      reasons: [],
      event_count: 3,
      run_count: 1,
      capture_count: 0,
      node_count: 5,
      error_count: 0,
      total_cost_usd: 0.1,
      total_tokens: 200,
      evidence_mix: { events: true, runs: true, captures: false, nodes: true },
    };
    const fetchSpy = mockFetch({ data: [exec], next_cursor: null });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "workflow-observability", "executions", "support.escalation"], {
      from: "user",
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.test/v1/workflow-observability/support.escalation/executions",
    );
  });
});
