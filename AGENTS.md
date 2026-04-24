# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, Copilot, etc.) that want to emit traces to Invariance from a user's project.

## What this CLI does

`@invariance/cli` writes **trace nodes** (tool calls, LLM calls, decisions) to Invariance, where they're organised into runs, analysed by monitors, and surfaced as signals and reviews. Use it when you want your actions in this repo to be observable.

## Setup (one-time, human-assisted)

The human user should run these once. Agents should prompt the user to do this rather than attempt a browser flow themselves.

```bash
npm install -g @invariance/cli
invariance login --browser   # opens dashboard, approves this device
invariance doctor            # verifies setup
```

Credentials are stored at `~/.invariance/config.json`.

Alternative for headless/CI: set `INVARIANCE_API_KEY` in the environment.

## Agent recipe: emit a trace for your task

Wrap any multi-step task with a run. Use `--json` so you can parse IDs.

```bash
# 1. Start a run for the task
RUN_ID=$(invariance run start --name "refactor auth middleware" --json | jq -r .id)

# 2. For each tool/LLM call, write a node
invariance node write "$RUN_ID" \
  --action-type tool_call \
  --metadata '{"tool":"grep","step":"auth search"}' \
  --input  '{"pattern":"verifyToken"}' \
  --output '{"matches":7}'

# 3. End the run when done
invariance run update "$RUN_ID" --status completed

# 4. (Optional) verify the proof chain wasn't tampered with
invariance run verify "$RUN_ID"
```

## Conventions

- **`--action-type`** — use `tool_call`, `llm_call`, `decision`, or `observation`. Stick to these; custom types aren't indexed by monitors yet.
- **`--input` / `--output`** — must be valid JSON. Keep them small (<8KB); store large artifacts separately and reference by ID.
- **`--json`** on every data command returns structured output suitable for `jq`.
- **One run per user-facing task** — don't batch unrelated work into one run; it confuses the swimlane view.
- **Don't emit secrets** — inputs/outputs are stored verbatim. Redact API keys, tokens, PII before writing.

## Discovering what's available

```bash
invariance --help             # top-level commands
invariance run --help         # subcommands for runs
invariance node write --help  # flags for a specific command
```

Every command accepts `--help`; prefer that over guessing flags.

## Failure modes

- `401 Unauthorized` → credentials missing/expired. Ask the user to rerun `invariance login --browser`.
- `404 Not Found` on a run ID → run was deleted or belongs to another org. Don't retry; start a new run.
- Network errors → the CLI is non-blocking for your task. Log and continue; don't hang waiting on Invariance.

## When NOT to use this CLI

- Don't emit traces for trivial shell commands (`ls`, `cat`). Trace meaningful units of work.
- Don't use this for general logging — it's structured observability, not `stderr`.
- Don't poll `run get` in a tight loop; use `node tail` for streaming.

## Reference

- Full command list: [`README.md`](./README.md)
- Web docs: https://useinvariance.com/docs
- Dashboard: https://console.useinvariance.com
