#!/usr/bin/env bash
# Minimal end-to-end run.
#   invariance login          # one-time
#   bash examples/instrument-run.sh
set -euo pipefail

RUN=$(invariance run start --name hello-invariance --json | jq -r .id)
echo "started run $RUN"

invariance node write "$RUN" \
  --action-type tool_call \
  --input '{"who":"world"}' \
  --output '{"greeting":"Hello, world!"}' >/dev/null

invariance node write "$RUN" \
  --action-type log \
  --input '{}' \
  --output '{"ok":true}' >/dev/null

invariance run update "$RUN" --status completed >/dev/null
echo "run finished — check the dashboard"
