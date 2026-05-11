import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Command } from "commander";
import {
  flushAll,
  logRecordError,
  recordEvent,
  resolveSession,
  type AgentEventInput,
  type Source,
} from "../../lib/record.js";
import { runMcpProxy } from "./mcp-proxy.js";

export const recordCommand = new Command("record")
  .description("Capture Claude Code / Codex / SDK sessions into Invariance");

// ── claude-hook <event> ────────────────────────────────────────────────────
// Reads Claude Code hook JSON from stdin, translates into one normalized
// event, posts it. Exits 0 always so a misconfigured hook never blocks Claude.

recordCommand
  .command("claude-hook")
  .description("Claude Code hook adapter. Reads JSON event from stdin.")
  .argument("<event_name>", "Hook event name (e.g. PreToolUse, UserPromptSubmit)")
  .action(async (eventName: string) => {
    try {
      const raw = await readStdin();
      const payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      await handleClaudeHook(eventName, payload);
    } catch (err) {
      logRecordError("claude-hook", err);
    }
    process.exit(0);
  });

// ── codex notify ───────────────────────────────────────────────────────────
// Codex's `notify` config invokes a program with a JSON arg on turn complete.

recordCommand
  .command("codex")
  .description("Codex adapter (notify or tail mode)")
  .argument("[mode]", "notify | tail (default: notify)", "notify")
  .action(async (mode: string) => {
    try {
      if (mode === "notify") {
        // Codex passes the event as $1 (after our subcommand). Read remaining
        // argv: `inv record codex notify <json>`.
        const json = process.argv[process.argv.length - 1];
        if (!json || json === "notify") return;
        const payload = JSON.parse(json) as Record<string, unknown>;
        await handleCodexNotify(payload);
      } else if (mode === "tail") {
        process.stderr.write("codex tail mode not implemented in V1\n");
      }
    } catch (err) {
      logRecordError("codex", err);
    }
    process.exit(0);
  });

// ── install ────────────────────────────────────────────────────────────────
// Writes hook config into ~/.claude/settings.json (and ~/.codex/config.toml).
// Idempotent: existing inv-record entries are detected by their command
// substring and replaced rather than duplicated.

recordCommand
  .command("install")
  .description("Wire hooks into Claude Code and Codex config files")
  .option("--dry-run", "Print what would change without writing")
  .option("--claude-only", "Only configure Claude Code")
  .option("--codex-only", "Only configure Codex")
  .action(async (opts: { dryRun?: boolean; claudeOnly?: boolean; codexOnly?: boolean }) => {
    const summary: string[] = [];
    if (!opts.codexOnly) {
      summary.push(...installClaudeHooks(opts.dryRun ?? false));
    }
    if (!opts.claudeOnly) {
      summary.push(...installCodexNotify(opts.dryRun ?? false));
    }
    for (const line of summary) process.stdout.write(line + "\n");
  });

// ── session start | end ───────────────────────────────────────────────────
// Manual brackets, useful for our own CLI and ad-hoc scripts.

const sessionCmd = recordCommand
  .command("session")
  .description("Manually bracket a recorded session");

sessionCmd
  .command("start")
  .description("Create or resume a session and print its id")
  .requiredOption("--source <s>", "Source (e.g. invariance_cli, other)")
  .requiredOption("--external-id <id>", "External (source-native) session id")
  .option("--model <m>", "Model name")
  .option("--cwd <p>", "Working directory")
  .action(async (opts: { source: string; externalId: string; model?: string; cwd?: string }) => {
    const res = await resolveSession({
      source: opts.source as Source,
      external_session_id: opts.externalId,
      model: opts.model,
      cwd: opts.cwd ?? process.cwd(),
      host_user: os.userInfo().username,
    });
    if (!res) {
      process.stderr.write("Failed to create session — check INVARIANCE_API_KEY\n");
      process.exit(1);
    }
    await recordEvent(res.id, {
      event_type: "session_start",
      payload: { source: opts.source, model: opts.model },
    });
    process.stdout.write(res.id + "\n");
  });

sessionCmd
  .command("end")
  .description("Mark a session ended")
  .requiredOption("--session-id <id>", "Invariance session id (from `record session start`)")
  .option("--reason <r>", "End reason", "manual")
  .action(async (opts: { sessionId: string; reason: string }) => {
    await recordEvent(opts.sessionId, {
      event_type: "session_end",
      payload: { reason: opts.reason },
    });
  });

// ── flush ──────────────────────────────────────────────────────────────────

recordCommand
  .command("mcp-proxy")
  .description("Wrap a stdio MCP server and record every tools/call")
  .requiredOption(
    "--upstream <cmd>",
    "Upstream MCP server command (the program to wrap)",
  )
  .option(
    "--external-id <id>",
    "External session id (defaults to a per-process id; pass a stable id to coalesce across restarts)",
  )
  .allowUnknownOption(true)
  .allowExcessArguments(true)
  .action(async (opts: { upstream: string; externalId?: string }, cmd) => {
    // Anything after `--` (or trailing positional args) is forwarded to the
    // upstream verbatim. Commander stashes them on cmd.args.
    const upstreamArgs = cmd.args ?? [];
    try {
      await runMcpProxy({
        upstreamCommand: opts.upstream,
        upstreamArgs,
        externalSessionId: opts.externalId,
      });
    } catch (err) {
      logRecordError("mcp-proxy", err);
      process.exit(1);
    }
  });

recordCommand
  .command("flush")
  .description("Drain pending events from the local spool")
  .action(async () => {
    await flushAll();
  });

// ─────────────────────────────────────────────────────────────────────────────

async function handleClaudeHook(eventName: string, payload: Record<string, unknown>): Promise<void> {
  const externalSessionId =
    (typeof payload.session_id === "string" ? payload.session_id : undefined) ??
    (typeof payload.transcript_path === "string"
      ? payload.transcript_path
      : `unknown-${Date.now()}`);

  const transcriptPath = typeof payload.transcript_path === "string" ? payload.transcript_path : undefined;
  const cwd =
    (typeof payload.cwd === "string" ? payload.cwd : undefined) ??
    process.env.CLAUDE_PROJECT_DIR ??
    process.cwd();
  const model = extractModel(payload);

  const session = await resolveSession({
    source: "claude_code",
    external_session_id: externalSessionId,
    model,
    cwd,
    host_user: os.userInfo().username,
  });
  if (!session) return;

  const event = normalizeClaudeEvent(eventName, payload);
  if (!event) return;
  // Carry the original payload as `raw` for debugging / future reprocessing.
  event.raw = payload;
  if (transcriptPath && !event.payload) event.payload = { transcript_path: transcriptPath };

  await recordEvent(session.id, event);
}

function normalizeClaudeEvent(
  eventName: string,
  payload: Record<string, unknown>,
): Omit<AgentEventInput, "seq"> | null {
  switch (eventName) {
    case "SessionStart":
      return {
        event_type: "session_start",
        payload: {
          source: payload.source,
          model: extractModel(payload),
          cwd: payload.cwd,
        },
      };
    case "SessionEnd":
      return {
        event_type: "session_end",
        payload: { reason: payload.reason ?? "unknown" },
      };
    case "UserPromptSubmit":
      return {
        event_type: "user_prompt",
        payload: { prompt: payload.prompt ?? "" },
      };
    case "Stop":
      return {
        event_type: "assistant_message",
        payload: {
          stop_reason: payload.stop_reason,
          content: payload.response ?? payload.content ?? "",
        },
      };
    case "PreToolUse":
      return {
        event_type: "tool_call_start",
        tool_use_id: stringOrUndef(payload.tool_use_id),
        payload: {
          tool_name: payload.tool_name,
          input: payload.tool_input,
        },
      };
    case "PostToolUse":
      return {
        event_type: "tool_call_end",
        tool_use_id: stringOrUndef(payload.tool_use_id),
        payload: {
          tool_name: payload.tool_name,
          input: payload.tool_input,
          output: payload.tool_output,
          error: payload.tool_error,
        },
      };
    case "PermissionRequest":
      return {
        event_type: "permission_request",
        payload: {
          tool_name: payload.tool_name,
          rule: payload.permission_rule ?? payload.rule,
        },
      };
    case "FileChanged":
      return {
        event_type: "file_changed",
        payload: { path: payload.path ?? payload.file_path },
      };
    case "Notification":
      return {
        event_type: "notification",
        payload: { notification_type: payload.notification_type, message: payload.message },
      };
    case "PreCompact":
    case "PostCompact":
      return { event_type: "compaction", payload: { phase: eventName } };
    default:
      return {
        event_type: "custom",
        payload: { event_name: eventName, ...payload },
      };
  }
}

async function handleCodexNotify(payload: Record<string, unknown>): Promise<void> {
  // Codex notify payload includes { type, session_id, ... }.
  const externalSessionId =
    (typeof payload.session_id === "string" ? payload.session_id : undefined) ??
    (typeof payload["session-id"] === "string" ? (payload["session-id"] as string) : undefined) ??
    `codex-${Date.now()}`;
  const session = await resolveSession({
    source: "codex",
    external_session_id: externalSessionId,
    cwd: process.cwd(),
    host_user: os.userInfo().username,
  });
  if (!session) return;

  const type = typeof payload.type === "string" ? payload.type : "custom";
  let event: Omit<AgentEventInput, "seq">;
  if (type === "agent-turn-complete" || type === "turn-complete") {
    event = {
      event_type: "assistant_message",
      payload: { message: payload["last-assistant-message"] ?? payload.message ?? "" },
      raw: payload,
    };
  } else {
    event = { event_type: "custom", payload: { type }, raw: payload };
  }
  await recordEvent(session.id, event);
}

function extractModel(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.model === "string") return payload.model;
  const meta = payload.metadata;
  if (meta && typeof meta === "object" && "model" in meta) {
    const m = (meta as Record<string, unknown>).model;
    if (typeof m === "string") return m;
  }
  return undefined;
}

function stringOrUndef(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on("data", (c: Buffer) => chunks.push(c));
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    process.stdin.on("error", reject);
    // Non-TTY only: in TTY mode there's no piped input.
    if (process.stdin.isTTY) resolve("");
  });
}

// ─── install helpers ───────────────────────────────────────────────────────

const CLAUDE_HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "Stop",
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "FileChanged",
  "Notification",
  "PreCompact",
];

function installClaudeHooks(dryRun: boolean): string[] {
  const settingsFile = path.join(os.homedir(), ".claude", "settings.json");
  const out: string[] = [];
  const settings: Record<string, unknown> = (() => {
    try {
      return JSON.parse(fs.readFileSync(settingsFile, "utf8")) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();
  const hooks = (settings.hooks as Record<string, unknown> | undefined) ?? {};
  for (const event of CLAUDE_HOOK_EVENTS) {
    const command = `inv record claude-hook ${event}`;
    const existing = (hooks[event] as Array<{ matcher?: string; hooks?: unknown[] }> | undefined) ?? [];
    const filtered = existing
      .map((entry) => {
        const innerHooks = (entry.hooks as Array<{ command?: string }> | undefined) ?? [];
        return {
          ...entry,
          hooks: innerHooks.filter((h) => !((h.command ?? "").includes("inv record claude-hook"))),
        };
      })
      .filter((entry) => (entry.hooks as unknown[]).length > 0);
    (filtered as Array<Record<string, unknown>>).push({
      matcher: "*",
      hooks: [{ type: "command", command }],
    });
    hooks[event] = filtered;
  }
  settings.hooks = hooks;

  if (dryRun) {
    out.push(`[dry-run] would write ${settingsFile}`);
    out.push(JSON.stringify(settings.hooks, null, 2));
  } else {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    out.push(`✓ Claude Code hooks installed (${CLAUDE_HOOK_EVENTS.length} events) → ${settingsFile}`);
  }
  return out;
}

function installCodexNotify(dryRun: boolean): string[] {
  const configFile = path.join(os.homedir(), ".codex", "config.toml");
  const notifyLine = `notify = ["inv", "record", "codex", "notify"]`;
  const out: string[] = [];
  let body = "";
  try {
    body = fs.readFileSync(configFile, "utf8");
  } catch {
    body = "";
  }
  if (body.includes("inv") && /notify\s*=\s*\[[^\]]*"inv"[^\]]*\]/.test(body)) {
    out.push(`✓ Codex notify already configured → ${configFile}`);
    return out;
  }
  const next = body.replace(/^notify\s*=.*$/m, "").trimEnd() + `\n${notifyLine}\n`;
  if (dryRun) {
    out.push(`[dry-run] would write ${configFile}`);
    out.push(notifyLine);
  } else {
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.writeFileSync(configFile, next);
    out.push(`✓ Codex notify wired → ${configFile}`);
  }
  return out;
}
