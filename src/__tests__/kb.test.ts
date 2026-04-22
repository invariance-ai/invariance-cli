import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  initKb,
  kbExists,
  resolveInKb,
  writeKbFile,
  listKbMarkdown,
} from "../lib/kb/io.js";
import { upsertIndexEntry } from "../lib/kb/index-file.js";
import { appendLog } from "../lib/kb/log.js";
import {
  appendSessionMessage,
  readSession,
  listSessions,
  newSessionId,
} from "../lib/kb/sessions.js";

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "inv-kb-"));
}

describe("kb/io", () => {
  let root: string;
  beforeEach(() => {
    root = tmpRoot();
  });

  it("initKb scaffolds all expected files and dirs", () => {
    const result = initKb(root);
    expect(kbExists(root)).toBe(true);
    for (const name of ["AGENTS.md", "index.md", "log.md"]) {
      expect(fs.existsSync(path.join(root, name))).toBe(true);
    }
    for (const d of ["raw", "wiki", "runs", "sessions"]) {
      expect(fs.statSync(path.join(root, d)).isDirectory()).toBe(true);
    }
    expect(result.created.length).toBeGreaterThan(0);
  });

  it("initKb is idempotent on re-run", () => {
    initKb(root);
    const second = initKb(root);
    expect(second.created).toHaveLength(0);
    expect(second.skipped.length).toBeGreaterThan(0);
  });

  it("resolveInKb rejects traversal outside root", () => {
    initKb(root);
    expect(() => resolveInKb(root, "../secret")).toThrow(/escapes/);
    expect(() => resolveInKb(root, "wiki/ok.md")).not.toThrow();
  });

  it("listKbMarkdown enumerates authored pages", () => {
    initKb(root);
    writeKbFile(root, "wiki/a.md", "# A");
    writeKbFile(root, "wiki/nested/b.md", "# B");
    const all = listKbMarkdown(root);
    expect(all).toContain("wiki/a.md");
    expect(all).toContain("wiki/nested/b.md");
    expect(all).toContain("index.md");
  });
});

describe("kb/index-file", () => {
  let root: string;
  beforeEach(() => {
    root = tmpRoot();
    initKb(root);
  });

  it("adds a new entry under an existing section", () => {
    upsertIndexEntry(root, "Wiki", "wiki/foo.md", "a foo page");
    const idx = fs.readFileSync(path.join(root, "index.md"), "utf-8");
    expect(idx).toMatch(/`wiki\/foo\.md` — a foo page/);
  });

  it("updates an existing entry in place", () => {
    upsertIndexEntry(root, "Wiki", "wiki/foo.md", "first");
    upsertIndexEntry(root, "Wiki", "wiki/foo.md", "second");
    const idx = fs.readFileSync(path.join(root, "index.md"), "utf-8");
    expect(idx).toContain("second");
    expect(idx).not.toContain("first");
    expect(idx.match(/wiki\/foo\.md/g)!.length).toBe(1);
  });

  it("creates a new section when absent", () => {
    upsertIndexEntry(root, "Monitors", "monitors/m1.md", "alpha");
    const idx = fs.readFileSync(path.join(root, "index.md"), "utf-8");
    expect(idx).toContain("## Monitors");
    expect(idx).toContain("monitors/m1.md");
  });
});

describe("kb/log", () => {
  it("appends a dated line", () => {
    const root = tmpRoot();
    initKb(root);
    appendLog(root, "ingest", "hello");
    const log = fs.readFileSync(path.join(root, "log.md"), "utf-8");
    expect(log).toMatch(/## \[\d{4}-\d{2}-\d{2}\] ingest \| hello/);
  });
});

describe("kb/sessions", () => {
  it("round-trips messages", () => {
    const root = tmpRoot();
    initKb(root);
    const id = newSessionId("my q");
    appendSessionMessage(root, id, {
      role: "user",
      content: "hi",
      timestamp: new Date().toISOString(),
    });
    appendSessionMessage(root, id, {
      role: "assistant",
      content: "hello",
      timestamp: new Date().toISOString(),
    });
    const msgs = readSession(root, id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe("user");
    expect(listSessions(root)[0]!.id).toBe(id);
  });
});

