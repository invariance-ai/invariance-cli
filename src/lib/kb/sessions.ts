import fs from "node:fs";
import path from "node:path";
import { kbPaths } from "./io.js";

export interface SessionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: unknown;
  name?: string;
  tool_call_id?: string;
  timestamp: string;
}

export interface SessionMeta {
  id: string;
  created_at: string;
  updated_at: string;
  title?: string;
}

function sessionFile(root: string, id: string): string {
  return path.join(kbPaths(root).sessions, `${id}.jsonl`);
}

export function newSessionId(title?: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = title
    ? title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)
    : "ask";
  return `${ts}_${slug || "ask"}`;
}

export function appendSessionMessage(
  root: string,
  id: string,
  msg: SessionMessage,
): void {
  const p = kbPaths(root);
  fs.mkdirSync(p.sessions, { recursive: true });
  fs.appendFileSync(sessionFile(root, id), JSON.stringify(msg) + "\n");
}

export function readSession(root: string, id: string): SessionMessage[] {
  const file = sessionFile(root, id);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionMessage);
}

export function listSessions(root: string): SessionMeta[] {
  const dir = kbPaths(root).sessions;
  if (!fs.existsSync(dir)) return [];
  const out: SessionMeta[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".jsonl")) continue;
    const id = entry.slice(0, -".jsonl".length);
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    const msgs = readSession(root, id);
    const firstUser = msgs.find((m) => m.role === "user");
    const title =
      typeof firstUser?.content === "string"
        ? firstUser.content.slice(0, 80)
        : undefined;
    out.push({
      id,
      created_at: stat.birthtime.toISOString(),
      updated_at: stat.mtime.toISOString(),
      title,
    });
  }
  return out.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function deleteSession(root: string, id: string): boolean {
  const file = sessionFile(root, id);
  if (!fs.existsSync(file)) return false;
  fs.unlinkSync(file);
  return true;
}
