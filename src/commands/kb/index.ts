import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import { resolveConfig, resolveKbPath } from "../../lib/config.js";
import { getAuthenticatedClient } from "../../lib/auth.js";
import { handleError } from "../../lib/errors.js";
import { success, info, warn } from "../../lib/output.js";
import {
  initKb,
  requireKb,
  writeKbFile,
  listKbMarkdown,
} from "../../lib/kb/io.js";
import { upsertIndexEntry } from "../../lib/kb/index-file.js";
import { appendLog } from "../../lib/kb/log.js";
import { listSessions, readSession, deleteSession } from "../../lib/kb/sessions.js";
import type { GlobalOptions } from "../../types/index.js";

export const kbCommand = new Command("kb").description(
  "Manage the local knowledge base used by `invariance ask`",
);

// ── init ──
kbCommand.addCommand(
  new Command("init")
    .description("Scaffold a knowledge base at the configured path")
    .option("--path <dir>", "Override the KB path")
    .action((opts: { path?: string }, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<GlobalOptions>();
        const config = resolveConfig(globals.profile);
        const root = opts.path
          ? path.resolve(opts.path)
          : resolveKbPath(config.context);
        const result = initKb(root);
        success(`Initialized knowledge base at ${root}`);
        if (globals.json) {
          console.log(JSON.stringify({ root, ...result }, null, 2));
        } else {
          for (const p of result.created) info(`  + ${path.relative(root, p) || "."}`);
          for (const p of result.skipped) info(`  = ${path.relative(root, p) || "."} (exists)`);
        }
      } catch (error) {
        handleError(error);
      }
    }),
);

// ── path ──
kbCommand.addCommand(
  new Command("path")
    .description("Print the resolved knowledge base path")
    .action((_opts: Record<string, unknown>, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<GlobalOptions>();
        const config = resolveConfig(globals.profile);
        const root = resolveKbPath(config.context);
        console.log(root);
      } catch (error) {
        handleError(error);
      }
    }),
);

// ── ingest (local file/dir into raw/ + stub wiki page) ──
kbCommand.addCommand(
  new Command("ingest")
    .description("Copy a source file into raw/ and stub a wiki page")
    .argument("<source>", "Path to a markdown/text file")
    .option("--title <title>", "Title for the wiki page")
    .action((source: string, opts: { title?: string }, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<GlobalOptions>();
        const config = resolveConfig(globals.profile);
        const root = resolveKbPath(config.context);
        const paths = requireKb(root);

        const absSrc = path.resolve(source);
        if (!fs.existsSync(absSrc) || !fs.statSync(absSrc).isFile()) {
          throw new Error(`Not a file: ${source}`);
        }
        const base = path.basename(absSrc);
        const rawDest = path.join(paths.raw, base);
        fs.copyFileSync(absSrc, rawDest);

        const title = opts.title ?? base.replace(/\.[^.]+$/, "");
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const wikiRel = path.join("wiki", `${slug}.md`);
        const wikiContent = `# ${title}\n\n_Source: [\`raw/${base}\`](../raw/${base})_\n\n<!-- TODO: run \`invariance ask\` with ingest workflow to populate. -->\n`;
        writeKbFile(root, wikiRel, wikiContent);

        upsertIndexEntry(root, "Wiki", wikiRel, `(stub) ${title}`);
        appendLog(root, "ingest", title);

        success(`Ingested ${base} → ${wikiRel}`);
        info(`Next: run \`invariance ask\` and say "compile ${wikiRel}".`);
      } catch (error) {
        handleError(error);
      }
    }),
);

// ── ingest-run ──
kbCommand.addCommand(
  new Command("ingest-run")
    .description("Fetch a run from the Invariance API and write a wiki page for it")
    .argument("<runId>", "Run ID")
    .option("--with-narrative", "Also fetch the LLM narrative")
    .action(
      async (runId: string, opts: { withNarrative?: boolean }, cmd: Command) => {
        try {
          const globals = cmd.optsWithGlobals<GlobalOptions>();
          const config = resolveConfig(globals.profile);
          const root = resolveKbPath(config.context);
          requireKb(root);

          const client = getAuthenticatedClient(globals.profile);
          const spinner = ora(`Fetching run ${runId}`).start();
          const run = await client.getRun(runId);
          const nodes = await client.listRunNodes(runId).catch(() => ({ data: [] }));
          let narrative: unknown = null;
          if (opts.withNarrative) {
            try {
              narrative = await client.getRunNarrative(runId);
            } catch {
              /* narrative optional */
            }
          }
          spinner.succeed(`Fetched run ${runId}`);

          const rel = path.join("runs", `${runId}.md`);
          const lines: string[] = [];
          lines.push(`# Run \`${runId}\``);
          lines.push("");
          lines.push(`- **name**: ${run.name}`);
          lines.push(`- **status**: ${run.status}`);
          lines.push(`- **created**: ${run.created_at}`);
          if (run.closed_at) lines.push(`- **closed**: ${run.closed_at}`);
          if (run.total_cost_usd !== undefined)
            lines.push(`- **cost**: $${run.total_cost_usd.toFixed(4)}`);
          if (run.error_count !== undefined)
            lines.push(`- **errors**: ${run.error_count}`);
          lines.push("");
          lines.push("## Metadata");
          lines.push("```json");
          lines.push(JSON.stringify(run.metadata ?? {}, null, 2));
          lines.push("```");
          lines.push("");
          lines.push(`## Nodes (${nodes.data.length})`);
          for (const n of nodes.data.slice(0, 50)) {
            lines.push(`- \`${n.id}\` ${n.action_type}${n.type ? ` / ${n.type}` : ""}`);
          }
          if (nodes.data.length > 50) lines.push(`- …and ${nodes.data.length - 50} more`);
          if (narrative && typeof narrative === "object" && "narrative" in narrative) {
            lines.push("");
            lines.push("## Narrative");
            lines.push(String((narrative as { narrative: unknown }).narrative));
          }

          writeKbFile(root, rel, lines.join("\n") + "\n");
          upsertIndexEntry(
            root,
            "Runs",
            rel,
            `${run.status} · ${run.name} (${run.created_at.slice(0, 10)})`,
          );
          appendLog(root, "ingest-run", `${runId} (${run.name})`);

          success(`Wrote ${rel}`);
        } catch (error) {
          handleError(error);
        }
      },
    ),
);

// ── session ──
const sessionCmd = new Command("session").description("Inspect saved `ask` sessions");
sessionCmd.addCommand(
  new Command("list")
    .description("List saved sessions, newest first")
    .action((_opts: Record<string, unknown>, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<GlobalOptions>();
        const config = resolveConfig(globals.profile);
        const root = resolveKbPath(config.context);
        const sessions = listSessions(root);
        if (globals.json) {
          console.log(JSON.stringify(sessions, null, 2));
          return;
        }
        if (sessions.length === 0) {
          warn("No sessions saved.");
          return;
        }
        for (const s of sessions) {
          console.log(`${s.id}  ${s.updated_at}  ${s.title ?? ""}`);
        }
      } catch (error) {
        handleError(error);
      }
    }),
);
sessionCmd.addCommand(
  new Command("show")
    .description("Print a session transcript")
    .argument("<id>", "Session ID")
    .action((id: string, _opts: Record<string, unknown>, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<GlobalOptions>();
        const config = resolveConfig(globals.profile);
        const root = resolveKbPath(config.context);
        const msgs = readSession(root, id);
        if (globals.json) {
          console.log(JSON.stringify(msgs, null, 2));
          return;
        }
        for (const m of msgs) {
          const body =
            typeof m.content === "string"
              ? m.content
              : JSON.stringify(m.content);
          console.log(`\n── ${m.role} @ ${m.timestamp} ──\n${body}`);
        }
      } catch (error) {
        handleError(error);
      }
    }),
);
sessionCmd.addCommand(
  new Command("delete")
    .description("Delete a saved session")
    .argument("<id>", "Session ID")
    .action((id: string, _opts: Record<string, unknown>, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<GlobalOptions>();
        const config = resolveConfig(globals.profile);
        const root = resolveKbPath(config.context);
        const ok = deleteSession(root, id);
        if (ok) success(`Deleted session ${id}`);
        else warn(`No session ${id}`);
      } catch (error) {
        handleError(error);
      }
    }),
);
kbCommand.addCommand(sessionCmd);

// ── lint (stub: flag orphan files not in index.md) ──
kbCommand.addCommand(
  new Command("lint")
    .description("Flag orphan pages and basic KB hygiene issues")
    .action((_opts: Record<string, unknown>, cmd: Command) => {
      try {
        const globals = cmd.optsWithGlobals<GlobalOptions>();
        const config = resolveConfig(globals.profile);
        const root = resolveKbPath(config.context);
        const paths = requireKb(root);
        const all = listKbMarkdown(root).filter(
          (p) => p !== "index.md" && p !== "log.md" && p !== "AGENTS.md",
        );
        const index = fs.readFileSync(paths.index, "utf-8");
        const orphans = all.filter((p) => !index.includes(`\`${p}\``));
        if (globals.json) {
          console.log(JSON.stringify({ orphans }, null, 2));
          return;
        }
        if (orphans.length === 0) {
          success("No orphan pages.");
        } else {
          warn(`${orphans.length} orphan page(s) not referenced in index.md:`);
          for (const o of orphans) console.log(`  - ${o}`);
        }
      } catch (error) {
        handleError(error);
      }
    }),
);
