import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { printValue } from "../lib/cmd.js";
import type { GlobalOptions } from "../types/index.js";

describe("printValue", () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let writes: string[];

  beforeEach(() => {
    writes = [];
    writeSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: unknown) => {
        writes.push(String(chunk));
        return true;
      });
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it("emits compact single-line JSON ending with newline when globals.json is true", () => {
    printValue({ id: "x" }, { json: true } as GlobalOptions);
    const out = writes.join("");
    expect(out).toBe(`{"id":"x"}\n`);
    expect(out.endsWith("\n")).toBe(true);
    expect(out.split("\n").filter(Boolean)).toHaveLength(1);
  });

  it("emits pretty text (multi-line, not raw compact JSON) when globals.json is false", () => {
    printValue({ id: "x" }, { json: false } as GlobalOptions);
    const out = writes.join("");
    expect(out).not.toBe(`{"id":"x"}\n`);
    expect(out).toContain("id");
    expect(out).toContain("x");
    expect(out.endsWith("\n")).toBe(true);
  });
});
