import fs from "node:fs";
import path from "node:path";
import { AGENTS_MD, INITIAL_INDEX_MD, INITIAL_LOG_MD } from "./templates.js";

export interface KbPaths {
  root: string;
  agents: string;
  index: string;
  log: string;
  raw: string;
  wiki: string;
  runs: string;
  sessions: string;
}

export function kbPaths(root: string): KbPaths {
  return {
    root,
    agents: path.join(root, "AGENTS.md"),
    index: path.join(root, "index.md"),
    log: path.join(root, "log.md"),
    raw: path.join(root, "raw"),
    wiki: path.join(root, "wiki"),
    runs: path.join(root, "runs"),
    sessions: path.join(root, "sessions"),
  };
}

export interface InitResult {
  created: string[];
  skipped: string[];
}

export function initKb(root: string): InitResult {
  const p = kbPaths(root);
  const created: string[] = [];
  const skipped: string[] = [];

  for (const dir of [p.root, p.raw, p.wiki, p.runs, p.sessions]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      created.push(dir);
    } else {
      skipped.push(dir);
    }
  }

  const files: [string, string][] = [
    [p.agents, AGENTS_MD],
    [p.index, INITIAL_INDEX_MD],
    [p.log, INITIAL_LOG_MD],
  ];
  for (const [file, contents] of files) {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, contents);
      created.push(file);
    } else {
      skipped.push(file);
    }
  }

  return { created, skipped };
}

export function kbExists(root: string): boolean {
  const p = kbPaths(root);
  return fs.existsSync(p.agents) && fs.existsSync(p.index);
}

export function requireKb(root: string): KbPaths {
  const p = kbPaths(root);
  if (!kbExists(root)) {
    throw new Error(
      `No knowledge base at ${root}. Run \`invariance kb init\` first.`,
    );
  }
  return p;
}

/** Resolve a KB-relative path, rejecting traversal outside the root. */
export function resolveInKb(root: string, rel: string): string {
  const absRoot = path.resolve(root);
  const abs = path.resolve(absRoot, rel);
  if (abs !== absRoot && !abs.startsWith(absRoot + path.sep)) {
    throw new Error(`Path escapes knowledge base: ${rel}`);
  }
  return abs;
}

export function readKbFile(root: string, rel: string): string {
  const abs = resolveInKb(root, rel);
  return fs.readFileSync(abs, "utf-8");
}

export function writeKbFile(root: string, rel: string, contents: string): void {
  const abs = resolveInKb(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

export function listKbMarkdown(root: string, subdir?: string): string[] {
  const start = subdir ? resolveInKb(root, subdir) : root;
  if (!fs.existsSync(start)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(path.relative(root, full));
      }
    }
  };
  walk(start);
  return out.sort();
}
