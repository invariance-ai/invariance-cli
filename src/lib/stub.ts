import type { GlobalOptions } from "../types/index.js";

export interface StubError {
  error: {
    code: string;
    message: string;
    retryable: false;
    suggested_fix: string;
  };
}

/**
 * Emit a structured "API not available yet" error and exit with code 2.
 * Stubs use exit code 2 (vs 1 for real errors) so agents can branch on it.
 */
export function emitApiNotAvailable(
  command: string,
  globals: GlobalOptions,
  detail?: string,
): never {
  const payload: StubError = {
    error: {
      code: "API_NOT_AVAILABLE",
      message: `\`${command}\` is defined but the backend endpoint is not available yet${
        detail ? `: ${detail}` : "."
      }`,
      retryable: false,
      suggested_fix:
        "Track platform progress at https://invariance.ai/changelog or contact support@invariance.ai.",
    },
  };
  if (globals.json) {
    process.stdout.write(JSON.stringify(payload) + "\n");
  } else {
    process.stderr.write(
      `Error: ${payload.error.message}\n  fix: ${payload.error.suggested_fix}\n`,
    );
  }
  process.exit(2);
}
