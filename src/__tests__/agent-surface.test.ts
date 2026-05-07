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

function configureAuth(): void {
  process.env.INVARIANCE_API_KEY = "inv_test_key";
  process.env.INVARIANCE_BASE_URL = "https://api.test";
}

interface CapturedFetch {
  urls: string[];
  bodies: Array<unknown>;
}

function mockFetch(
  responder: (url: string, init?: RequestInit) => Response,
): { spy: ReturnType<typeof vi.spyOn>; captured: CapturedFetch } {
  const captured: CapturedFetch = { urls: [], bodies: [] };
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      captured.urls.push(url);
      if (init?.body !== undefined) {
        try {
          captured.bodies.push(JSON.parse(String(init.body)));
        } catch {
          captured.bodies.push(init.body);
        }
      }
      return responder(url, init);
    });
  return { spy, captured };
}

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

function captureStderr(): { writes: string[]; restore: () => void } {
  const writes: string[] = [];
  const spy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
  return { writes, restore: () => spy.mockRestore() };
}

describe("agent-facing CLI surface", () => {
  it("`run finish <id>` PATCHes status=completed and emits the updated run as JSON", async () => {
    configureAuth();
    const completed = {
      id: "run_1",
      agent_id: "agent_1",
      name: "demo",
      status: "completed",
      metadata: {},
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
      closed_at: "2026-01-02T00:00:00.000Z",
    };
    const { captured } = mockFetch(
      () =>
        new Response(JSON.stringify({ run: completed }), { status: 200 }),
    );
    const stdout = captureStdout();

    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "run", "finish", "run_1"], {
      from: "user",
    });

    expect(captured.urls).toHaveLength(1);
    expect(captured.urls[0]).toBe("https://api.test/v1/runs/run_1");
    expect(captured.bodies[0]).toEqual({ status: "completed" });
    const out = stdout.writes.join("");
    const parsedRun = JSON.parse(out.trimEnd()) as { id: string; status: string };
    expect(parsedRun.id).toBe("run_1");
    expect(parsedRun.status).toBe("completed");
    stdout.restore();
  });

  it("`run get latest` resolves to the most recent run via /v1/runs?limit=1", async () => {
    configureAuth();
    const latest = {
      id: "run_latest",
      agent_id: "agent_1",
      name: "newest",
      status: "open",
      metadata: {},
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
      closed_at: null,
    };

    const responder = (url: string): Response => {
      if (url.includes("/v1/runs?") || url.endsWith("/v1/runs")) {
        return new Response(
          JSON.stringify({ data: [latest], next_cursor: null }),
          { status: 200 },
        );
      }
      if (url.endsWith("/v1/runs/run_latest")) {
        return new Response(JSON.stringify({ run: latest }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    };

    const { captured } = mockFetch(responder);
    const stdout = captureStdout();

    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(["--json", "run", "get", "latest"], {
      from: "user",
    });

    expect(captured.urls.some((u) => u.includes("limit=1"))).toBe(true);
    expect(captured.urls.some((u) => u.endsWith("/v1/runs/run_latest"))).toBe(true);
    const out = stdout.writes.join("");
    const parsed = JSON.parse(out.trimEnd()) as { id: string };
    expect(parsed.id).toBe("run_latest");
    stdout.restore();
  });

  it("`run get latest` errors with NOT_FOUND when no runs exist", async () => {
    configureAuth();
    mockFetch(
      () =>
        new Response(JSON.stringify({ data: [], next_cursor: null }), {
          status: 200,
        }),
    );
    const stderr = captureStderr();
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((_code?: number) => {
        throw new Error("__exit__");
      }) as never);

    const program = buildProgram();
    program.exitOverride();
    await expect(
      program.parseAsync(["--json", "run", "get", "latest"], { from: "user" }),
    ).rejects.toThrow("__exit__");

    const errOut = stderr.writes.join("");
    const parsed = JSON.parse(errOut.trimEnd()) as {
      error: { code: string; message: string; status_code?: number };
    };
    expect(parsed.error.code).toBe("NOT_FOUND");
    expect(parsed.error.status_code).toBe(404);
    expect(exitSpy).toHaveBeenCalledWith(1);
    stderr.restore();
  });

  it("`finding list --run latest` resolves run id and filters client-side", async () => {
    configureAuth();
    const latestRun = {
      id: "run_latest",
      agent_id: "agent_1",
      name: "demo",
      status: "open",
      metadata: {},
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
      closed_at: null,
    };
    const mkFinding = (id: string, runId: string) => ({
      id,
      agent_id: "agent_1",
      monitor_id: "monitor_1",
      signal_id: "signal_1",
      run_id: runId,
      node_id: null,
      severity: "high",
      title: id,
      summary: "s",
      status: "open",
      created_at: "2026-05-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
    });

    const responder = (url: string): Response => {
      if (url.includes("/v1/runs?") || url.endsWith("/v1/runs")) {
        return new Response(
          JSON.stringify({ data: [latestRun], next_cursor: null }),
          { status: 200 },
        );
      }
      if (url.includes("/v1/findings")) {
        return new Response(
          JSON.stringify({
            data: [
              mkFinding("f_1", "run_latest"),
              mkFinding("f_2", "run_other"),
              mkFinding("f_3", "run_latest"),
            ],
            next_cursor: null,
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    };

    mockFetch(responder);
    const writes: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      writes.push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
    });

    const program = buildProgram();
    program.exitOverride();
    await program.parseAsync(
      ["--json", "finding", "list", "--run", "latest"],
      { from: "user" },
    );

    const parsed = JSON.parse(writes.join("\n")) as {
      data: { id: string; run_id: string }[];
    };
    expect(parsed.data.map((f) => f.id).sort()).toEqual(["f_1", "f_3"]);
    expect(parsed.data.every((f) => f.run_id === "run_latest")).toBe(true);
  });

  it("API errors are emitted as structured JSON to stderr in --json mode", async () => {
    configureAuth();
    mockFetch(
      () =>
        new Response(
          JSON.stringify({ error: { message: "boom" } }),
          { status: 500 },
        ),
    );
    const stderr = captureStderr();
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((_code?: number) => {
        throw new Error("__exit__");
      }) as never);

    const program = buildProgram();
    program.exitOverride();
    await expect(
      program.parseAsync(["--json", "run", "get", "run_missing"], {
        from: "user",
      }),
    ).rejects.toThrow("__exit__");

    const errOut = stderr.writes.join("");
    const parsed = JSON.parse(errOut.trimEnd()) as {
      error: { code: string; message: string; status_code?: number };
    };
    expect(parsed.error.code).toBe("API_ERROR");
    expect(parsed.error.status_code).toBe(500);
    expect(exitSpy).toHaveBeenCalledWith(1);
    stderr.restore();
  });
});
