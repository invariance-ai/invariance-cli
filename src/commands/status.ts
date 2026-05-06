import { Command } from "commander";
import { action, printValue } from "../lib/cmd.js";

/**
 * `inv status` — single-shot health/identity check for agents.
 * Combines `auth whoami` + base URL into one machine-readable response.
 */
export const statusCommand = action(
  new Command("status").description(
    "Show CLI auth + connectivity status. Output (--json): {ok, agent_id, project_id, base_url, api_key_prefix}",
  ),
  async ({ client, globals }) => {
    const me = await client.me();
    printValue(
      {
        ok: true,
        agent_id: me.agent.id,
        project_id: me.agent.project_id,
        base_url: client.baseUrl,
        api_key_prefix: me.api_key?.prefix ?? null,
      },
      globals,
    );
  },
) as Command;
