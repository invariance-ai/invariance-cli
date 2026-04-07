import { describe, it, expect } from "vitest";
import {
  bashCompletionScript,
  zshCompletionScript,
  fishCompletionScript,
} from "../commands/completions.js";

describe("completions", () => {
  it("should generate non-empty bash completion script", () => {
    const script = bashCompletionScript();
    expect(script.length).toBeGreaterThan(0);
    expect(script).toContain("_invariance");
    expect(script).toContain("complete");
  });

  it("should generate non-empty zsh completion script", () => {
    const script = zshCompletionScript();
    expect(script.length).toBeGreaterThan(0);
    expect(script).toContain("#compdef invariance");
    expect(script).toContain("_invariance");
  });

  it("should generate non-empty fish completion script", () => {
    const script = fishCompletionScript();
    expect(script.length).toBeGreaterThan(0);
    expect(script).toContain("complete -c invariance");
  });

  it("bash completion should include all command groups", () => {
    const script = bashCompletionScript();
    for (const cmd of ["auth", "config", "trace", "monitor", "eval", "dataset", "session"]) {
      expect(script).toContain(cmd);
    }
  });

  it("zsh completion should include all command groups", () => {
    const script = zshCompletionScript();
    for (const cmd of ["auth", "config", "trace", "monitor", "eval", "dataset", "session"]) {
      expect(script).toContain(cmd);
    }
  });

  it("fish completion should include all command groups", () => {
    const script = fishCompletionScript();
    for (const cmd of ["auth", "config", "trace", "monitor", "eval", "dataset", "session"]) {
      expect(script).toContain(cmd);
    }
  });
});
