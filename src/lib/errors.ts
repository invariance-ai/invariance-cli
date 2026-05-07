import { isJsonMode } from "./runtime.js";

export class InvarianceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "InvarianceError";
  }
}

export class AuthenticationError extends InvarianceError {
  constructor(message = "Authentication failed. Run `invariance auth login` to configure your API key.") {
    super(message, "AUTH_ERROR", 401);
    this.name = "AuthenticationError";
  }
}

export class NotFoundError extends InvarianceError {
  constructor(resource: string, id: string) {
    super(`${resource} '${id}' not found.`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class ApiError extends InvarianceError {
  constructor(
    message: string,
    statusCode: number,
    public readonly body?: unknown,
  ) {
    super(message, "API_ERROR", statusCode);
    this.name = "ApiError";
  }
}

export class ConfigError extends InvarianceError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class NetworkError extends InvarianceError {
  constructor(message = "Unable to reach the Invariance API. Check your network connection.") {
    super(message, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

interface StructuredErrorPayload {
  error: {
    code: string;
    message: string;
    status_code?: number;
  };
}

function emitStructured(error: InvarianceError | Error): void {
  const code =
    error instanceof InvarianceError ? error.code : "UNEXPECTED_ERROR";
  const payload: StructuredErrorPayload = {
    error: { code, message: error.message },
  };
  if (error instanceof InvarianceError && error.statusCode !== undefined) {
    payload.error.status_code = error.statusCode;
  }
  process.stderr.write(JSON.stringify(payload) + "\n");
}

export function handleError(error: unknown): never {
  const json = isJsonMode();

  if (error instanceof InvarianceError) {
    if (json) {
      emitStructured(error);
    } else if (process.env["DEBUG"]) {
      console.error(error.stack);
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }

  if (error instanceof Error) {
    if (json) {
      emitStructured(error);
    } else {
      console.error(`Unexpected error: ${error.message}`);
      if (process.env["DEBUG"]) {
        console.error(error.stack);
      }
    }
    process.exit(1);
  }

  if (json) {
    process.stderr.write(
      JSON.stringify({
        error: { code: "UNKNOWN_ERROR", message: "An unknown error occurred." },
      }) + "\n",
    );
  } else {
    console.error("An unknown error occurred.");
  }
  process.exit(1);
}
