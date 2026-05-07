import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
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

const access = {
  id: "mem_acc_1",
  run_id: "run_1",
  node_id: "node_1",
  agent_id: "agent_1",
  access_type: "read",
  subject_type: "customer",
  subject_id: "cust_42",
  key: "preferred_contact_channel",
  value: "email",
  used_for: "select-channel",
  source_node_id: null,
  timestamp: "2026-05-07T12:00:00Z",
};

const record = {
  id: "mem_1",
  agent_id: "agent_1",
  subject_type: "customer",
  subject_id: "cust_42",
  claim: "preferred_contact_channel",
  value: "email",
  source: "agent_write",
  confidence: 1.0,
  valid_from: "2026-05-07T12:00:00Z",
  valid_until: null,
  last_verified_at: null,
  superseded_by: null,
  provenance: [],
};

function captureStdout(): { writes: string[]; restore: () => void } {
  const writes: string[] = [];
  const spy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
  return { writes, restore: () => spy.mockRestore() };
}

describe("memory commands", () => {
  it("memory read POSTs /v1/memory/read with subject + key + used_for", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ access, record }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { writes, restore } = captureStdout();
    const program = buildProgram();
    program.exitOverride();

    await program.parseAsync(
      [
        "--json",
        "memory",
        "read",
        "--run-id",
        "run_1",
        "--node-id",
        "node_1",
        "--subject-type",
        "customer",
        "--subject-id",
        "cust_42",
        "--key",
        "preferred_contact_channel",
        "--used-for",
        "select-channel",
      ],
      { from: "user" },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe("https://api.test/v1/memory/read");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      run_id: "run_1",
      node_id: "node_1",
      subject_type: "customer",
      subject_id: "cust_42",
      key: "preferred_contact_channel",
      used_for: "select-channel",
    });

    const out = writes.join("");
    expect(JSON.parse(out.trimEnd())).toEqual({ access, record });
    restore();
  });

  it("memory write defaults source=agent_write and confidence=1.0", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ access: { ...access, access_type: "write" }, record }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const { restore } = captureStdout();
    const program = buildProgram();
    program.exitOverride();

    await program.parseAsync(
      [
        "--json",
        "memory",
        "write",
        "--run-id",
        "run_1",
        "--node-id",
        "node_1",
        "--subject-type",
        "customer",
        "--subject-id",
        "cust_42",
        "--key",
        "preferred_contact_channel",
        "--value",
        '"email"',
        "--used-for",
        "remember",
      ],
      { from: "user" },
    );

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(body.source).toBe("agent_write");
    expect(body.confidence).toBe(1.0);
    expect(body.value).toBe("email");
    restore();
  });

  it("memory write rejects out-of-range --confidence", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const { restore } = captureStdout();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((_code?: number) => {
      throw new Error("__exit__");
    }) as never);
    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync(
        [
          "memory",
          "write",
          "--subject-type",
          "customer",
          "--subject-id",
          "c1",
          "--key",
          "k",
          "--value",
          "1",
          "--used-for",
          "x",
          "--confidence",
          "1.5",
        ],
        { from: "user" },
      ),
    ).rejects.toThrow("__exit__");
    exitSpy.mockRestore();
    restore();
  });
});
