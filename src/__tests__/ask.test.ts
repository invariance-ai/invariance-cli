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

describe("ask command", () => {
  beforeEach(() => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
  });

  it("POSTs /v1/ask with {message} and prints the raw response", async () => {
    const response = { answer: "42", citations: ["run_1"] };
    const fetchSpy = mockFetch(response);
    const writes = captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "ask", "What is the answer?"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/ask");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      message: "What is the answer?",
    });
    expect(JSON.parse(writes.join("").trimEnd())).toEqual(response);
  });

  it("passes --session-id and --model through", async () => {
    const fetchSpy = mockFetch({ answer: "ok" });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      ["--json", "ask", "follow up", "--session-id", "kbs_1", "--model", "claude-opus"],
      { from: "user" },
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      message: "follow up",
      session_id: "kbs_1",
      model: "claude-opus",
    });
  });
});
