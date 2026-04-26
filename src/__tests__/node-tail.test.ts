/**
 * `invariance node tail` tests (CLI-002).
 *
 * Currently todo. The other node subcommands (write, list) have coverage;
 * tail does not.
 */
import { describe, it } from 'vitest';

describe('invariance node tail', () => {
  it.todo('streams events for a given run id');
  it.todo('exits cleanly on SIGINT after at least one batch');
  it.todo('respects --json flag (one event per line, valid JSON)');
  it.todo('errors clearly when run id is unknown');
});
