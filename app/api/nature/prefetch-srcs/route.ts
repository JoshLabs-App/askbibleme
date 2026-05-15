import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readNatureSettings } from "@/lib/nature/read-nature-settings";
import { pickNatureVideoPrefetchUrls } from "@/lib/nature/pick-nature-video-prefetch-urls";

export const dynamic = "force-dynamic";

/** 供前台 idle 预取：只返回前几条成片 URL，避免拉整份 `nature-settings.json`。 */
export async function GET(req: NextRequest) {
  try {
    const prefer1080 = req.nextUrl.searchParams.get("prefer1080") === "1";
    const s = await readNatureSettings(process.cwd());
    const urls = pickNatureVideoPrefetchUrls(s, 5, prefer1080);
    return NextResponse.json(
      { urls },
      { headers: { "Cache-Control": "private, no-store, must-revalidate" } },
    );
  } catch {
    return NextResponse.json({ urls: [] as string[] });
  }
}
