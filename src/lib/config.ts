import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ConfigSchema } from "../types/index.js";
import { ConfigError } from "./errors.js";

interface ProfileConfig {
  apiKey?: string;
  baseUrl?: string;
}

interface ConfigFile {
  apiKey?: string;
  baseUrl?: string;
  profile?: string;
  profiles?: Record<string, ProfileConfig>;
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

export function resolveConfig(profile?: string): { apiKey?: string; baseUrl: string } {
  const envApiKey = process.env["INVARIANCE_API_KEY"];
  const envApiUrl = process.env["INVARIANCE_API_URL"];
  const envLegacyBaseUrl = process.env["INVARIANCE_BASE_URL"];
  if (envLegacyBaseUrl && !envApiUrl && !warnedDeprecatedBaseUrl) {
    warnedDeprecatedBaseUrl = true;
    process.stderr.write(
      "warning: INVARIANCE_BASE_URL is deprecated; use INVARIANCE_API_URL instead.\n",
    );
  }
  const envBaseUrl = envApiUrl ?? envLegacyBaseUrl;

  const fileConfig = readConfigFile();

  let profileConfig: ProfileConfig | undefined;
  if (profile && fileConfig.profiles) {
    profileConfig = fileConfig.profiles[profile];
    if (!profileConfig) {
      throw new ConfigError(`Profile '${profile}' not found in config.`);
    }
  }

  return {
    apiKey: envApiKey ?? profileConfig?.apiKey ?? fileConfig.apiKey,
    baseUrl: envBaseUrl ?? profileConfig?.baseUrl ?? fileConfig.baseUrl ?? DEFAULT_BASE_URL,
  };
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

export function setConfigValue(key: string, value: string): void {
  const config = readConfigFile();

  if (key === "apiKey") {
    config.apiKey = value;
  } else if (key === "baseUrl") {
    config.baseUrl = value;
  } else if (key === "profile") {
    config.profile = value;
  } else if (key.startsWith("profiles.")) {
    const parts = key.split(".");
    const profileName = parts[1];
    const profileKey = parts[2];
    if (profileName && profileKey) {
      if (!config.profiles) config.profiles = {};
      if (!config.profiles[profileName]) config.profiles[profileName] = {};
      const p = config.profiles[profileName];
      if (p) {
        if (profileKey === "apiKey") p.apiKey = value;
        else if (profileKey === "baseUrl") p.baseUrl = value;
        else throw new ConfigError(`Unknown profile key: ${profileKey}`);
      }
    } else {
      throw new ConfigError(`Invalid key format. Use 'profiles.<name>.<key>'.`);
    }
  } else {
    throw new ConfigError(
      `Unknown config key: '${key}'. Valid keys: apiKey, baseUrl, profile, profiles.<name>.<key>`,
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
