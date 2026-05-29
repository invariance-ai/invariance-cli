# Invariance CLI (`inv`)

The official command-line interface for [Invariance AI](https://invariance.ai) — create workflow cases, attach execution evidence, and query outcomes from the terminal.

The primary binary is `inv` (with `invariance` available as an alias for back-compat). Every read command supports `--json` and emits stable IDs so coding/ops agents (Claude Code, Codex, etc.) can chain commands without scraping output.

Part of the Invariance SDK family:

- [`@invariance/cli`](./) — command-line interface (this repo).
- [`@invariance/sdk`](https://github.com/invariance-ai/invariance-typescript) — TypeScript SDK.
- [`invariance-sdk`](https://github.com/invariance-ai/invariance-python) — Python SDK.

## Install

```bash
npm install -g @invariance/cli
```

Or with pnpm:

```bash
pnpm add -g @invariance/cli
```

## Quick start

```bash
# Authenticate (browser flow — opens your dashboard)
inv login --browser

# Or paste an API key directly
inv login --api-key inv_live_...

# Confirm identity + connectivity (agent-friendly, --json-clean)
inv status --json

# Print ready-to-use Claude Code / Codex MCP config, env, and smoke-test commands
inv setup agent --json

# Create a case for one workflow instance, then attach a run as evidence
CASE=$(inv case create --workflow-key support.escalation --tenant-id acme --end-user-id cus_123 --json | jq -r .id)
RUN=$(inv run start --name triage --case-id "$CASE" --json | jq -r .id)
inv node write "$RUN" --action-type tool_call --input '{"x":1}' --output '{"y":2}'
inv run finish "$RUN"
inv run verify "$RUN"
inv case close "$CASE" --outcome resolved --value-usd 250 --json

# Inspect a finished run end-to-end (run + nodes in one JSON blob)
inv run inspect "$RUN" --json

# Workflow health, dashboard views, and Cortex
inv workflow-observability executions support.escalation --json
VIEW=$(inv saved-view create --name "Task usage by action" --source nodes --viz bar \
  --spec '{"group_by":"action_type","aggregation":"count","filters":[{"field":"workflow_key","op":"eq","value":"support.escalation"}]}' \
  --json | jq -r .id)
inv saved-view run --id "$VIEW" --json
inv cortex ask "What should the support escalation dashboard show?" \
  --project "$INVARIANCE_PROJECT_ID" \
  --target-type workflow \
  --target-ref support.escalation \
  --json

# Stream nodes, or fetch one page for scripts/smoke tests
inv node tail "$RUN"
inv node tail "$RUN" --once --json

# Export a full run (run + nodes) for offline analysis
inv run export "$RUN" > run.json

# Open in dashboard (or just print the URL with --print)
inv run open "$RUN" --print

# Monitors, signals, reviews
inv monitor list
inv signals list
inv reviews list

# Production run -> eval case -> suite run -> regression compare
inv eval suite create --name regressions --json
inv eval case create-from-run --suite "$SUITE" --run "$RUN" --signal "$SIGNAL" --json
inv eval suite run "$SUITE" --json        # prints {failures, results_url}
inv eval run results "$EVAL_RUN" --json
inv eval compare "$CANDIDATE" "$BASELINE" --json

# JSONL dataset -> dataset + suite + cases + optional run in one command
inv eval dataset seed-suite --name refund-regression --file cases.jsonl --run --json

# Counterfactuals over observed runs/cases
inv cortex counterfactual launch --project-id "$PROJECT" --target run:"$RUN" \
  --question "What if manager approval had been required?" --json
inv cortex counterfactual list --status succeeded --json
inv cortex counterfactual result "$JOB" --json

# Stub commands (backend pending — emit structured API_NOT_AVAILABLE errors)
inv graph get "$RUN" --json
inv guardrails list --json

# Check your setup
inv doctor
```

## Commands

| Command | Description |
| --- | --- |
| `login` / `auth login` | Authenticate with the Invariance API (browser or paste key) |
| `logout` / `auth logout` | Clear stored credentials |
| `auth whoami` | Display the current user |
| `setup agent` | Validate the API key and print agent-ready env, MCP config, smoke-run, eval, and counterfactual commands |
| `config get <key>` / `set` | Read/write a config value |
| `case create` / `list` / `get` / `close` | Manage workflow instances and outcomes |
| `run start` / `list` / `get <id>` | Start, list, inspect execution evidence |
| `run update` / `cancel` / `fork` | Mutate run state |
| `run metrics <id>` / `verify <id>` | Aggregate metrics / verify proof chain |
| `run narrative <id>` / `llm-calls <id>` / `nodes <id>` | LLM-generated summary, LLM call log, node list |
| `node write <run_id>` / `list` / `tail` | Write, list, stream trace nodes |
| `capture create` / `list` / `get` / `update` | Manage captures — raw observations linkable to runs |
| `capture link` / `links` / `unlink` | Link a capture to a run/case/event/node, list links, detach |
| `monitor create` / `list` / `get` / `update` | CRUD monitors |
| `monitor pause` / `resume` / `evaluate` | Control + trigger monitors |
| `monitor executions <id>` / `findings <id>` | Inspect monitor output |
| `signal emit` / `list` / `get` / `ack` / `resolve` | Alert lifecycle |
| `finding list` / `get` / `update` | Investigation records |
| `review list` / `get` / `claim` / `unclaim` / `resolve` | Resolution workflow |
| `agent me` / `set-key` | Identity + key registration |
| `divergence list` / `get` / `update` (alias `divergences`) | Inspect & resolve run-level deviations |
| `workflow-observability list` / `get` / `executions` (alias `wfobs`) | Per-workflow health rollups & per-execution health |
| `eval dataset seed-suite` | Create a dataset, linked suite, cases, and optional eval run from JSONL |
| `saved-view list` / `create` / `get` / `update` / `delete` / `run` (alias `saved-views`) | Dashboard queries (full CRUD + run by id or ad-hoc) |
| `cortex ask` / `launch` / `list` / `retry` / `runs` | Governed analyst questions, jobs, queue inspection, and attempt history |
| `cortex counterfactual launch` / `list` / `result` | Counterfactual evals over observed runs/cases without remembering job-kind strings |
| `receipt create` / `batch` / `list` / `get` (alias `receipts`) | Ingest/inspect external business-system receipts (write needs agent key) |
| `node-type list` / `register` (alias `node-types`) | List & register custom node types |
| `kb page-*` / `session-*` / `messages` / `message-add` | Knowledge-base pages and chat sessions/messages |
| `ask <question>` | Ask the knowledge agent (needs agent key) |
| `metrics overview` | Aggregate metrics across runs |
| `completions <shell>` | Shell completion scripts |
| `doctor` | Check CLI setup for issues |
| `version` | Print the CLI version |

All data commands support `--json` for machine-readable output.

### Agent onboarding

For Claude Code, Codex, Cursor, or any MCP-capable agent, run:

```bash
inv login --api-key inv_live_...
inv setup agent --json
```

The output includes shell env, MCP snippets, a first-run smoke test, an eval
dataset seed command, and a counterfactual launch command. By default generated
snippets redact the secret; pass `--show-secret` only when writing directly into
a private local config.

> **Auth note:** reads accept an agent **or** operator key. Writes that mutate
> business facts — `receipt create`/`batch` and `ask` — require an **agent API
> key** and return a 403 (`AUTH_ERROR`) on operator tokens.

For the full surface-by-surface coverage (TS / Python / CLI / MCP), see
[`../COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md).

### Data-plane examples

```bash
# Workflow health: rollups, then drill into one workflow's executions
inv workflow-observability list --json
inv wfobs executions support.escalation --json

# Divergences: list open policy deviations, then accept one
inv divergence list --status open --kind policy --json
inv divergence update div_123 --status accepted --json

# Saved views: create, run by id, or run an ad-hoc query
VIEW=$(inv saved-view create --name "Open escalations" --source executions \
  --spec '{"aggregation":"count","filters":[{"field":"status","op":"eq","value":"open"}]}' --json | jq -r .id)
inv saved-view run --id "$VIEW" --json
inv saved-view run --source runs --spec '{"aggregation":"avg","aggregation_field":"total_cost_usd"}' --json

# Cortex: ask a cited operational question or queue a deeper job
inv cortex ask "Which open escalations need review, and why?" \
  --project "$INVARIANCE_PROJECT_ID" \
  --target-type workflow \
  --target-ref support.escalation \
  --json
inv cortex launch --project "$INVARIANCE_PROJECT_ID" --kind divergence_error_tracking \
  --target-type workflow --target-ref support.escalation --mode async --json

# Receipts: ingest an external business fact, then list them (agent key required for writes)
inv receipt create --source stripe --kind refund.created --run-id run_1 \
  --external-id re_123 --payload '{"amount_usd":42.50}' --json
inv receipt list --source stripe --json

# Node types: register a custom node type
inv node-type register --name payment.refund --display-name "Payment Refund" \
  --custom-fields-schema '{"amount_usd":"number"}' --json

# Knowledge base + ask
PAGE=$(inv kb page-create --title "Refund SOP" --content "Always confirm approval." --json | jq -r .id)
inv ask "What is our refund approval policy?" --json
```

Link a capture to evidence-graph targets:

```sh
# Legacy: attach to a run by setting run_id
inv capture link cap_123 --run-id run_abc

# Link to any target — --target-type defaults to run
inv capture link cap_123 --target-type case --target-id case_xyz --link-type evidence

inv capture links cap_123            # list all links
inv capture unlink cap_123 --link-id lnk_1
```

## For coding agents (Claude Code, Codex, …)

`inv` is built so coding agents can debug their own agents deterministically. Two commands cover the loop:

```bash
inv run inspect <run_id> --json   # full run + nodes in one structured blob
inv node tail <run_id> --json     # streaming trace events as JSON lines
```

Every command emits stable IDs and structured errors, so chained calls (`jq`, scripts, agents) don't have to scrape human output. When something fails, an agent can fetch the failing run with `inv run inspect`, locate the failing node, and report or replay it.

For launch-ready observability, make this the default agent template: run `inv doctor --json`, create or reuse a case, start a run, write one node per LLM call/tool call/retrieval/decision/handoff/error, emit semantic workflow events, finish or fail the run, then check workflow observability, saved views, open findings, and Cortex suggestions. When Cortex suggests dashboard panels, inspect the SQL-like structured query shape before saving the view.

See [`AGENTS.md`](AGENTS.md) for the agent-friendly command reference.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Error (auth, network, validation, unexpected) |
| `2` | `API_NOT_AVAILABLE` — command/backend not yet implemented |

### Error codes (stable, machine-readable)

In `--json` mode, errors are written to **stderr** as `{"error":{"code","message","status_code"?}}`. Stable codes you can branch on:

| Code | When |
| --- | --- |
| `AUTH_ERROR` | Missing or invalid API key |
| `NOT_FOUND` | Resource ID not found (404) |
| `API_ERROR` | Backend returned a non-2xx for an existing endpoint |
| `CONFIG_ERROR` | Config file or profile is malformed |
| `NETWORK_ERROR` | Could not reach the API |
| `API_NOT_AVAILABLE` | Backend endpoint is not yet implemented (stub) |
| `UNEXPECTED_ERROR` / `UNKNOWN_ERROR` | Anything else |

In `--json` mode, `success`/`warn`/`info` messages are also redirected to stderr so stdout stays a single parseable JSON document.

## Configuration

The CLI reads configuration from (highest priority first):

1. **Environment variables**
   - `INVARIANCE_API_KEY` — API key
   - `INVARIANCE_API_URL` — API base URL (default: `https://api.useinvariance.com`; deprecated alias: `INVARIANCE_BASE_URL`)

2. **Config file** at `~/.invariance/config.json`
   ```json
   {
     "apiKey": "inv_sk_...",
     "baseUrl": "https://api.useinvariance.com"
   }
   ```

3. **Named profiles** for multiple environments:
   ```json
   {
     "apiKey": "inv_sk_prod_...",
     "profiles": {
       "staging": {
         "apiKey": "inv_sk_staging_...",
         "baseUrl": "https://api.staging.invariance.ai"
       }
     }
   }
   ```
   Use with `--profile staging`.

## Global flags

| Flag | Description |
| --- | --- |
| `--json` | Output as JSON |
| `--profile <name>` | Use a named profile |
| `--no-color` | Disable colored output |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
