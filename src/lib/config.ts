import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ConfigSchema, type ContextConfig } from "../types/index.js";
import { ConfigError } from "./errors.js";

interface ProfileConfig {
  apiKey?: string;
  baseUrl?: string;
  context?: ContextConfig;
}

interface ConfigFile {
  apiKey?: string;
  baseUrl?: string;
  profile?: string;
  profiles?: Record<string, ProfileConfig>;
  context?: ContextConfig;
}

const CONFIG_DIR = path.join(os.homedir(), ".invariance");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DEFAULT_BASE_URL = "https://api.useinvariance.com";

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function readConfigFile(): ConfigFile {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    // Validate with zod but return as our explicit type
    const validated = ConfigSchema.parse(parsed);
    return validated as ConfigFile;
  } catch {
    throw new ConfigError(
      `Invalid config file at ${CONFIG_FILE}. Delete it and run \`invariance auth login\`.`,
    );
  }
}

function writeConfigFile(config: ConfigFile): void {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

/**
 * Resolve a config value with priority: env vars > profile config > root config > default
 */
export function resolveConfig(profile?: string): {
  apiKey?: string;
  baseUrl: string;
  context: ContextConfig;
} {
  const envApiKey = process.env["INVARIANCE_API_KEY"];
  const envBaseUrl = process.env["INVARIANCE_BASE_URL"];
  const envKbPath = process.env["INVARIANCE_KB"];

  const fileConfig = readConfigFile();

  let profileConfig: ProfileConfig | undefined;
  if (profile && fileConfig.profiles) {
    profileConfig = fileConfig.profiles[profile];
    if (!profileConfig) {
      throw new ConfigError(`Profile '${profile}' not found in config.`);
    }
  }

  const baseCtx: ContextConfig = fileConfig.context ?? {};
  const profileCtx: ContextConfig = profileConfig?.context ?? {};
  const context: ContextConfig = {
    kbPath: envKbPath ?? profileCtx.kbPath ?? baseCtx.kbPath,
    systemPrompt: profileCtx.systemPrompt ?? baseCtx.systemPrompt,
    docGlobs: profileCtx.docGlobs ?? baseCtx.docGlobs,
    urlAllowlist: profileCtx.urlAllowlist ?? baseCtx.urlAllowlist,
    repoPaths: profileCtx.repoPaths ?? baseCtx.repoPaths,
    model: profileCtx.model ?? baseCtx.model,
  };

  return {
    apiKey: envApiKey ?? profileConfig?.apiKey ?? fileConfig.apiKey,
    baseUrl: envBaseUrl ?? profileConfig?.baseUrl ?? fileConfig.baseUrl ?? DEFAULT_BASE_URL,
    context,
  };
}

export function resolveKbPath(context: ContextConfig): string {
  return path.resolve(context.kbPath ?? path.join(process.cwd(), ".invariance", "kb"));
}

export function getConfigValue(key: string, profile?: string): unknown {
  const fileConfig = readConfigFile();

  if (profile && fileConfig.profiles) {
    const p = fileConfig.profiles[profile];
    if (p) {
      if (key === "apiKey") return p.apiKey;
      if (key === "baseUrl") return p.baseUrl;
    }
  }

  if (key === "apiKey") return fileConfig.apiKey;
  if (key === "baseUrl") return fileConfig.baseUrl ?? DEFAULT_BASE_URL;
  if (key === "profile") return fileConfig.profile;

  // Check nested keys
  if (key.startsWith("profiles.")) {
    const parts = key.split(".");
    const profileName = parts[1];
    const profileKey = parts[2];
    if (profileName && fileConfig.profiles) {
      const p = fileConfig.profiles[profileName];
      if (p && profileKey) {
        if (profileKey === "apiKey") return p.apiKey;
        if (profileKey === "baseUrl") return p.baseUrl;
      }
      return p;
    }
  }

  return undefined;
}

function applyContextKey(ctx: ContextConfig, key: string, value: string): void {
  switch (key) {
    case "kbPath":
      ctx.kbPath = value;
      return;
    case "systemPrompt":
      ctx.systemPrompt = value;
      return;
    case "model":
      ctx.model = value;
      return;
    case "docGlobs":
    case "urlAllowlist":
    case "repoPaths": {
      const arr = value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      ctx[key] = arr;
      return;
    }
    default:
      throw new ConfigError(
        `Unknown context key: '${key}'. Valid: kbPath, systemPrompt, model, docGlobs, urlAllowlist, repoPaths.`,
      );
  }
}

export function setConfigValue(key: string, value: string): void {
  const config = readConfigFile();

  if (key === "apiKey") {
    config.apiKey = value;
  } else if (key === "baseUrl") {
    config.baseUrl = value;
  } else if (key === "profile") {
    config.profile = value;
  } else if (key.startsWith("context.")) {
    const sub = key.slice("context.".length);
    if (!config.context) config.context = {};
    applyContextKey(config.context, sub, value);
  } else if (key.startsWith("profiles.")) {
    const parts = key.split(".");
    const profileName = parts[1];
    if (!profileName) {
      throw new ConfigError(`Invalid key format. Use 'profiles.<name>.<key>'.`);
    }
    if (!config.profiles) config.profiles = {};
    if (!config.profiles[profileName]) config.profiles[profileName] = {};
    const p = config.profiles[profileName]!;

    if (parts.length === 3) {
      const profileKey = parts[2]!;
      if (profileKey === "apiKey") p.apiKey = value;
      else if (profileKey === "baseUrl") p.baseUrl = value;
      else throw new ConfigError(`Unknown profile key: ${profileKey}`);
    } else if (parts.length === 4 && parts[2] === "context") {
      if (!p.context) p.context = {};
      applyContextKey(p.context, parts[3]!, value);
    } else {
      throw new ConfigError(
        `Invalid key format. Use 'profiles.<name>.<key>' or 'profiles.<name>.context.<key>'.`,
      );
    }
  } else {
    throw new ConfigError(
      `Unknown config key: '${key}'. Valid keys: apiKey, baseUrl, profile, context.<key>, profiles.<name>.<key>, profiles.<name>.context.<key>.`,
    );
  }

  writeConfigFile(config);
}

export function clearConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    const config = readConfigFile();
    delete config.apiKey;
    writeConfigFile(config);
  }
}

export function isConfigValid(): boolean {
  try {
    readConfigFile();
    return true;
  } catch {
    return false;
  }
}

export function configFileExists(): boolean {
  return fs.existsSync(CONFIG_FILE);
}

export function saveApiKey(apiKey: string, profile?: string): void {
  const config = readConfigFile();
  if (profile) {
    if (!config.profiles) config.profiles = {};
    if (!config.profiles[profile]) config.profiles[profile] = {};
    const p = config.profiles[profile];
    if (p) p.apiKey = apiKey;
  } else {
    config.apiKey = apiKey;
  }
  writeConfigFile(config);
}
