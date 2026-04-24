# Changelog

All notable changes to `@invariance/cli` are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-04-24

Initial MVP release.

### Added

- `login` / `logout` / `auth whoami` — browser and paste-key auth flows.
- `config get` / `set` — named profile support.
- `run start` / `list` / `get` / `update` / `cancel` / `fork` — run lifecycle.
- `run metrics` / `verify` / `narrative` / `llm-calls` / `nodes` — run introspection.
- `node write` / `list` / `tail` — trace node emission and streaming.
- `monitor create` / `list` / `get` / `update` / `pause` / `resume` / `evaluate` — monitor CRUD and control.
- `monitor executions` / `findings` — monitor output inspection.
- `signal emit` / `list` / `get` / `ack` / `resolve` — alert lifecycle.
- `finding list` / `get` / `update` — investigation records.
- `review list` / `get` / `claim` / `unclaim` / `resolve` — resolution workflow.
- `agent me` / `set-key` — identity + key registration.
- `metrics overview` — cross-run aggregate metrics.
- `completions <shell>` — shell completion scripts.
- `doctor` — setup diagnostics.
- `--json`, `--profile`, `--no-color` global flags.
