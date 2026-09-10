import { NextResponse } from "next/server";

/**
 * 某个 YouVersion 版本的书卷名（该版本自己的语言）。
 *
 * 上游 `/bibles/{id}/books` 会把每章每节的 id 都带上（几百 KB），这里只留 App 要的四个字段，
 * 手机端拿到的是几 KB。进程内缓存 6 小时 + CDN 缓存：书卷名基本不变，别为每次开目录页打一次上游。
 */
export const dynamic = "force-dynamic";

const BASE = "https://api.youversion.com/v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; payload: unknown }>();

export async function GET(request: Request) {
  const key = process.env.YVP_APP_KEY?.trim();
  if (!key) return NextResponse.json({ ok: false, error: "youversion_not_configured", books: [] }, { status: 503 });

  const versionId = (new URL(request.url).searchParams.get("versionId") ?? "").trim();
  if (!/^\d{1,7}$/.test(versionId)) {
    return NextResponse.json({ ok: false, error: "invalid_version_id", books: [] }, { status: 400 });
  }

  const hit = cache.get(versionId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.payload, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  }

  try {
    const response = await fetch(`${BASE}/bibles/${versionId}/books`, {
      headers: { "X-YVP-App-Key": key, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      if (hit) return NextResponse.json(hit.payload, { headers: { "Cache-Control": "public, s-maxage=600" } });
      return NextResponse.json({ ok: false, error: `youversion_http_${response.status}`, books: [] }, { status: 502 });
    }
    const body = (await response.json()) as { data?: Array<Record<string, unknown>> };
    const books = (body.data ?? [])
      .map((b) => ({
        id: String(b.id ?? "").trim().toUpperCase(),
        title: String(b.title ?? b.full_title ?? "").trim(),
        abbreviation: String(b.abbreviation ?? "").trim(),
        chapters: Array.isArray(b.chapters) ? b.chapters.length : 0,
      }))
      .filter((b) => b.id && b.title);
    if (!books.length) return NextResponse.json({ ok: false, error: "books_unavailable", books: [] }, { status: 404 });
    const payload = { ok: true, versionId, books };
    cache.set(versionId, { at: Date.now(), payload });
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch {
    if (hit) return NextResponse.json(hit.payload, { headers: { "Cache-Control": "public, s-maxage=600" } });
    return NextResponse.json({ ok: false, error: "youversion_request_failed", books: [] }, { status: 502 });
  }
}
