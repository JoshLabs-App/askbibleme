import { NextResponse } from "next/server";

const BASE = "https://api.youversion.com/v1";

/**
 * 只查用到的语言码（`language_ranges[]` 支持多值）。
 * 早先是 `language_ranges[]=*` 翻 60 页拉全部 5900 种语言，整个接口要几分钟，手机端直接超时。
 */
async function loadLanguageNames(key: string, codes: string[]) {
  const names = new Map<string, { zh: string; en: string }>();
  const wanted = [...new Set(codes.filter(Boolean))];
  for (let i = 0; i < wanted.length; i += 40) {
    const params = new URLSearchParams({ page_size: "99" });
    for (const code of wanted.slice(i, i + 40)) params.append("language_ranges[]", code);
    const response = await fetch(`${BASE}/languages?${params.toString()}`, {
      headers: { "X-YVP-App-Key": key, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) continue;
    const body = (await response.json()) as { data?: Array<Record<string, unknown>> };
    for (const item of body.data ?? []) {
      const code = String(item.language ?? item.id ?? "");
      const displayNames = (item.display_names as Record<string, unknown> | undefined) ?? {};
      const local = String((displayNames as Record<string, unknown>)[code] ?? item.name ?? "");
      const name = {
        zh: String(displayNames.zh ?? displayNames.en ?? local ?? code),
        en: String(displayNames.en ?? local ?? displayNames.zh ?? code),
      };
      // 别名（zh-CN / zh-Hans 之类）不覆盖已登记的主码：先到先得，否则简体条目会被繁体名字盖掉
      if (code && !names.has(code)) names.set(code, name);
      for (const alias of (item.aliases as unknown[] | undefined) ?? []) {
        const key = String(alias);
        if (key && !names.has(key)) names.set(key, name);
      }
    }
  }
  return names;
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
    const languageNames = await loadLanguageNames(key, translations.map((t) => String(t.language ?? "")));
    for (const item of translations) {
      const code = String(item.language ?? "");
      const name = languageNames.get(code);
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
