import { resolveConfig } from "./config.js";
import { InvarianceClient } from "./client.js";
import { AuthenticationError } from "./errors.js";

/**
 * Get an authenticated client, throwing if no API key is configured.
 */
export function getAuthenticatedClient(profile?: string): InvarianceClient {
  const config = resolveConfig(profile);
  if (!config.apiKey) {
    throw new AuthenticationError(
      "No API key configured. Run `invariance auth login` or set INVARIANCE_API_KEY.",
    );
  }
  return new InvarianceClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });
}

/**
 * Get a client authenticated with the user's Supabase session token. Used for
 * user-scoped routes that the API key cannot reach (signup-bound endpoints,
 * agent CRUD, /v1/auth/me, /v1/auth/cli-token).
 */
export function getSessionClient(profile?: string): InvarianceClient {
  const config = resolveConfig(profile);
  if (!config.session?.access_token) {
    throw new AuthenticationError(
      "No user session. Run `inv auth signin` or `inv auth signup` first.",
    );
  }
  return new InvarianceClient({
    accessToken: config.session.access_token,
    baseUrl: config.baseUrl,
  });
}

/**
 * Validate an API key by calling the whoami endpoint.
 */
export async function validateApiKey(
  apiKey: string,
  baseUrl: string,
): Promise<{ valid: boolean; error?: string }> {
  const client = new InvarianceClient({ apiKey, baseUrl });
  try {
    await client.me();
    return { valid: true };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return { valid: false, error: "Invalid API key." };
    }
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
