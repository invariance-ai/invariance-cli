# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, Copilot, etc.) that want to emit traces to Invariance from a user's project.

## What this CLI does

`@invariance/cli` writes **trace nodes** (tool calls, LLM calls, decisions) to Invariance, where they're organised into runs, analysed by monitors, and surfaced as signals and reviews. Use it when you want your actions in this repo to be observable.

## Setup (one-time, human-assisted)

The human user should run these once. Agents should prompt the user to do this rather than attempt a browser flow themselves.

```bash
npm install -g @invariance/cli
inv login --browser   # opens dashboard, approves this device
inv doctor            # verifies setup
```

Credentials are stored at `~/.invariance/config.json`.

Alternative for headless/CI: set `INVARIANCE_API_KEY` in the environment.

## Agent recipe: emit a trace for your task

Wrap any multi-step task with a run. Use `--json` so you can parse IDs.

```bash
# 1. Start a run for the task
RUN_ID=$(inv run start --name "refactor auth middleware" --json | jq -r .id)

# 2. For each tool/LLM call, write a node
inv node write "$RUN_ID" \
  --action-type tool_call \
  --metadata '{"tool":"grep","step":"auth search"}' \
  --input  '{"pattern":"verifyToken"}' \
  --output '{"matches":7}'

# 3. End the run when done
inv run finish "$RUN_ID"

# 4. (Optional) verify the proof chain wasn't tampered with
inv run verify "$RUN_ID"
```

## Agent recipe: ingest a receipt, then query it with a saved view

Receipts are external business-system facts (Stripe refunds, Zendesk tickets, …).
Ingesting one and then querying executions ties outside events back to runs.

```bash
# 1. Ingest a receipt (WRITE — requires an agent API key; operator tokens 403)
inv receipt create --source stripe --kind refund.created \
  --run-id "$RUN_ID" --external-id re_123 \
  --payload '{"amount_usd":42.50,"reason":"duplicate"}' --json

# 2. Create a saved view that counts refund-bearing executions, then run it
VIEW=$(inv saved-view create --name "Refunds today" --source executions \
  --spec '{"aggregation":"count"}' --json | jq -r .id)
inv saved-view run --id "$VIEW" --json

# 2b. Or skip the saved view and run an ad-hoc query
inv saved-view run --source runs \
  --spec '{"aggregation":"avg","aggregation_field":"total_cost_usd"}' --json
```

## Agent recipe: triage workflow health and divergences

```bash
# Per-workflow rollups (execution counts, staleness, errors, cost)
inv workflow-observability list --json
# Drill into one workflow's per-execution health
inv wfobs executions support.escalation --json

# Surface open run-level deviations, then resolve one
inv divergence list --status open --json
inv divergence update div_123 --status accepted --json
```

## Agent recipe: knowledge base + ask

```bash
# Store a doc the answering agent can ground on
inv kb page-create --title "Refund SOP" --content "Always confirm approval." --json
# Ask a cited question (WRITE — requires an agent API key)
inv ask "What is our refund approval policy?" --session-id "$SESSION" --json
# Continue a chat session and inspect history
inv kb session-create --title "Refund Q&A" --json
inv kb messages "$SESSION" --json
```

## Auth: which commands need an agent key

Reads accept an agent **or** operator key. These **writes require an agent API
key** and return `AUTH_ERROR` (403) on operator tokens:

- `receipt create` / `receipt batch`
- `ask`

## Conventions

- **`--action-type`** — use `tool_call`, `llm_call`, `decision`, or `observation`. Stick to these; custom types aren't indexed by monitors yet.
- **`--input` / `--output`** — must be valid JSON. Keep them small (<8KB); store large artifacts separately and reference by ID.
- **`--json`** on every data command returns structured output suitable for `jq`.
- **One run per user-facing task** — don't batch unrelated work into one run; it confuses the swimlane view.
- **Don't emit secrets** — inputs/outputs are stored verbatim. Redact API keys, tokens, PII before writing.

## Discovering what's available

```bash
inv --help             # top-level commands
inv run --help         # subcommands for runs
inv node write --help  # flags for a specific command
```

Every command accepts `--help`; prefer that over guessing flags.

## Failure modes

- `401 Unauthorized` → credentials missing/expired. Ask the user to rerun `inv login --browser`.
- `404 Not Found` on a run ID → run was deleted or belongs to another org. Don't retry; start a new run.
- Network errors → the CLI is non-blocking for your task. Log and continue; don't hang waiting on Invariance.

## When NOT to use this CLI

- Don't emit traces for trivial shell commands (`ls`, `cat`). Trace meaningful units of work.
- Don't use this for general logging — it's structured observability, not `stderr`.
- Don't poll `run get` in a tight loop; use `node tail` for streaming.

## Reference

- Full command list: [`README.md`](./README.md)
- Cross-surface coverage (TS / Python / CLI / MCP): [`../COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)
- Web docs: https://useinvariance.com/docs
- Dashboard: https://console.useinvariance.com
