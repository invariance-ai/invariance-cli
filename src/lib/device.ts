import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

const DEVICE_ID_FILE = path.join(os.homedir(), ".invariance", "device-id");

export interface DeviceInfo {
  device_id: string;
  hostname: string;
  platform: NodeJS.Platform;
  os_release: string;
  arch: string;
}

export function getDeviceId(): string {
  try {
    const existing = fs.readFileSync(DEVICE_ID_FILE, "utf8").trim();
    if (existing) return existing;
  } catch {
    /* fall through */
  }
  const id = crypto.randomUUID();
  try {
    fs.mkdirSync(path.dirname(DEVICE_ID_FILE), { recursive: true, mode: 0o700 });
    fs.writeFileSync(DEVICE_ID_FILE, id + "\n", { mode: 0o600 });
  } catch {
    /* ephemeral if write fails; still return the id */
  }
  return id;
}

export function getDeviceInfo(): DeviceInfo {
  return {
    device_id: getDeviceId(),
    hostname: os.hostname(),
    platform: process.platform,
    os_release: os.release(),
    arch: process.arch,
  };
}
