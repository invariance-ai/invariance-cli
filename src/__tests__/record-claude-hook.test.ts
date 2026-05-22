import { describe, it, expect } from "vitest";
import { normalizeClaudeEvent } from "../commands/record/index.js";

describe("normalizeClaudeEvent — PostToolUse file extraction", () => {
  it("emits tool_call_end + file_changed for Edit", () => {
    const events = normalizeClaudeEvent("PostToolUse", {
      tool_name: "Edit",
      tool_use_id: "toolu_1",
      tool_input: {
        file_path: "/tmp/foo.ts",
        old_string: "const a = 1;",
        new_string: "const a = 2;\nconst b = 3;",
      },
      tool_response: { success: true },
    });
    expect(events).toHaveLength(2);
    expect(events[0]!.event_type).toBe("tool_call_end");
    expect(events[1]!.event_type).toBe("file_changed");
    const fc = events[1]!.payload!;
    expect(fc.path).toBe("/tmp/foo.ts");
    expect(fc.tool).toBe("Edit");
    expect(fc.change_type).toBe("edit");
    expect(fc.lines_added).toBe(2);
    expect(fc.lines_removed).toBe(1);
    expect(fc.bytes_after).toBeGreaterThan(fc.bytes_before as number);
    expect(fc.diff_preview).toContain("- const a = 1;");
    expect(fc.diff_preview).toContain("+ const a = 2;");
  });

  it("emits file_changed with change_type=create for Write", () => {
    const events = normalizeClaudeEvent("PostToolUse", {
      tool_name: "Write",
      tool_input: { file_path: "/tmp/new.md", content: "hello\nworld\n" },
    });
    expect(events).toHaveLength(2);
    const fc = events[1]!.payload!;
    expect(fc.change_type).toBe("create");
    expect(fc.lines_removed).toBe(0);
    expect(fc.lines_added).toBeGreaterThan(0);
  });

  it("collapses MultiEdit edits into one file_changed", () => {
    const events = normalizeClaudeEvent("PostToolUse", {
      tool_name: "MultiEdit",
      tool_input: {
        file_path: "/tmp/m.ts",
        edits: [
          { old_string: "a", new_string: "A" },
          { old_string: "b", new_string: "B" },
        ],
      },
    });
    expect(events).toHaveLength(2);
    expect(events[1]!.payload!.tool).toBe("MultiEdit");
  });

  it("skips file_changed for non-file tools (Bash)", () => {
    const events = normalizeClaudeEvent("PostToolUse", {
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_response: "foo\nbar",
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.event_type).toBe("tool_call_end");
  });

  it("truncates large diffs to 500 chars + ellipsis", () => {
    const big = "x".repeat(2000);
    const events = normalizeClaudeEvent("PostToolUse", {
      tool_name: "Edit",
      tool_input: { file_path: "/tmp/big.txt", old_string: big, new_string: big + "y" },
    });
    const preview = events[1]!.payload!.diff_preview as string;
    expect(preview.length).toBeLessThanOrEqual(501);
    expect(preview.endsWith("…")).toBe(true);
  });
});

describe("normalizeClaudeEvent — SessionStart device enrichment", () => {
  it("injects device_id, hostname, platform into session_start payload", () => {
    const events = normalizeClaudeEvent("SessionStart", {
      source: "startup",
      model: "claude-opus-4-7",
      cwd: "/tmp/proj",
    });
    expect(events).toHaveLength(1);
    const p = events[0]!.payload!;
    expect(typeof p.device_id).toBe("string");
    expect((p.device_id as string).length).toBeGreaterThan(0);
    expect(typeof p.hostname).toBe("string");
    expect(p.platform).toBe(process.platform);
    expect(p.arch).toBe(process.arch);
  });
});
