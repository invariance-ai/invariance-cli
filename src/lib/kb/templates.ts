export const AGENTS_MD = `# AGENTS.md — Knowledge Base Conventions

This directory is an LLM-maintained knowledge base following the
[llm-wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## Layout
- \`raw/\`      immutable source material (articles, pdfs, clipped html, transcripts)
- \`wiki/\`     llm-authored markdown pages (one concept/entity per page)
- \`runs/\`     per-run summaries ingested from the Invariance API
- \`sessions/\` saved \`invariance ask\` conversation transcripts
- \`index.md\`  one-line summary of every page, grouped by category
- \`log.md\`    append-only operation log (\`## [YYYY-MM-DD] op | title\`)

## Ingest workflow
1. Read the source in \`raw/\`.
2. Identify 1–15 wiki pages it touches (new or existing).
3. Write/update each page with **grounded claims + inline citations** to the source.
4. Update \`index.md\` so every page has a current one-liner.
5. Append a line to \`log.md\`.

## Query workflow
1. Read \`index.md\` first. Open only pages whose one-liner is relevant.
2. If the KB doesn't answer the question, call the Invariance API tools
   (\`list_runs\`, \`get_run\`, \`list_run_nodes\`, \`get_run_narrative\`, etc.).
3. Cite runs as \`[run:<id>]\` and wiki pages as \`[[wiki/<slug>]]\`.
4. If the answer is valuable and reusable, file it as a new wiki page.

## Lint workflow
- Flag contradictions across pages, stale claims (check \`log.md\` dates),
  orphan pages (not in \`index.md\`), and obvious data gaps.

## Rules
- Markdown only. No vendor lock-in.
- One fact, one page. Link liberally.
- Never edit files in \`raw/\`.
- Keep \`index.md\` entries under 150 chars each.
`;

export const INITIAL_INDEX_MD = `# Index

_One-line summary of every page, grouped by category. Update on every ingest._

## Runs

_(none yet — ingest with \`invariance kb ingest-run <id>\`)_

## Wiki

_(none yet — ingest with \`invariance kb ingest <path>\`)_
`;

export const INITIAL_LOG_MD = `# Log

_Append-only. Format: \`## [YYYY-MM-DD] <op> | <title>\`_
`;
