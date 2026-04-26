/**
 * api-types contract test (CLI-001).
 *
 * Asserts that fixtures matching `@invariance/api-types` interfaces
 * parse cleanly through the CLI's hand-rolled Zod schemas in
 * `src/types/index.ts`. Drift produces a Zod error here in CI instead
 * of a runtime crash for users.
 *
 * Currently todo: needs `@invariance/api-types` installable as a workspace
 * dep (or a generated fixture committed to this repo).
 */
import { describe, it } from 'vitest';

describe('api-types contract: CLI Zod schemas', () => {
  it.todo('Run fixture conforming to @invariance/api-types parses through RunSchema');
  it.todo('Node fixture parses through NodeSchema');
  it.todo('Monitor fixture parses through MonitorSchema');
  it.todo('Signal fixture parses through SignalSchema');
  it.todo('Finding fixture parses through FindingSchema');
  it.todo('Review fixture parses through ReviewSchema');
  it.todo('Severity union matches platform Severity exactly');
});
