import fs from "node:fs";
import { kbPaths } from "./io.js";

/**
 * Upsert a one-line entry for `relPath` under the given heading section.
 * Minimal parser: section = "## <name>", entries = "- `<path>` — <summary>".
 */
export function upsertIndexEntry(
  root: string,
  section: string,
  relPath: string,
  summary: string,
): void {
  const p = kbPaths(root);
  const content = fs.existsSync(p.index) ? fs.readFileSync(p.index, "utf-8") : "# Index\n";
  const lines = content.split("\n");

  const sectionHeader = `## ${section}`;
  let sectionStart = lines.findIndex((l) => l.trim() === sectionHeader);
  if (sectionStart === -1) {
    if (lines[lines.length - 1] !== "") lines.push("");
    lines.push(sectionHeader, "", `- \`${relPath}\` — ${summary}`, "");
    fs.writeFileSync(p.index, lines.join("\n"));
    return;
  }

  let sectionEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (lines[i]!.startsWith("## ")) {
      sectionEnd = i;
      break;
    }
  }

  const entryPrefix = `- \`${relPath}\``;
  const newEntry = `${entryPrefix} — ${summary}`;
  const existingIdx = lines
    .slice(sectionStart, sectionEnd)
    .findIndex((l) => l.startsWith(entryPrefix));

  if (existingIdx >= 0) {
    lines[sectionStart + existingIdx] = newEntry;
  } else {
    let insertAt = sectionEnd;
    while (insertAt > sectionStart + 1 && lines[insertAt - 1]!.trim() === "") insertAt--;
    lines.splice(insertAt, 0, newEntry);
  }

  fs.writeFileSync(p.index, lines.join("\n"));
}
