import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { AI_PROVIDERS, ConfigSchema, type AiKeys, type AiProvider } from "../types/index.js";
import { ConfigError } from "./errors.js";

export interface SessionData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface ProfileConfig {
  apiKey?: string;
  baseUrl?: string;
  session?: SessionData;
  aiKeys?: AiKeys;
}

interface ConfigFile {
  apiKey?: string;
  baseUrl?: string;
  profile?: string;
  session?: SessionData;
  aiKeys?: AiKeys;
  profiles?: Record<string, ProfileConfig>;
}

const AI_KEY_ENV: Record<AiProvider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  braintrust: "BRAINTRUST_API_KEY",
  braintrustBaseUrl: "BRAINTRUST_OPENAI_BASE_URL",
};

export function isAiProvider(value: string): value is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

export function aiKeyEnvVar(provider: AiProvider): string {
  return AI_KEY_ENV[provider];
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
      `Your config file at ${CONFIG_FILE} is invalid. Run \`invariance auth logout\` to reset it, then \`invariance login\` to re-authenticate.`,
    );
  }
}

function writeConfigFile(config: ConfigFile): void {
  ensureConfigDir();
  const payload = JSON.stringify(config, null, 2) + "\n";
  const tmp = `${CONFIG_FILE}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, payload, { mode: 0o600 });
  try {
    fs.renameSync(tmp, CONFIG_FILE);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // best-effort cleanup
    }
    throw err;
  }
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
let warnedDeprecatedBaseUrl = false;

export function resolveConfig(profile?: string): {
  apiKey?: string;
  baseUrl: string;
  session?: SessionData;
} {
  const envApiKey = process.env["INVARIANCE_API_KEY"];
  const envApiUrl = process.env["INVARIANCE_API_URL"];
  const envLegacyBaseUrl = process.env["INVARIANCE_BASE_URL"];
  if (envLegacyBaseUrl && !envApiUrl && !warnedDeprecatedBaseUrl) {
    warnedDeprecatedBaseUrl = true;
    process.stderr.write(
      "warning: INVARIANCE_BASE_URL is deprecated; use INVARIANCE_API_URL instead. " +
        "Support for INVARIANCE_BASE_URL will be removed on 2026-08-01.\n",
    );
  }
  const envBaseUrl = envApiUrl ?? envLegacyBaseUrl;

  const fileConfig = readConfigFile();

  const selectedProfile = profile ?? fileConfig.profile;

  let profileConfig: ProfileConfig | undefined;
  if (selectedProfile) {
    profileConfig = fileConfig.profiles?.[selectedProfile];
    if (!profileConfig) {
      throw new ConfigError(`Profile '${selectedProfile}' not found in config.`);
    }
  }

  return {
    apiKey: envApiKey ?? profileConfig?.apiKey ?? fileConfig.apiKey,
    baseUrl: envBaseUrl ?? profileConfig?.baseUrl ?? fileConfig.baseUrl ?? DEFAULT_BASE_URL,
    session: profileConfig?.session ?? fileConfig.session,
  };
}

/**
 * Resolve AI provider keys (Anthropic, OpenAI, Braintrust) used for running
 * models in evals. These are orthogonal to the Invariance API key — they
 * are *never* sent to the Invariance API.
 *
 * Priority: env var > profile aiKeys > root aiKeys.
 */
export function resolveAiKeys(profile?: string): AiKeys {
  const fileConfig = readConfigFile();
  const selectedProfile = profile ?? fileConfig.profile;

  let profileConfig: ProfileConfig | undefined;
  if (selectedProfile) {
    profileConfig = fileConfig.profiles?.[selectedProfile];
    if (!profileConfig) {
      throw new ConfigError(`Profile '${selectedProfile}' not found in config.`);
    }
  }

  const result: AiKeys = {};
  for (const provider of AI_PROVIDERS) {
    const fromEnv = process.env[AI_KEY_ENV[provider]];
    const fromProfile = profileConfig?.aiKeys?.[provider];
    const fromRoot = fileConfig.aiKeys?.[provider];
    const value = fromEnv ?? fromProfile ?? fromRoot;
    if (value) result[provider] = value;
  }
  return result;
}

export function setAiKey(provider: AiProvider, value: string, profile?: string): void {
  const config = readConfigFile();
  if (profile) {
    if (!config.profiles) config.profiles = {};
    if (!config.profiles[profile]) config.profiles[profile] = {};
    const p = config.profiles[profile];
    if (p) {
      if (!p.aiKeys) p.aiKeys = {};
      p.aiKeys[provider] = value;
    }
  } else {
    if (!config.aiKeys) config.aiKeys = {};
    config.aiKeys[provider] = value;
  }
  writeConfigFile(config);
}

export function clearAiKey(provider: AiProvider, profile?: string): void {
  if (!fs.existsSync(CONFIG_FILE)) return;
  let config: ConfigFile;
  try {
    config = readConfigFile();
  } catch {
    return;
  }
  if (profile) {
    const p = config.profiles?.[profile];
    if (p?.aiKeys) delete p.aiKeys[provider];
  } else if (config.aiKeys) {
    delete config.aiKeys[provider];
  }
  writeConfigFile(config);
}

export function saveSession(session: SessionData, profile?: string): void {
  const config = readConfigFile();
  if (profile) {
    if (!config.profiles) config.profiles = {};
    if (!config.profiles[profile]) config.profiles[profile] = {};
    const p = config.profiles[profile];
    if (p) p.session = session;
  } else {
    config.session = session;
  }
  writeConfigFile(config);
}

export function clearSession(profile?: string): void {
  if (!fs.existsSync(CONFIG_FILE)) return;
  let config: ConfigFile;
  try {
    config = readConfigFile();
  } catch {
    return;
  }
  if (profile) {
    if (config.profiles?.[profile]) delete config.profiles[profile].session;
  } else {
    delete config.session;
  }
  writeConfigFile(config);
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

  if (key.startsWith("aiKeys.")) {
    const provider = key.slice("aiKeys.".length);
    if (!isAiProvider(provider)) return undefined;
    if (profile && fileConfig.profiles) {
      const p = fileConfig.profiles[profile];
      if (p?.aiKeys?.[provider] !== undefined) return p.aiKeys[provider];
    }
    return fileConfig.aiKeys?.[provider];
  }

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

export function setConfigValue(key: string, value: string): void {
  const config = readConfigFile();

  if (key === "apiKey") {
    config.apiKey = value;
  } else if (key === "baseUrl") {
    config.baseUrl = value;
  } else if (key === "profile") {
    config.profile = value;
  } else if (key.startsWith("aiKeys.")) {
    const provider = key.slice("aiKeys.".length);
    if (!isAiProvider(provider)) {
      throw new ConfigError(
        `Unknown AI provider: '${provider}'. Valid: ${AI_PROVIDERS.join(", ")}.`,
      );
    }
    if (!config.aiKeys) config.aiKeys = {};
    config.aiKeys[provider] = value;
  } else if (key.startsWith("profiles.")) {
    const parts = key.split(".");
    const profileName = parts[1];
    const profileKey = parts[2];
    const profileSubKey = parts[3];
    if (profileName && profileKey) {
      if (!config.profiles) config.profiles = {};
      if (!config.profiles[profileName]) config.profiles[profileName] = {};
      const p = config.profiles[profileName];
      if (p) {
        if (profileKey === "apiKey") p.apiKey = value;
        else if (profileKey === "baseUrl") p.baseUrl = value;
        else if (profileKey === "aiKeys" && profileSubKey) {
          if (!isAiProvider(profileSubKey)) {
            throw new ConfigError(
              `Unknown AI provider: '${profileSubKey}'. Valid: ${AI_PROVIDERS.join(", ")}.`,
            );
          }
          if (!p.aiKeys) p.aiKeys = {};
          p.aiKeys[profileSubKey] = value;
        } else throw new ConfigError(`Unknown profile key: ${profileKey}`);
      }
    } else {
      throw new ConfigError(`Invalid key format. Use 'profiles.<name>.<key>'.`);
    }
  } else {
    throw new ConfigError(
      `Unknown config key: '${key}'. Valid keys: apiKey, baseUrl, profile, aiKeys.<provider>, profiles.<name>.<key>`,
    );
  }

  writeConfigFile(config);
}

export function clearConfig(): void {
  if (!fs.existsSync(CONFIG_FILE)) return;
  let config: ConfigFile;
  try {
    config = readConfigFile();
  } catch {
    // Corrupt file — reset to a clean empty config rather than erroring.
    config = {};
  }
  delete config.apiKey;
  delete config.session;
  writeConfigFile(config);
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
