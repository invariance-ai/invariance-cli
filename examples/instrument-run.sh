#!/usr/bin/env bash
# Minimal end-to-end run.
#   inv login          # one-time
#   bash examples/instrument-run.sh
set -euo pipefail

RUN=$(inv run start --name hello-invariance --json | jq -r .id)
echo "started run $RUN"

inv node write "$RUN" \
  --action-type tool_call \
  --input '{"who":"world"}' \
  --output '{"greeting":"Hello, world!"}' >/dev/null

inv node write "$RUN" \
  --action-type log \
  --input '{}' \
  --output '{"ok":true}' >/dev/null

inv run finish "$RUN" >/dev/null
echo "run finished — check the dashboard"
