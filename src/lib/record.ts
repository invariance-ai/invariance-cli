/**
 * Session-recorder adapter helpers. Translates Claude Code hook stdin and
 * Codex notify payloads into the platform's normalized agent_events schema,
 * batches them through a per-session JSONL spool, and flushes on every hook
 * invocation. Hook scripts must never block the parent agent — all errors
 * are logged to `~/.invariance/spool/errors.log` and swallowed.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolveConfig } from "./config.js";

const SPOOL_DIR = path.join(os.homedir(), ".invariance", "spool");
const SESSION_INDEX = path.join(SPOOL_DIR, "sessions.json");
const ERROR_LOG = path.join(SPOOL_DIR, "errors.log");
const BATCH_MAX = 100;
const FLUSH_TIMEOUT_MS = 4000;

export type EventType =
  | "session_start"
  | "session_end"
  | "user_prompt"
  | "assistant_message"
  | "tool_call_start"
  | "tool_call_end"
  | "file_changed"
  | "permission_request"
  | "notification"
  | "compaction"
  | "error"
  | "custom";

export type Source =
  | "claude_code"
  | "codex"
  | "anthropic_sdk"
  | "openai_sdk"
  | "invariance_cli"
  | "mcp"
  | "other";

export interface AgentEventInput {
  seq: number;
  event_type: EventType;
  tool_use_id?: string;
  parent_event_id?: string;
  ts?: string;
  payload?: Record<string, unknown>;
  raw?: Record<string, unknown>;
  idempotency_key?: string;
}

interface SessionIndex {
  // key: `${source}:${external_session_id}` → canonical session id from API
  [key: string]: {
    id: string;
    project_id: string;
    last_seq: number;
    last_seen: string;
  };
}

function ensureDir(): void {
  fs.mkdirSync(SPOOL_DIR, { recursive: true, mode: 0o700 });
}

export function logRecordError(where: string, err: unknown): void {
  try {
    ensureDir();
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    fs.appendFileSync(ERROR_LOG, `${new Date().toISOString()} [${where}] ${msg}\n`);
  } catch {
    /* swallow */
  }
}

function readSessions(): SessionIndex {
  try {
    return JSON.parse(fs.readFileSync(SESSION_INDEX, "utf8")) as SessionIndex;
  } catch {
    return {};
  }
}

function writeSessions(idx: SessionIndex): void {
  ensureDir();
  const tmp = SESSION_INDEX + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(idx, null, 2));
  fs.renameSync(tmp, SESSION_INDEX);
}

function spoolFile(sessionId: string): string {
  return path.join(SPOOL_DIR, `${sessionId}.jsonl`);
}

function appendSpool(sessionId: string, event: AgentEventInput): void {
  ensureDir();
  fs.appendFileSync(spoolFile(sessionId), JSON.stringify(event) + "\n");
}

function readSpool(sessionId: string): AgentEventInput[] {
  const file = spoolFile(sessionId);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  const out: AgentEventInput[] = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line) as AgentEventInput);
    } catch (err) {
      logRecordError("readSpool", err);
    }
  }
  return out;
}

function clearSpool(sessionId: string): void {
  const file = spoolFile(sessionId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

interface AuthBits {
  apiKey: string;
  baseUrl: string;
}

function loadAuth(): AuthBits | null {
  // Env var wins so hook scripts can be wired without a profile.
  const envKey = process.env.INVARIANCE_API_KEY;
  const envUrl = process.env.INVARIANCE_API_URL;
  if (envKey) {
    return {
      apiKey: envKey,
      baseUrl: envUrl ?? "https://api.useinvariance.com",
    };
  }
  try {
    const cfg = resolveConfig();
    if (cfg.apiKey) return { apiKey: cfg.apiKey, baseUrl: cfg.baseUrl };
  } catch (err) {
    logRecordError("loadAuth", err);
  }
  return null;
}

async function httpFetch(
  auth: AuthBits,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FLUSH_TIMEOUT_MS);
  try {
    const res = await fetch(`${auth.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "inv-record",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const text = await res.text();
    const parsed = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) {
      const msg = `${method} ${path} → ${res.status}: ${text.slice(0, 300)}`;
      throw new Error(msg);
    }
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

export interface ResolveSessionInput {
  source: Source;
  external_session_id: string;
  model?: string;
  cwd?: string;
  host_user?: string;
  client_version?: string;
}

/**
 * Resolve a canonical Invariance session id for this (source, external id).
 * Idempotent — repeat calls with the same external id collapse to one row.
 * Cached in the local index so subsequent hook fires skip the round-trip.
 */
export async function resolveSession(input: ResolveSessionInput): Promise<{ id: string } | null> {
  const auth = loadAuth();
  if (!auth) {
    logRecordError("resolveSession", "no INVARIANCE_API_KEY configured");
    return null;
  }
  const key = `${input.source}:${input.external_session_id}`;
  const idx = readSessions();
  const cached = idx[key];
  if (cached) return { id: cached.id };

  try {
    const res = (await httpFetch(auth, "POST", "/v1/agent-sessions", {
      source: input.source,
      external_session_id: input.external_session_id,
      model: input.model,
      cwd: input.cwd,
      host_user: input.host_user,
      client_version: input.client_version ?? "inv-record/0.1",
    })) as { session?: { id: string; project_id: string } };
    const session = res.session;
    if (!session) throw new Error("response missing session");
    idx[key] = {
      id: session.id,
      project_id: session.project_id,
      last_seq: -1,
      last_seen: new Date().toISOString(),
    };
    writeSessions(idx);
    return { id: session.id };
  } catch (err) {
    logRecordError("resolveSession", err);
    return null;
  }
}

/**
 * Append an event to the per-session spool, then attempt to flush. The flush
 * is best-effort: failures keep the event in the spool for next invocation.
 */
export async function recordEvent(
  sessionId: string,
  event: Omit<AgentEventInput, "seq">,
): Promise<void> {
  const idx = readSessions();
  // Find which cache entry this session_id maps to so we can bump seq.
  const cacheKey = Object.keys(idx).find((k) => idx[k]!.id === sessionId);
  const cacheEntry = cacheKey ? idx[cacheKey] : undefined;
  const lastSeq = cacheEntry?.last_seq ?? -1;
  const seq = lastSeq + 1;
  const full: AgentEventInput = { seq, ...event };
  appendSpool(sessionId, full);
  if (cacheKey && cacheEntry) {
    cacheEntry.last_seq = seq;
    cacheEntry.last_seen = new Date().toISOString();
    writeSessions(idx);
  }
  await flushSession(sessionId);
}

export async function flushSession(sessionId: string): Promise<void> {
  const auth = loadAuth();
  if (!auth) return;
  const pending = readSpool(sessionId);
  if (pending.length === 0) return;

  for (let i = 0; i < pending.length; i += BATCH_MAX) {
    const batch = pending.slice(i, i + BATCH_MAX);
    try {
      await httpFetch(auth, "POST", `/v1/agent-sessions/${sessionId}/events`, {
        events: batch,
      });
    } catch (err) {
      logRecordError("flushSession", err);
      return; // Keep spool for retry.
    }
  }
  clearSpool(sessionId);
}

/**
 * Best-effort flush of every pending session spool. Called at startup so
 * stranded events from prior failed runs eventually make it through.
 */
export async function flushAll(): Promise<void> {
  if (!fs.existsSync(SPOOL_DIR)) return;
  const files = fs.readdirSync(SPOOL_DIR).filter((f) => f.endsWith(".jsonl"));
  for (const f of files) {
    const sessionId = f.replace(/\.jsonl$/, "");
    await flushSession(sessionId);
  }
}
