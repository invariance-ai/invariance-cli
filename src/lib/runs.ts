import { NotFoundError } from "./errors.js";
import type { InvarianceClient } from "./client.js";

export const LATEST_ALIAS = "latest";

export async function resolveRunId(
  client: InvarianceClient,
  id: string,
): Promise<string> {
  if (id !== LATEST_ALIAS) return id;
  const page = await client.listRuns({ limit: 1 });
  const first = page.data[0];
  if (!first?.id) {
    throw new NotFoundError("Run", LATEST_ALIAS);
  }
  return first.id;
}
