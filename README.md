# Invariance CLI (`inv`)

The official command-line interface for [Invariance AI](https://invariance.ai) — monitor, trace, and query your AI systems from the terminal.

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

# Start a run, write a trace node, verify the proof chain
RUN=$(inv runs start --name demo --json | jq -r .id)
inv nodes write "$RUN" --action-type tool_call --input '{"x":1}' --output '{"y":2}'
inv runs verify "$RUN"

# Stream nodes, or fetch one page for scripts/smoke tests
inv nodes tail "$RUN"
inv nodes tail "$RUN" --once --json

# Export a full run (run + nodes) for offline analysis
inv runs export "$RUN" > run.json

# Open in dashboard (or just print the URL with --print)
inv runs open "$RUN" --print

# Monitors, signals, reviews
inv monitor list
inv signals list
inv reviews list

# Stub commands (backend pending — emit structured API_NOT_AVAILABLE errors)
inv graph get "$RUN" --json
inv evals create-case --from-run "$RUN" --suite regressions --json
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
| `config get <key>` / `set` | Read/write a config value |
| `run start` / `list` / `get <id>` | Start, list, inspect runs |
| `run update` / `cancel` / `fork` | Mutate run state |
| `run metrics <id>` / `verify <id>` | Aggregate metrics / verify proof chain |
| `run narrative <id>` / `llm-calls <id>` / `nodes <id>` | LLM-generated summary, LLM call log, node list |
| `node write <run_id>` / `list` / `tail` | Write, list, stream trace nodes |
| `monitor create` / `list` / `get` / `update` | CRUD monitors |
| `monitor pause` / `resume` / `evaluate` | Control + trigger monitors |
| `monitor executions <id>` / `findings <id>` | Inspect monitor output |
| `signal emit` / `list` / `get` / `ack` / `resolve` | Alert lifecycle |
| `finding list` / `get` / `update` | Investigation records |
| `review list` / `get` / `claim` / `unclaim` / `resolve` | Resolution workflow |
| `agent me` / `set-key` | Identity + key registration |
| `metrics overview` | Aggregate metrics across runs |
| `completions <shell>` | Shell completion scripts |
| `doctor` | Check CLI setup for issues |
| `version` | Print the CLI version |

All data commands support `--json` for machine-readable output.

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
