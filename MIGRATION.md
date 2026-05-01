# SDK Adoption Migration

## Why

`invariance-cli/src/lib/client.ts` (449 LOC) hand-rolls a Zod-validated HTTP wrapper that duplicates `@invariance/sdk`. The SDK is healthier (battle-tested retry policy, parity with the Python SDK, identical config resolution) and the CLI should consume it.

## Status

Deferred — needs per-command-group migration with test verification at each step. Tracked here so the next session can pick up cleanly without re-discovering the surface.

## Method-by-method mapping

| CLI method (`InvarianceClient`) | SDK call (`Invariance.init({...})`) |
| --- | --- |
| `me()` | `agents.me()` |
| `listAgents(projectId)` | `agents.list({ project_id })` |
| `getAgent(id)` | `agents.get(id)` |
| `rotateAgentKey(pk)` | `agents.rotateKey(pk)` |
| `startRun(input)` | `runs.start(input)` |
| `listRuns(opts)` | `runs.list(opts)` |
| `getRun(id)` | `runs.get(id)` |
| `updateRun(id, patch)` | `runs.update(id, patch)` |
| `forkRun(id, fromNodeId)` | `runs.fork(id, { from_node_id })` |
| `runMetrics(id)` | `runs.metrics(id)` |
| `runLlmCalls(id, opts)` | `runs.llmCalls(id, opts)` |
| `verifyRun(id)` | `runs.verify(id)` |
| `getRunNarrative(id, refresh)` | `narratives.getForRun(id, { refresh })` |
| `listRunNodes(id, opts)` | `nodes.listForRun(id, opts)` |
| `writeNodes(runId, events)` | `nodes.write(runId, events)` |
| `createMonitor(body)` | `monitors.create(body)` |
| `listMonitors(opts)` | `monitors.list(opts)` |
| `getMonitor(id)` | `monitors.get(id)` |
| `updateMonitor(id, patch)` | `monitors.update(id, patch)` |
| `deleteMonitor(id)` | `monitors.delete(id)` |
| `evaluateMonitor(id, body)` | `monitors.evaluate(id, body)` |
| `monitorExecutions(id, opts)` | `monitors.executions(id, opts)` |
| `monitorFindings(id, opts)` | `monitors.findings(id, opts)` |
| `emitSignal(input)` | `signals.emit(input)` |
| `listSignals(opts)` | `signals.list(opts)` |
| `getSignal(id)` | `signals.get(id)` |
| `ackSignal(id)` | `signals.acknowledge(id)` |
| `resolveSignal(id)` | `signals.resolve(id)` |
| `listFindings(opts)` | `findings.list(opts)` |
| `getFinding(id)` | `findings.get(id)` |
| `updateFinding(id, status)` | `findings.update(id, { status })` |
| `listReviews(opts)` | `reviews.list(opts)` |
| `getReview(id)` | `reviews.get(id)` |
| `patchReview(id, body)` | `reviews.update(id, body)` |
| `claimReview(id, notes?)` | `reviews.claim(id, notes)` |
| `unclaimReview(id, notes?)` | `reviews.unclaim(id, notes)` |
| `resolveReview(id, decision, notes?)` | `reviews.resolve(id, decision, notes)` |
| `metricsOverview(params)` | `runs.metricsOverview(params)` |

Verify each with the SDK source (`invariance-typescript/src/resources/`). Three need confirmation: `runMetrics` / `runLlmCalls` / `metricsOverview` may not have direct SDK equivalents — file an issue against `invariance-typescript` and add them before deleting CLI methods.

## Order

1. Add `@invariance/sdk` as a dependency. Don't remove the local `InvarianceClient` yet.
2. Migrate one command group at a time: `agent` → `run` → `node` → `monitor` → `signal` → `finding` → `review` → `metrics`. Each PR runs `pnpm test` clean before merge.
3. Reconcile error mapping. SDK throws `InvarianceApiError` / `RateLimitError`; CLI throws `ApiError` / `AuthenticationError` / `NetworkError` / `NotFoundError`. Build a tiny `mapSdkError()` shim in `src/lib/errors.ts` so command-level exit codes don't change.
4. After all 8 groups migrated, delete `src/lib/client.ts` and the unused Zod schemas from `src/types/index.ts`.
5. Rewrite the ~6 tests that currently mock `InvarianceClient` directly to mock the SDK's `HttpClient` (or use a fixture server).

## Risk notes

- The SDK's `runs.update()` accepts a typed patch; CLI's `updateRun()` accepts `Record<string, unknown>`. Validate that all CLI patch payloads match the SDK's expected shape.
- `patchReview` returns either `{ review }` or the bare review depending on the API version (see `client.ts:394-405`). Verify the SDK normalizes this.
- The CLI sets `User-Agent: invariance-cli`. The SDK sets its own; pass through `HttpClientOptions.userAgent` (or whatever the SDK exposes) to preserve telemetry.
