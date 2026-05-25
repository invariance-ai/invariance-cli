import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const receipt = {
  id: "rcpt_1",
  agent_id: "agent_1",
  run_id: "run_1",
  node_id: null,
  source: "stripe",
  kind: "refund.created",
  external_id: "re_123",
  occurred_at: "2026-01-01T00:00:00.000Z",
  business_object_type: "refund",
  business_object_id: "re_123",
  subject_type: null,
  subject_id: null,
  correlation_keys: { charge_id: "ch_1" },
  payload: { amount: 500 },
  metadata: {},
  hash: "h",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("receipt command", () => {
  beforeEach(() => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
  });

  it("create POSTs /v1/receipts with the receipt body", async () => {
    const fetchSpy = mockFetch({ receipt }, 201);
    const writes = captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      [
        "--json",
        "receipt",
        "create",
        "--source",
        "stripe",
        "--kind",
        "refund.created",
        "--run-id",
        "run_1",
        "--external-id",
        "re_123",
        "--payload",
        '{"amount":500}',
        "--correlation-keys",
        '{"charge_id":"ch_1"}',
      ],
      { from: "user" },
    );
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/receipts");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      source: "stripe",
      kind: "refund.created",
      run_id: "run_1",
      external_id: "re_123",
      payload: { amount: 500 },
      correlation_keys: { charge_id: "ch_1" },
    });
    expect(JSON.parse(writes.join("").trimEnd())).toMatchObject({ id: "rcpt_1" });
  });

  it("batch POSTs /v1/receipts/batch from a JSON file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "inv-receipts-"));
    const file = join(dir, "receipts.json");
    writeFileSync(
      file,
      JSON.stringify([
        { source: "stripe", kind: "refund.created" },
        { source: "zendesk", kind: "ticket.closed" },
      ]),
    );
    const fetchSpy = mockFetch({ receipts: [receipt, { ...receipt, id: "rcpt_2" }] }, 201);
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "receipts", "batch", "--file", file], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/receipts/batch");
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      receipts: [
        { source: "stripe", kind: "refund.created" },
        { source: "zendesk", kind: "ticket.closed" },
      ],
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("list GETs /v1/receipts with filters", async () => {
    const fetchSpy = mockFetch({ data: [receipt], next_cursor: null });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      ["--json", "receipt", "list", "--source", "stripe", "--run-id", "run_1"],
      { from: "user" },
    );
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.test/v1/receipts?run_id=run_1&source=stripe",
    );
  });

  it("get GETs /v1/receipts/:id and unwraps {receipt}", async () => {
    const fetchSpy = mockFetch({ receipt });
    const writes = captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "receipt", "get", "rcpt_1"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/receipts/rcpt_1");
    expect(JSON.parse(writes.join("").trimEnd())).toEqual(receipt);
  });
});
