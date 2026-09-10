import { NextResponse } from "next/server";

import languageNamesData from "@/data/youversion-language-names.json";

const BASE = "https://api.youversion.com/v1";

const LANGUAGE_NAMES = languageNamesData.names as Record<string, { zh: string; en: string }>;

/**
 * 语言名走仓库里的静态表（tools/gen-language-names.mjs 生成）。
 * 上游 /languages 不认 language_ranges[] 过滤（照样返回第一页全量），线上现抓要翻 60 页，
 * 早先那版因此把语言名退化成了语言码本身。
 */
function languageName(code: string) {
  const direct = LANGUAGE_NAMES[code];
  if (direct) return direct;
  const base = code.split("-")[0];
  return LANGUAGE_NAMES[base];
}

/** 进程内缓存：Vercel 实例热着时后续请求直接返回（目录一天也不会变一次） */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cached: { at: number; payload: unknown } | null = null;

export async function GET() {
  const key = process.env.YVP_APP_KEY?.trim();
  if (!key) return NextResponse.json({ ok: false, error: "youversion_not_configured", translations: [] }, { status: 503 });
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  }

  try {
    const translations: Array<Record<string, unknown>> = [];
    let nextPageToken = "";
    for (let page = 0; page < 100; page += 1) {
      const params = new URLSearchParams();
      params.append("language_ranges[]", "*");
      if (nextPageToken) params.set("page_token", nextPageToken);
      const response = await fetch(`${BASE}/bibles?${params.toString()}`, {
        headers: { "X-YVP-App-Key": key, Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        // 上游限流 / 抽风时，宁可给一份过期的目录，也不要让 App 拿到空表
        if (cached) return NextResponse.json(cached.payload, { headers: { "Cache-Control": "public, s-maxage=600" } });
        return NextResponse.json({ ok: false, error: `youversion_http_${response.status}`, translations: [] }, { status: 502 });
      }
      const body = (await response.json()) as { data?: Array<Record<string, unknown>>; next_page_token?: string };
      translations.push(...(body.data ?? []).map((item) => {
        const language = (item.language as Record<string, unknown> | undefined) ?? {};
        return {
          id: String(item.id ?? ""),
          labelZh: String(item.localized_title ?? item.title ?? item.name ?? item.abbreviation ?? ""),
          labelEn: String(item.title ?? item.name ?? item.abbreviation ?? ""),
          language: String(language.iso_639_1 ?? language.code ?? item.language_tag ?? "und"),
          /** bible.com 页面缩写（抓音频页用；平台接口不给音频，见 lib/bible/youversion-chapter-audio.ts） */
          abbreviation: String(item.abbreviation ?? item.localized_abbreviation ?? ""),
          provider: "youversion",
          remoteId: String(item.id ?? ""),
          enabled: true,
          copyright: typeof item.copyright === "string" ? item.copyright : null,
          deepLink: String(item.youversion_deep_link ?? ""),
        };
      }));
      nextPageToken = String(body.next_page_token ?? "");
      if (!nextPageToken) break;
    }
    for (const item of translations) {
      const code = String(item.language ?? "");
      const name = languageName(code);
      // languageName 保留旧字段名（老客户端在读）；新增中英两份供 App 按界面语言显示
      item.languageName = name?.zh ?? code;
      item.languageNameZh = name?.zh ?? code;
      item.languageNameEn = name?.en ?? code;
    }
    const filtered = translations.filter((item) => item.id && item.language && item.language !== "und");
    const payload = { ok: true, translations: filtered };
    cached = { at: Date.now(), payload };
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } });
  } catch {
    if (cached) return NextResponse.json(cached.payload, { headers: { "Cache-Control": "public, s-maxage=600" } });
    return NextResponse.json({ ok: false, error: "youversion_request_failed", translations: [] }, { status: 502 });
  }
}
