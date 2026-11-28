import { buildMcpDiscoveryJson } from "@/lib/ai/askbible-ai-docs.mjs";
import { PRODUCT_ORIGIN } from "@/lib/ai/askbible-ai-catalog.mjs";
import { handleMcpJsonRpc } from "@/lib/ai/askbible-mcp-core.mjs";
import { createWebMcpProvider } from "@/lib/ai/web-mcp-provider";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Accept",
};

function resolveOrigin(request: Request): string {
  const url = new URL(request.url);
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" ? url.origin : PRODUCT_ORIGIN;
}

function extractBearerToken(request: Request): string | null {
  const raw = request.headers.get("authorization") || "";
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m && m[1].trim() ? m[1].trim() : null;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  return new Response(JSON.stringify(buildMcpDiscoveryJson(resolveOrigin(request)), null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
      {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
      },
    );
  }

  const origin = resolveOrigin(request);
  const authToken = extractBearerToken(request);
  const provider = createWebMcpProvider();

  if (Array.isArray(body)) {
    const results = (
      await Promise.all(body.map((item) => handleMcpJsonRpc(item, { provider, origin, authToken })))
    ).filter((r) => r !== null);
    if (results.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS });
    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS_HEADERS },
    });
  }

  const result = await handleMcpJsonRpc(body, { provider, origin, authToken });
  if (result === null) {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS_HEADERS },
  });
}
