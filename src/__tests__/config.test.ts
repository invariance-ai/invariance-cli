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
    delete process.env["INVARIANCE_API_URL"];
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

  it("should use env var INVARIANCE_API_URL over config file", async () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({ baseUrl: "https://file.example.com" }),
    );
    process.env["INVARIANCE_API_URL"] = "https://env.example.com";

    const { resolveConfig } = await import("../lib/config.js");
    const config = resolveConfig();

    expect(config.baseUrl).toBe("https://env.example.com");
  });

  it("should fall back to deprecated INVARIANCE_BASE_URL when INVARIANCE_API_URL is unset", async () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({ baseUrl: "https://file.example.com" }),
    );
    process.env["INVARIANCE_BASE_URL"] = "https://legacy.example.com";

    const { resolveConfig } = await import("../lib/config.js");
    const config = resolveConfig();

    expect(config.baseUrl).toBe("https://legacy.example.com");
  });

  it("should prefer INVARIANCE_API_URL over INVARIANCE_BASE_URL when both are set", async () => {
    process.env["INVARIANCE_API_URL"] = "https://new.example.com";
    process.env["INVARIANCE_BASE_URL"] = "https://legacy.example.com";

    const { resolveConfig } = await import("../lib/config.js");
    const config = resolveConfig();

    expect(config.baseUrl).toBe("https://new.example.com");
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

  it("should use the configured default profile when no profile flag is provided", async () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        apiKey: "default-key",
        profile: "staging",
        profiles: {
          staging: {
            apiKey: "staging-key",
            baseUrl: "https://staging.invariance.ai",
          },
        },
      }),
    );

    const { resolveConfig } = await import("../lib/config.js");
    const config = resolveConfig();

    expect(config.apiKey).toBe("staging-key");
    expect(config.baseUrl).toBe("https://staging.invariance.ai");
  });

  it("should let an explicit profile override the configured default profile", async () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        profile: "staging",
        profiles: {
          staging: { apiKey: "staging-key" },
          prod: { apiKey: "prod-key", baseUrl: "https://api.useinvariance.com" },
        },
      }),
    );

    const { resolveConfig } = await import("../lib/config.js");
    const config = resolveConfig("prod");

    expect(config.apiKey).toBe("prod-key");
    expect(config.baseUrl).toBe("https://api.useinvariance.com");
  });

  it("should throw for unknown profile", async () => {
    fs.writeFileSync(configFile, JSON.stringify({ profiles: {} }));

    const { resolveConfig } = await import("../lib/config.js");

    expect(() => resolveConfig("nonexistent")).toThrow("Profile 'nonexistent' not found");
  });

  it("should throw when the configured default profile is missing", async () => {
    fs.writeFileSync(configFile, JSON.stringify({ profile: "staging" }));

    const { resolveConfig } = await import("../lib/config.js");

    expect(() => resolveConfig()).toThrow("Profile 'staging' not found");
  });
});

describe("AI provider keys", () => {
  let configDir: string;
  let configFile: string;

  beforeEach(() => {
    configDir = path.join(tmpBase, ".invariance");
    configFile = path.join(configDir, "config.json");
    if (fs.existsSync(configDir)) fs.rmSync(configDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });

    for (const env of [
      "INVARIANCE_API_KEY",
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "BRAINTRUST_API_KEY",
      "BRAINTRUST_OPENAI_BASE_URL",
    ]) {
      delete process.env[env];
    }
  });

  it("resolves all four providers from env vars when present", async () => {
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-x";
    process.env["OPENAI_API_KEY"] = "sk-openai-x";
    process.env["BRAINTRUST_API_KEY"] = "bt-x";
    process.env["BRAINTRUST_OPENAI_BASE_URL"] = "https://proxy.example.com";

    const { resolveAiKeys } = await import("../lib/config.js");
    const keys = resolveAiKeys();
    expect(keys.anthropic).toBe("sk-ant-x");
    expect(keys.openai).toBe("sk-openai-x");
    expect(keys.braintrust).toBe("bt-x");
    expect(keys.braintrustBaseUrl).toBe("https://proxy.example.com");
  });

  it("env vars override stored config", async () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({ aiKeys: { anthropic: "stored-ant", openai: "stored-openai" } }),
    );
    process.env["ANTHROPIC_API_KEY"] = "env-ant";

    const { resolveAiKeys } = await import("../lib/config.js");
    const keys = resolveAiKeys();
    expect(keys.anthropic).toBe("env-ant");
    expect(keys.openai).toBe("stored-openai");
  });

  it("profile aiKeys override root aiKeys when profile is selected", async () => {
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        aiKeys: { anthropic: "root-ant", openai: "root-openai" },
        profiles: {
          staging: { aiKeys: { anthropic: "profile-ant" } },
        },
      }),
    );

    const { resolveAiKeys } = await import("../lib/config.js");
    const keys = resolveAiKeys("staging");
    expect(keys.anthropic).toBe("profile-ant");
    // openai falls through to root because the profile doesn't override it
    expect(keys.openai).toBe("root-openai");
  });

  it("returns empty object when nothing is configured", async () => {
    const { resolveAiKeys } = await import("../lib/config.js");
    expect(resolveAiKeys()).toEqual({});
  });

  it("setAiKey writes to root config", async () => {
    const { setAiKey, resolveAiKeys } = await import("../lib/config.js");
    setAiKey("anthropic", "sk-stored");
    expect(resolveAiKeys().anthropic).toBe("sk-stored");
  });

  it("setAiKey with profile writes scoped to that profile", async () => {
    fs.writeFileSync(configFile, JSON.stringify({ profiles: { staging: {} } }));
    const { setAiKey, resolveAiKeys } = await import("../lib/config.js");
    setAiKey("openai", "sk-staging", "staging");
    expect(resolveAiKeys("staging").openai).toBe("sk-staging");
    expect(resolveAiKeys().openai).toBeUndefined();
  });

  it("setConfigValue accepts aiKeys.<provider> dotted path", async () => {
    const { setConfigValue, resolveAiKeys } = await import("../lib/config.js");
    setConfigValue("aiKeys.braintrust", "bt-stored");
    expect(resolveAiKeys().braintrust).toBe("bt-stored");
  });

  it("setConfigValue rejects unknown AI provider", async () => {
    const { setConfigValue } = await import("../lib/config.js");
    expect(() => setConfigValue("aiKeys.gemini", "x")).toThrow("Unknown AI provider");
  });

  it("AI keys must never appear under the apiKey root field", async () => {
    // Invariance: the Invariance API key and AI provider keys live in
    // *separate* slots. Setting an AI key must not mutate `apiKey`.
    const { setAiKey, resolveConfig } = await import("../lib/config.js");
    setAiKey("anthropic", "sk-ant");
    expect(resolveConfig().apiKey).toBeUndefined();
  });
});
