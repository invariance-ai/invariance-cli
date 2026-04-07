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

export function handleError(error: unknown): never {
  if (error instanceof InvarianceError) {
    if (process.env["DEBUG"]) {
      console.error(error.stack);
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }

  if (error instanceof Error) {
    console.error(`Unexpected error: ${error.message}`);
    if (process.env["DEBUG"]) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  console.error("An unknown error occurred.");
  process.exit(1);
}
