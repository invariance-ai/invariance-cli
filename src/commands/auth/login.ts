import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { createInterface } from "node:readline";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { URL } from "node:url";
import { resolveConfig, saveApiKey } from "../../lib/config.js";
import { validateApiKey } from "../../lib/auth.js";
import { success } from "../../lib/output.js";
import { handleError } from "../../lib/errors.js";

interface LoopbackResult {
  token?: string;
  state?: string;
  error?: string;
}

const APPROVE_TIMEOUT_MS = 120_000;

async function promptForApiKey(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(chalk.bold("Enter your Invariance API key: "), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Derive the dashboard URL from the API base URL. Convention:
//   api.useinvariance.com → app.useinvariance.com
//   localhost:3001 (api)  → localhost:5173 (Vite)
// Override via INVARIANCE_DASHBOARD_URL.
export function dashboardBaseUrl(apiBaseUrl: string): string {
  if (process.env["INVARIANCE_DASHBOARD_URL"]) {
    return process.env["INVARIANCE_DASHBOARD_URL"]!.replace(/\/+$/, "");
  }
  try {
    const u = new URL(apiBaseUrl);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return `${u.protocol}//${u.hostname}:5173`;
    }
    if (u.hostname.startsWith("api.")) {
      u.hostname = "app." + u.hostname.slice(4);
      u.pathname = "";
      return u.toString().replace(/\/+$/, "");
    }
    return apiBaseUrl.replace(/\/+$/, "");
  } catch {
    return apiBaseUrl.replace(/\/+$/, "");
  }
}

function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd =
    platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  const args = platform === "win32" ? ["", url] : [url];
  const child = spawn(cmd, args, {
    detached: true,
    stdio: "ignore",
    shell: platform === "win32",
  });
  child.unref();
}

interface LoopbackServer {
  port: number;
  result: Promise<LoopbackResult>;
  close: () => void;
}

export function startLoopbackServer(expectedState: string): Promise<LoopbackServer> {
  return new Promise((resolve, reject) => {
    let resolveResult!: (r: LoopbackResult) => void;
    const result = new Promise<LoopbackResult>((r) => (resolveResult = r));

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (url.pathname !== "/") {
          res.statusCode = 404;
          res.end();
          return;
        }
        const token = url.searchParams.get("token") ?? undefined;
        const state = url.searchParams.get("state") ?? undefined;
        const error = url.searchParams.get("error") ?? undefined;

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        if (error) {
          res.end(renderHtml("Login cancelled", "You can close this tab and return to the terminal."));
        } else if (!token || state !== expectedState) {
          res.end(renderHtml("Login failed", "State mismatch — please try again."));
        } else {
          res.end(
            renderHtml(
              "You're signed in",
              "Invariance CLI is now authenticated. You can close this tab.",
            ),
          );
        }
        resolveResult({ token, state, error });
      } catch (e) {
        res.statusCode = 500;
        res.end("error");
        resolveResult({ error: (e as Error).message });
      }
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to bind loopback server"));
        return;
      }
      resolve({
        port: addr.port,
        result,
        close: () => server.close(),
      });
    });
  });
}

function renderHtml(title: string, subtitle: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invariance CLI</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0b0d10;color:#e6e8ec;
display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.card{text-align:center;max-width:28rem;padding:2rem}
h1{font-size:1.25rem;margin:0 0 0.5rem}
p{color:#9aa3af;font-size:0.9rem;margin:0}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:8px;vertical-align:middle}
</style></head><body><div class="card"><h1><span class="dot"></span>${title}</h1><p>${subtitle}</p></div></body></html>`;
}

async function browserLogin(opts: { apiBaseUrl: string; openBrowser: boolean }): Promise<string> {
  const state = randomBytes(32).toString("base64url");
  const { port, result, close } = await startLoopbackServer(state);

  const callback = `http://127.0.0.1:${port}`;
  const url = new URL(`${dashboardBaseUrl(opts.apiBaseUrl)}/cli/auth`);
  url.searchParams.set("callback", callback);
  url.searchParams.set("state", state);
  url.searchParams.set("hostname", hostname());

  const pretty = url.toString();
  if (opts.openBrowser) {
    console.error(chalk.dim("Opening your browser to sign in..."));
    console.error(chalk.dim(`If nothing happens, visit: ${pretty}`));
    openBrowser(pretty);
  } else {
    console.error(chalk.bold("Open this URL in your browser to sign in:"));
    console.error(pretty);
  }

  const spinner = ora("Waiting for approval in your browser...").start();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<LoopbackResult>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Timed out waiting for browser approval (2 minutes).")),
      APPROVE_TIMEOUT_MS,
    );
  });
  try {
    const r = await Promise.race([result, timeout]);
    if (timer) clearTimeout(timer);
    close();
    if (r.error) {
      spinner.fail("Login cancelled.");
      throw new Error("Login cancelled.");
    }
    if (!r.token || r.state !== state) {
      spinner.fail("Login failed: state mismatch.");
      throw new Error("State mismatch — possible CSRF. No token was saved.");
    }
    spinner.succeed("Approved in browser.");
    return r.token;
  } catch (e) {
    if (timer) clearTimeout(timer);
    close();
    spinner.stop();
    throw e;
  }
}

type LoginOptions = {
  apiKey?: string;
  profile?: string;
  browser?: boolean;
  open?: boolean;
};

async function runLogin(options: LoginOptions): Promise<void> {
  try {
    const config = resolveConfig(options.profile);
    let apiKey: string;

    if (options.apiKey) {
      apiKey = options.apiKey;
    } else if (options.browser) {
      apiKey = await browserLogin({
        apiBaseUrl: config.baseUrl,
        openBrowser: options.open !== false,
      });
    } else {
      apiKey = await promptForApiKey();
    }

    if (!apiKey) {
      console.error("Error: API key cannot be empty.");
      process.exit(1);
    }

    const spinner = ora("Validating API key...").start();
    const result = await validateApiKey(apiKey, config.baseUrl);
    if (!result.valid) {
      spinner.fail(`Validation failed: ${result.error}`);
      process.exit(1);
    }
    spinner.succeed("API key is valid.");

    saveApiKey(apiKey, options.profile);

    if (options.profile) {
      success(`Credentials saved to profile '${options.profile}'.`);
    } else {
      success("Credentials saved.");
    }

    console.error("");
    console.error(chalk.bold("Next steps:"));
    console.error("  " + chalk.cyan("invariance agent me") + "        Show who you're signed in as");
    console.error("  " + chalk.cyan("invariance run start --name demo") + "   Start a run");
    console.error("  " + chalk.cyan("invariance doctor") + "          Check your setup");
  } catch (error) {
    handleError(error);
  }
}

export function makeLoginCommand(name: string): Command {
  return new Command(name)
    .description("Authenticate with the Invariance API")
    .option("--api-key <key>", "Paste an API key directly")
    .option("--profile <name>", "Save credentials to a named profile")
    .option("--browser", "Open the browser to sign in (requires dashboard /cli/auth)")
    .option("--no-open", "With --browser, print the URL instead of auto-opening")
    .addHelpText(
      "after",
      `
Examples:
  $ invariance login
  $ invariance login --browser
  $ invariance login --profile staging
  $ invariance login --api-key inv_live_...

The browser flow opens your dashboard, where you approve this device and
the key is returned to a loopback listener (http://127.0.0.1:<random port>).
Falls back to a paste prompt when --browser is not set.`,
    )
    .action((options: LoginOptions) => runLogin(options));
}

export const loginCommand = makeLoginCommand("login");
