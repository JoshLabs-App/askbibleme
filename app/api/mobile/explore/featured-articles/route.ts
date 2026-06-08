import { NextResponse } from "next/server";
import { readExploreFeaturedArticlesBundleSync } from "@/lib/explore/explore-featured-articles-bundle-store";

export const runtime = "nodejs";

export async function GET() {
  const bundle = readExploreFeaturedArticlesBundleSync(process.cwd());
  if (!bundle) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const etag = bundle.contentVersion?.trim() || `v${bundle.articles.length}`;
  return NextResponse.json(bundle, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      ETag: `"${etag}"`,
    },
  });
}
