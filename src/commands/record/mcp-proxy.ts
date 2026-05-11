/**
 * MCP-proxy adapter. Wraps a downstream stdio MCP server, forwards JSON-RPC
 * traffic verbatim in both directions, and records each `tools/call` (start +
 * end) as agent_events. Useful when an MCP server is consumed outside Claude
 * Code (e.g. by Codex, a custom agent, or a script).
 *
 * Usage from the agent's MCP config — replace
 *   { "command": "my-mcp-server" }
 * with
 *   { "command": "inv", "args": ["record", "mcp-proxy", "--upstream", "my-mcp-server"] }
 *
 * The proxy is transparent to both sides: client capabilities, tool listings,
 * resource reads — all pass through unchanged. Only `tools/call` requests are
 * teed off into the recorder. Recording failures are logged and swallowed so
 * the MCP session never breaks.
 */
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { Readable, Writable } from "node:stream";
import os from "node:os";
import {
  logRecordError,
  recordEvent,
  resolveSession,
  type AgentEventInput,
} from "../../lib/record.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number | string;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string;
  result?: unknown;
  error?: unknown;
}

export interface McpProxyOptions {
  upstreamCommand: string;
  upstreamArgs: string[];
  externalSessionId?: string;
}

export async function runMcpProxy(opts: McpProxyOptions): Promise<void> {
  const externalId =
    opts.externalSessionId ??
    process.env.INVARIANCE_MCP_SESSION_ID ??
    `mcp-${process.pid}-${Date.now()}`;

  // Best-effort session resolve. If it fails (no API key, network down) the
  // proxy still operates — recording is non-essential to MCP correctness.
  const sessionRes = await resolveSession({
    source: "mcp",
    external_session_id: externalId,
    cwd: process.cwd(),
    host_user: os.userInfo().username,
    client_version: `mcp-proxy/${opts.upstreamCommand}`,
  }).catch((err) => {
    logRecordError("mcp-proxy.resolveSession", err);
    return null;
  });
  const sessionId = sessionRes?.id ?? null;

  if (sessionId) {
    recordSafe(sessionId, {
      event_type: "session_start",
      payload: { upstream: opts.upstreamCommand, args: opts.upstreamArgs },
    });
  }

  const child = spawn(opts.upstreamCommand, opts.upstreamArgs, {
    stdio: ["pipe", "pipe", "inherit"],
  }) as ChildProcessByStdio<Writable, Readable, null>;

  // Track in-flight tools/call requests by id so we can emit tool_call_end
  // when the matching response arrives.
  const pendingCalls = new Map<string | number, { name: string; args: unknown; startedAt: number }>();

  child.on("error", (err) => {
    logRecordError("mcp-proxy.spawn", err);
    if (sessionId) recordSafe(sessionId, { event_type: "error", payload: { message: String(err) } });
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (sessionId) {
      recordSafe(sessionId, {
        event_type: "session_end",
        payload: { reason: signal ?? (code === 0 ? "exit" : `exit:${code}`) },
      });
    }
    // Give the spool a tick to flush before quitting.
    setTimeout(() => process.exit(code ?? 0), 100);
  });

  // Pipe stdin (from MCP client) → child stdin, parsing each line for tools/call.
  forwardLines(process.stdin, child.stdin, (line) => {
    if (!sessionId) return;
    const req = parseJsonRpc<JsonRpcRequest>(line);
    if (!req || req.method !== "tools/call") return;
    const params = (req.params ?? {}) as { name?: string; arguments?: unknown };
    const name = typeof params.name === "string" ? params.name : "unknown";
    pendingCalls.set(req.id, { name, args: params.arguments, startedAt: Date.now() });
    recordSafe(sessionId, {
      event_type: "tool_call_start",
      tool_use_id: String(req.id),
      payload: { tool_name: name, input: params.arguments },
    });
  });

  // Pipe child stdout (responses from upstream) → process stdout.
  forwardLines(child.stdout, process.stdout, (line) => {
    if (!sessionId) return;
    const resp = parseJsonRpc<JsonRpcResponse>(line);
    if (!resp || resp.id === undefined) return;
    const pending = pendingCalls.get(resp.id);
    if (!pending) return;
    pendingCalls.delete(resp.id);
    recordSafe(sessionId, {
      event_type: "tool_call_end",
      tool_use_id: String(resp.id),
      payload: {
        tool_name: pending.name,
        output: resp.result,
        error: resp.error,
        latency_ms: Date.now() - pending.startedAt,
      },
    });
  });
}

function recordSafe(sessionId: string, event: Omit<AgentEventInput, "seq">): void {
  // Fire-and-forget: never block the MCP loop on recording.
  void recordEvent(sessionId, event).catch((err) => logRecordError("mcp-proxy.record", err));
}

/**
 * Read newline-delimited JSON-RPC frames from `src`, write them through to
 * `dst` verbatim, and invoke `tap` with each complete line. Uses a buffer
 * so partial reads at chunk boundaries still produce whole lines.
 */
function forwardLines(
  src: NodeJS.ReadableStream,
  dst: NodeJS.WritableStream,
  tap: (line: string) => void,
): void {
  let buffer = "";
  src.on("data", (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    // Forward bytes immediately — don't hold them while we parse.
    dst.write(chunk);
    buffer += text;
    let idx = buffer.indexOf("\n");
    while (idx !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) {
        try {
          tap(line);
        } catch (err) {
          logRecordError("forwardLines.tap", err);
        }
      }
      idx = buffer.indexOf("\n");
    }
  });
  src.on("end", () => {
    try {
      (dst as { end?: () => void }).end?.();
    } catch {
      /* swallow */
    }
  });
}

function parseJsonRpc<T>(line: string): T | null {
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
}
