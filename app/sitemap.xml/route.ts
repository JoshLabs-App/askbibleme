import { buildSitemapXml } from "@/lib/ai/askbible-ai-docs.mjs";
import { PRODUCT_ORIGIN } from "@/lib/ai/askbible-ai-catalog.mjs";

export async function GET() {
  return new Response(buildSitemapXml(PRODUCT_ORIGIN), {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
