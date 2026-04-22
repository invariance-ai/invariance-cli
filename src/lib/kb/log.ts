import fs from "node:fs";
import { kbPaths } from "./io.js";

export function appendLog(root: string, op: string, title: string): void {
  const p = kbPaths(root);
  const date = new Date().toISOString().slice(0, 10);
  const line = `\n## [${date}] ${op} | ${title}\n`;
  fs.appendFileSync(p.log, line);
}
