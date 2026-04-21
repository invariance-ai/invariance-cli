# Invariance CLI

The official command-line interface for [Invariance AI](https://invariance.ai) — monitor, trace, and query your AI systems from the terminal.

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
invariance login --browser

# Or paste an API key directly
invariance login --api-key inv_live_...

# Confirm identity
invariance agent me

# Start a run, write a trace node, verify the proof chain
RUN=$(invariance run start --name demo --json | jq -r .id)
invariance node write "$RUN" --action-type tool_call --input '{"x":1}' --output '{"y":2}'
invariance run verify "$RUN"

# Monitors, signals, reviews
invariance monitor list
invariance signal list
invariance review list

# Check your setup
invariance doctor
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
   - `INVARIANCE_BASE_URL` — API base URL (default: `https://api.useinvariance.com`)

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
