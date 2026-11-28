import { buildLlmsTxt } from "@/lib/ai/askbible-ai-docs.mjs";
import { PRODUCT_ORIGIN } from "@/lib/ai/askbible-ai-catalog.mjs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.hostname === "localhost" || url.hostname === "127.0.0.1" ? url.origin : PRODUCT_ORIGIN;
  return new Response(buildLlmsTxt(origin), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
