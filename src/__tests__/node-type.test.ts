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

const nodeType = {
  name: "payment.refund",
  agent_id: "agent_1",
  display_name: "Payment Refund",
  custom_fields_schema: { amount: "number" },
  aggregation_hints: {},
  builtin: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("node-type command", () => {
  beforeEach(() => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
  });

  it("list GETs /v1/node-types", async () => {
    const fetchSpy = mockFetch({ data: [nodeType], next_cursor: null });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "node-type", "list"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/node-types");
  });

  it("register POSTs /v1/node-types with body and unwraps {node_type}", async () => {
    const fetchSpy = mockFetch({ node_type: nodeType }, 201);
    const writes = captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      [
        "--json",
        "node-types",
        "register",
        "--name",
        "payment.refund",
        "--display-name",
        "Payment Refund",
        "--custom-fields-schema",
        '{"amount":"number"}',
      ],
      { from: "user" },
    );
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/node-types");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      name: "payment.refund",
      display_name: "Payment Refund",
      custom_fields_schema: { amount: "number" },
    });
    expect(JSON.parse(writes.join("").trimEnd())).toEqual(nodeType);
  });
});
