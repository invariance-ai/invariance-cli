import fs from "node:fs";
import path from "node:path";
import { listKbMarkdown } from "./io.js";

export interface SearchHit {
  file: string;
  line: number;
  text: string;
}

/** Plain substring search across all *.md files under the KB root. */
export function searchKb(root: string, query: string, limit = 50): SearchHit[] {
  if (!query) return [];
  const needle = query.toLowerCase();
  const hits: SearchHit[] = [];
  for (const rel of listKbMarkdown(root)) {
    const abs = path.join(root, rel);
    const text = fs.readFileSync(abs, "utf-8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.toLowerCase().includes(needle)) {
        hits.push({ file: rel, line: i + 1, text: lines[i]!.trim().slice(0, 240) });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}
