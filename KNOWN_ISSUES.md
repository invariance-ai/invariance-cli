# Known Issues — invariance-cli

Seeded from the 2026-04-25 cross-repo audit.

| ID | Severity | Title | Test | Status |
|----|----------|-------|------|--------|
| CLI-001 | high | Hand-rolled Zod schemas not pinned to `@invariance/api-types` (drift caught only at runtime) | `src/__tests__/api-types-contract.test.ts` | open |
| CLI-002 | low | `node tail` command has no automated test | `src/__tests__/node-tail.test.ts` | open |

## Item details

### CLI-001 — Schemas not pinned to `@invariance/api-types`
`src/types/index.ts` (~280 LOC) hand-defines Zod schemas for ~20 endpoint response types (`Me`, `Run`, `Node`, `Monitor`, `Signal`, `Finding`, `Review`, `Narrative`, `Agent`, …). No code generation, no shared dependency. Drift is caught only at runtime when Zod parse throws.

Fix: either generate the Zod schemas from `@invariance/api-types` at build time, or assert structural equivalence in CI. This PR adds a stub for the latter.

### CLI-002 — `node tail` is untested
The subcommand is wired but has no Vitest coverage. Other node subcommands (`write`, `list`) are tested. This PR adds a stub.
