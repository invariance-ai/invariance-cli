import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// Mock os.homedir before the config module evaluates CONFIG_DIR
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "inv-test-base-"));
vi.mock("node:os", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:os")>();
  return {
    ...original,
    default: {
      ...original,
      homedir: () => tmpBase,
    },
  };
});

describe("config", () => {
  const originalEnv = { ...process.env };
  let configDir: string;
  let configFile: string;

  beforeEach(() => {
    configDir = path.join(tmpBase, ".invariance");
    configFile = path.join(configDir, "config.json");
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true });
    }
    fs.mkdirSync(configDir, { recursive: true });

    // Clear env vars
    delete process.env["INVARIANCE_API_KEY"];
    delete process.env["INVARIANCE_BASE_URL"];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("should use env var INVARIANCE_API_KEY over config file", async () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({ apiKey: "file-key", baseUrl: "https://api.useinvariance.com" }),
    );
    process.env["INVARIANCE_API_KEY"] = "env-key";

    const { resolveConfig } = await import("../lib/config.js");
    const config = resolveConfig();

    expect(config.apiKey).toBe("env-key");
  });

  it("should use env var INVARIANCE_BASE_URL over config file", async () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({ baseUrl: "https://file.example.com" }),
    );
    process.env["INVARIANCE_BASE_URL"] = "https://env.example.com";

    const { resolveConfig } = await import("../lib/config.js");
    const config = resolveConfig();

    expect(config.baseUrl).toBe("https://env.example.com");
  });

  it("should use default baseUrl when nothing is configured", async () => {
    fs.writeFileSync(configFile, JSON.stringify({}));

    const { resolveConfig } = await import("../lib/config.js");
    const config = resolveConfig();

    expect(config.baseUrl).toBe("https://api.useinvariance.com");
  });

  it("should read from named profile when specified", async () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        apiKey: "default-key",
        profiles: {
          staging: {
            apiKey: "staging-key",
            baseUrl: "https://staging.invariance.ai",
          },
        },
      }),
    );

    const { resolveConfig } = await import("../lib/config.js");
    const config = resolveConfig("staging");

    expect(config.apiKey).toBe("staging-key");
    expect(config.baseUrl).toBe("https://staging.invariance.ai");
  });

  it("should throw for unknown profile", async () => {
    fs.writeFileSync(configFile, JSON.stringify({ profiles: {} }));

    const { resolveConfig } = await import("../lib/config.js");

    expect(() => resolveConfig("nonexistent")).toThrow("Profile 'nonexistent' not found");
  });
});
