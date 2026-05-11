import { Command } from "commander";
import { action, parseIntFlag, printPage, printValue } from "../../lib/cmd.js";
import type { GuardrailMode } from "../../types/index.js";

const COLUMNS = [
  { key: "slug", label: "Slug", width: 32 },
  { key: "title", label: "Title", width: 32 },
  { key: "domain", label: "Domain", width: 22 },
  { key: "default_mode", label: "Mode", width: 16 },
];

export const recipesCommand = new Command("recipes").description(
  "Browse built-in operational recipes and promote them into guardrails.",
);

recipesCommand.addCommand(
  action(
    new Command("list")
      .description(
        "List recipes. Output (--json): {data: Recipe[], next_cursor} where Recipe = {id, slug, title, domain, description, control, rule, default_mode, enabled, builtin, ...}",
      )
      .option("--limit <n>", "Page size", parseIntFlag)
      .option("--cursor <c>", "Opaque pagination token"),
    async ({ client, globals, opts }) => {
      const page = await client.listRecipes({
        cursor: opts.cursor as string | undefined,
        limit: opts.limit as number | undefined,
      });
      printPage(page, COLUMNS, globals);
    },
  ) as Command,
);

recipesCommand.addCommand(
  action(
    new Command("get")
      .description(
        "Show a recipe. Output (--json): full Recipe object including rule + control.",
      )
      .argument("<id-or-slug>"),
    async ({ client, globals, cmd }) => {
      printValue(await client.getRecipe(cmd.args[0]!), globals);
    },
  ) as Command,
);

recipesCommand.addCommand(
  action(
    new Command("enable")
      .description("Enable a recipe.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(
        await client.updateRecipe(cmd.args[0]!, { enabled: true }),
        globals,
      );
    },
  ) as Command,
);

recipesCommand.addCommand(
  action(
    new Command("disable")
      .description("Disable a recipe.")
      .argument("<id>"),
    async ({ client, globals, cmd }) => {
      printValue(
        await client.updateRecipe(cmd.args[0]!, { enabled: false }),
        globals,
      );
    },
  ) as Command,
);

recipesCommand.addCommand(
  action(
    new Command("set-mode")
      .description("Set the default mode for a recipe.")
      .argument("<id>")
      .requiredOption(
        "--mode <mode>",
        "suggested | shadow | active_monitor",
        (value: string) => {
          if (!["suggested", "shadow", "active_monitor"].includes(value)) {
            throw new Error("--mode must be one of: suggested, shadow, active_monitor");
          }
          return value;
        },
      ),
    async ({ client, globals, opts, cmd }) => {
      printValue(
        await client.updateRecipe(cmd.args[0]!, {
          default_mode: opts.mode as GuardrailMode,
        }),
        globals,
      );
    },
  ) as Command,
);

recipesCommand.addCommand(
  action(
    new Command("promote")
      .description(
        "Promote a recipe to a per-agent guardrail in the given status (default: shadow).",
      )
      .argument("<id-or-slug>")
      .option(
        "--status <status>",
        "suggested | accepted | shadow | active_monitor",
        "shadow",
      )
      .option("--title <title>", "Override guardrail title (defaults to recipe title)"),
    async ({ client, globals, opts, cmd }) => {
      const recipe = await client.getRecipe(cmd.args[0]!);
      const guardrail = await client.createGuardrail({
        recipe_id: recipe.id,
        title: (opts.title as string | undefined) ?? recipe.title,
        rule: recipe.rule,
        mode: recipe.default_mode,
        status: (opts.status as "suggested" | "accepted" | "shadow" | "active_monitor") ?? "shadow",
      });
      printValue(guardrail, globals);
    },
  ) as Command,
);
