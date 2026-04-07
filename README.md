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
# Authenticate
invariance auth login

# Run a query
invariance query "Show me all failed traces from the last hour"

# List recent traces
invariance trace list --limit 10

# Check your setup
invariance doctor
```

## Commands

| Command | Description |
| --- | --- |
| `auth login` | Authenticate with the Invariance API |
| `auth logout` | Clear stored credentials |
| `auth whoami` | Display the current user |
| `config get <key>` | Read a config value |
| `config set <key> <value>` | Set a config value |
| `trace list` | List traces |
| `trace get <id>` | Get trace details |
| `query <prompt>` | Run a natural-language query |
| `monitor list` | List monitors |
| `monitor run <id>` | Run a monitor |
| `signal list` | List signals |
| `init` | Initialize Invariance in the current project |
| `doctor` | Check CLI setup for issues |
| `version` | Print the CLI version |

All data commands support `--json` for machine-readable output.

## Configuration

The CLI reads configuration from (highest priority first):

1. **Environment variables**
   - `INVARIANCE_API_KEY` — API key
   - `INVARIANCE_BASE_URL` — API base URL (default: `https://api.invariance.ai`)

2. **Config file** at `~/.invariance/config.json`
   ```json
   {
     "apiKey": "inv_sk_...",
     "baseUrl": "https://api.invariance.ai"
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
