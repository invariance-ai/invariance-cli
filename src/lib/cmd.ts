import type { Command } from "commander";
import { getAuthenticatedClient } from "./auth.js";
import { handleError } from "./errors.js";
import { formatOutput, printTable } from "./output.js";
import type { GlobalOptions } from "../types/index.js";
import type { InvarianceClient } from "./client.js";

/** Wrap an async action with uniform global-option resolution + error handling. */
export function action<T = Record<string, any>>(
  cmd: Command,
  fn: (ctx: {
    client: InvarianceClient;
    globals: GlobalOptions;
    opts: T;
    cmd: Command;
  }) => Promise<void>,
): Command {
  cmd.action(async (...args: unknown[]) => {
    const innerCmd = args[args.length - 1] as Command;
    const opts = innerCmd.opts() as T;
    try {
      const globals = innerCmd.optsWithGlobals<GlobalOptions>();
      const client = getAuthenticatedClient(globals.profile);
      await fn({ client, globals, opts, cmd: innerCmd });
    } catch (error) {
      handleError(error);
    }
  });
  return cmd;
}

export function parseIntFlag(value: string): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) throw new Error(`Expected an integer, got "${value}"`);
  return n;
}

export function parseJsonFlag(name: string, value: string | undefined): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch (err) {
    throw new Error(`Invalid JSON in --${name}: ${(err as Error).message}`);
  }
}

export function printPage(
  page: { data: unknown[]; next_cursor?: string | null },
  columns: { key: string; label: string; width?: number }[],
  globals: GlobalOptions,
): void {
  if (globals.json) {
    formatOutput(page, { json: true });
    return;
  }
  printTable(page.data as Record<string, unknown>[], columns);
  if (page.next_cursor) {
    process.stdout.write(`\nnext_cursor: ${page.next_cursor}\n`);
  }
}

export function printValue(value: unknown, globals: GlobalOptions): void {
  formatOutput(value, { json: true });
  void globals;
}
