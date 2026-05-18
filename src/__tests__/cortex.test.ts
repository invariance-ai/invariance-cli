import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Command } from "commander";
import { InvarianceClient } from "../lib/client.js";
import { parseTarget } from "../commands/cortex/index.js";

process.env.INVARIANCE_CLI_SKIP_PARSE = "1";

const BASE = "https://api.test";

let buildProgram: () => Command;
const originalEnv = { ...process.env };

beforeAll(async () => {
  ({ buildProgram } = await import("../index.js"));
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function captureStdout(): { writes: string[]; restore: () => void } {
  const writes: string[] = [];
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    writes.push(String(chunk));
    return true;
  });
  return { writes, restore: () => spy.mockRestore() };
}

async function runCli(argv: string[]): Promise<string> {
  const { writes, restore } = captureStdout();
  const program = buildProgram();
  program.exitOverride();
  try {
    await program.parseAsync(argv, { from: "user" });
  } finally {
    restore();
  }
  return writes.join("");
}

describe("parseTarget", () => {
  it("splits valid target", () => {
    expect(parseTarget("case:case_123")).toEqual({
      target_type: "case",
      target_ref: "case_123",
    });
  });

  it("preserves refs containing colons", () => {
    expect(parseTarget("external:cust_sys:42")).toEqual({
      target_type: "external",
      target_ref: "cust_sys:42",
    });
  });

  it("rejects unknown target type", () => {
    expect(() => parseTarget("widget:abc")).toThrow(/Unknown target type/);
  });

  it("rejects missing colon", () => {
    expect(() => parseTarget("case_123")).toThrow(/Expected <type>:<ref>/);
  });

  it("rejects empty ref", () => {
    expect(() => parseTarget("case:")).toThrow(/Expected <type>:<ref>/);
  });
});

describe("InvarianceClient cortex methods", () => {
  it("createCortexJob POSTs to /v1/cortex/jobs with body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ job_id: "ctxjob_1", status: "queued", deduplicated: false }),
    );
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const res = await c.createCortexJob({
      job_kind: "counterfactual_eval",
      project_id: "proj_123",
      target_type: "case",
      target_ref: "case_123",
      question: "what if?",
    });
    expect(res).toEqual({ job_id: "ctxjob_1", status: "queued", deduplicated: false });
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${BASE}/v1/cortex/jobs`);
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      job_kind: "counterfactual_eval",
      project_id: "proj_123",
      target_type: "case",
      target_ref: "case_123",
      question: "what if?",
    });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
  });

  it("getCortexJob GETs /v1/cortex/jobs/:id and unwraps {job}", async () => {
    const job = {
      id: "ctxjob_1",
      project_id: "proj_123",
      job_kind: "workflow_eval",
      target_type: "case",
      target_ref: "case_123",
      status: "running",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:01Z",
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ job }));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const out = await c.getCortexJob("ctxjob_1");
    expect(out.id).toBe("ctxjob_1");
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${BASE}/v1/cortex/jobs/ctxjob_1`);
  });

  it("getCortexJob accepts unwrapped response too", async () => {
    const job = {
      id: "ctxjob_2",
      project_id: "proj_123",
      job_kind: "workflow_eval",
      target_type: "run",
      target_ref: "run_9",
      status: "succeeded",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:01Z",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(job));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const out = await c.getCortexJob("ctxjob_2");
    expect(out.id).toBe("ctxjob_2");
  });

  it("getCortexJobResult GETs /v1/cortex/jobs/:id/result", async () => {
    const body = {
      job_id: "ctxjob_1",
      status: "succeeded",
      result: { kind: "counterfactual_eval", answer: "x", confidence: 0.5 },
      error: null,
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(body));
    const c = new InvarianceClient({ apiKey: "k", baseUrl: BASE });
    const out = await c.getCortexJobResult("ctxjob_1");
    expect(out.status).toBe("succeeded");
    expect(out.result).toMatchObject({ confidence: 0.5 });
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(
      `${BASE}/v1/cortex/jobs/ctxjob_1/result`,
    );
  });
});

describe("cortex CLI commands", () => {
  it("`cortex job run` maps args -> POST body per the plan spec", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = BASE;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ job_id: "ctxjob_42", status: "queued", deduplicated: false }),
    );

    const dir = mkdtempSync(join(tmpdir(), "cortex-cli-"));
    const criteriaFile = join(dir, "criteria.json");
    writeFileSync(
      criteriaFile,
      JSON.stringify({
        optimize_for: ["resolution_time"],
        constraints: ["do_not_expose_private_evidence"],
      }),
    );

    const out = await runCli([
      "--json",
      "cortex",
      "job",
      "run",
      "--kind",
      "workflow_eval",
      "--target",
      "case:case_123",
      "--project-id",
      "proj_123",
      "--criteria",
      criteriaFile,
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${BASE}/v1/cortex/jobs`);
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      job_kind: "workflow_eval",
      project_id: "proj_123",
      target_type: "case",
      target_ref: "case_123",
      criteria: {
        optimize_for: ["resolution_time"],
        constraints: ["do_not_expose_private_evidence"],
      },
    });
    expect(JSON.parse(out.trimEnd())).toEqual({ job_id: "ctxjob_42", status: "queued", deduplicated: false });
  });

  it("`cortex job run` supports --payload and --question and --project-id", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = BASE;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ job_id: "ctxjob_50", status: "queued", deduplicated: false }),
    );
    const dir = mkdtempSync(join(tmpdir(), "cortex-cli-"));
    const payloadFile = join(dir, "payload.json");
    writeFileSync(
      payloadFile,
      JSON.stringify({ workflow_name: "refund approval", steps: [] }),
    );

    await runCli([
      "--json",
      "cortex",
      "job",
      "run",
      "--kind",
      "policy_eval",
      "--target",
      "external:cust_sys_42",
      "--question",
      "Did we skip legal review?",
      "--payload",
      payloadFile,
      "--project-id",
      "proj_xyz",
    ]);
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      project_id: "proj_xyz",
      job_kind: "policy_eval",
      target_type: "external",
      target_ref: "cust_sys_42",
      question: "Did we skip legal review?",
      input_payload: { workflow_name: "refund approval", steps: [] },
    });
  });

  it("`cortex counterfactual run` maps to counterfactual_eval kind", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = BASE;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ job_id: "ctxjob_77", status: "queued", deduplicated: false }),
    );

    await runCli([
      "--json",
      "cortex",
      "counterfactual",
      "run",
      "--target",
      "case:case_123",
      "--question",
      "What if Alice owned this from the start?",
      "--project-id",
      "proj_123",
    ]);

    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${BASE}/v1/cortex/jobs`);
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      job_kind: "counterfactual_eval",
      project_id: "proj_123",
      target_type: "case",
      target_ref: "case_123",
      question: "What if Alice owned this from the start?",
    });
  });

  it("`cortex job get` GETs /v1/cortex/jobs/:id", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = BASE;
    const job = {
      id: "ctxjob_1",
      project_id: "proj_123",
      job_kind: "workflow_eval",
      target_type: "case",
      target_ref: "case_123",
      status: "running",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:01Z",
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ job }));
    const out = await runCli(["--json", "cortex", "job", "get", "ctxjob_1"]);
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${BASE}/v1/cortex/jobs/ctxjob_1`);
    expect((fetchSpy.mock.calls[0]![1] as RequestInit).method).toBe("GET");
    expect(JSON.parse(out.trimEnd())).toEqual(job);
  });

  it("`cortex job result` GETs /v1/cortex/jobs/:id/result", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = BASE;
    const body = {
      job_id: "ctxjob_1",
      status: "succeeded",
      result: { kind: "workflow_eval", passed: true, score: 0.9, confidence: 0.8 },
    };
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(body));
    const out = await runCli(["--json", "cortex", "job", "result", "ctxjob_1"]);
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(
      `${BASE}/v1/cortex/jobs/ctxjob_1/result`,
    );
    expect(JSON.parse(out.trimEnd())).toEqual(body);
  });

  it("rejects invalid --kind", async () => {
    process.env.INVARIANCE_API_KEY = "inv_test_key";
    process.env.INVARIANCE_BASE_URL = BASE;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code}`);
    }) as never);
    const errSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    await expect(
      runCli([
        "cortex",
        "job",
        "run",
        "--kind",
        "not_a_kind",
        "--target",
        "case:c1",
      ]),
    ).rejects.toThrow(/process\.exit/);
    expect(fetchSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
    errSpy.mockRestore();
  });
});
