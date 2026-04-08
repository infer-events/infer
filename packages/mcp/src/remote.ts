import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";
import type { InferConfig } from "./config.js";

const API_ENDPOINT = "https://api.infer.events";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

/**
 * Extract and validate an Infer read API key from request headers.
 * Returns an InferConfig if valid, null otherwise.
 */
export function extractAuthConfig(headers: Headers): InferConfig | null {
  const auth = headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const apiKey = auth.slice("Bearer ".length).trim();
  if (!apiKey || !apiKey.startsWith("pk_read_")) return null;

  return { apiKey, endpoint: API_ENDPOINT };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Only handle /mcp path
    if (url.pathname !== "/mcp") {
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    }

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Extract auth
    const config = extractAuthConfig(request.headers);
    if (!config) {
      return new Response(
        JSON.stringify({
          error:
            'Missing or invalid API key. Pass a pk_read_* key in the Authorization header: "Bearer pk_read_..."',
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        },
      );
    }

    // Stateless: fresh server + transport per request.
    // CF Workers don't share module-level state across isolates,
    // so stateful sessions would silently break in production.
    const server = createServer(config);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return addCorsHeaders(response);
  },
};

function addCorsHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newResponse.headers.set(key, value);
  }
  return newResponse;
}
