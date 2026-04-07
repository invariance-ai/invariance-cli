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
 * Validate an API key by calling the whoami endpoint.
 */
export async function validateApiKey(
  apiKey: string,
  baseUrl: string,
): Promise<{ valid: boolean; error?: string }> {
  const client = new InvarianceClient({ apiKey, baseUrl });
  try {
    await client.whoami();
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
