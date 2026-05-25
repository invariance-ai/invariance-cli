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

const page = {
  id: "kbp_1",
  agent_id: "agent_1",
  title: "Runbook",
  slug: "runbook",
  content: "do the thing",
  tags: ["ops"],
  metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const session = {
  id: "kbs_1",
  agent_id: "agent_1",
  title: "Q&A",
  metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const message = {
  id: "kbm_1",
  session_id: "kbs_1",
  role: "user",
  content: "hello",
  metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("kb command", () => {
  beforeEach(() => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = "https://api.test";
  });

  it("page-list GETs /v1/kb/pages", async () => {
    const fetchSpy = mockFetch({ data: [page], next_cursor: null });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "kb", "page-list", "--q", "runbook"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/kb/pages?q=runbook");
  });

  it("page-create POSTs /v1/kb/pages", async () => {
    const fetchSpy = mockFetch({ page }, 201);
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      ["--json", "kb", "page-create", "--title", "Runbook", "--content", "do the thing", "--tags", "ops"],
      { from: "user" },
    );
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/kb/pages");
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      title: "Runbook",
      content: "do the thing",
      tags: ["ops"],
    });
  });

  it("page-get GETs /v1/kb/pages/:id and unwraps {page}", async () => {
    const fetchSpy = mockFetch({ page });
    const writes = captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "kb", "page-get", "kbp_1"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/kb/pages/kbp_1");
    expect(JSON.parse(writes.join("").trimEnd())).toEqual(page);
  });

  it("page-delete DELETEs /v1/kb/pages/:id", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "kb", "page-delete", "kbp_1"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/kb/pages/kbp_1");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
  });

  it("session-create POSTs /v1/kb/sessions", async () => {
    const fetchSpy = mockFetch({ session }, 201);
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "kb", "session-create", "--title", "Q&A"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/kb/sessions");
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({ title: "Q&A" });
  });

  it("messages GETs /v1/kb/sessions/:id/messages", async () => {
    const fetchSpy = mockFetch({ data: [message], next_cursor: null });
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "kb", "messages", "kbs_1"], { from: "user" });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/kb/sessions/kbs_1/messages");
  });

  it("message-add POSTs /v1/kb/sessions/:id/messages", async () => {
    const fetchSpy = mockFetch({ message }, 201);
    captureStdout();
    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      ["--json", "kb", "message-add", "kbs_1", "--role", "user", "--content", "hello"],
      { from: "user" },
    );
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("https://api.test/v1/kb/sessions/kbs_1/messages");
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({
      role: "user",
      content: "hello",
    });
  });
});
