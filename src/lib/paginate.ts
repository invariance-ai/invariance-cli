import type { InvarianceClient } from "./client.js";

/**
 * Cursor-walk helper: repeatedly calls a list endpoint until no next_cursor
 * remains. Used by `--all` flags on list commands.
 */
export async function paginate<T>(
  fetchPage: (
    cursor: string | undefined,
  ) => Promise<{ data: T[]; next_cursor?: string | null }>,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    all.push(...page.data);
    cursor = page.next_cursor ?? undefined;
  } while (cursor);
  return all;
}

// Re-export type for callers wanting it
export type { InvarianceClient };
