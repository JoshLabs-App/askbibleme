import { NextResponse } from "next/server";

const BASE = "https://api.youversion.com/v1";

async function loadLanguageNames(key: string) {
  const names = new Map<string, string>();
  let token = "";
  for (let page = 0; page < 100; page += 1) {
    const params = new URLSearchParams({ "language_ranges[]": "*", page_size: "99" });
    if (token) params.set("page_token", token);
    const response = await fetch(`${BASE}/languages?${params.toString()}`, {
      headers: { "X-YVP-App-Key": key, Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) break;
    const body = (await response.json()) as { data?: Array<Record<string, unknown>>; next_page_token?: string };
    for (const item of body.data ?? []) {
      const code = String(item.language ?? item.id ?? "");
      const displayNames = (item.display_names as Record<string, unknown> | undefined) ?? {};
      const name = String(displayNames.zh ?? displayNames.en ?? code);
      if (code) names.set(code, name);
      for (const alias of (item.aliases as unknown[] | undefined) ?? []) names.set(String(alias), name);
    }
    token = String(body.next_page_token ?? "");
    if (!token) break;
  }
  return names;
}

export async function GET() {
  const key = process.env.YVP_APP_KEY?.trim();
  if (!key) return NextResponse.json({ ok: false, error: "youversion_not_configured", translations: [] }, { status: 503 });

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
      if (!response.ok) return NextResponse.json({ ok: false, error: `youversion_http_${response.status}`, translations: [] }, { status: 502 });
      const body = (await response.json()) as { data?: Array<Record<string, unknown>>; next_page_token?: string };
      translations.push(...(body.data ?? []).map((item) => {
        const language = (item.language as Record<string, unknown> | undefined) ?? {};
        return {
          id: String(item.id ?? ""),
          labelZh: String(item.localized_title ?? item.title ?? item.name ?? item.abbreviation ?? ""),
          labelEn: String(item.title ?? item.name ?? item.abbreviation ?? ""),
          language: String(language.iso_639_1 ?? language.code ?? item.language_tag ?? "und"),
          provider: "youversion",
          remoteId: String(item.id ?? ""),
          enabled: true,
          copyright: item.copyright ?? null,
        };
      }));
      nextPageToken = String(body.next_page_token ?? "");
      if (!nextPageToken) break;
    }
    const languageNames = await loadLanguageNames(key);
    for (const item of translations) {
      const code = String(item.language ?? "");
      item.languageName = languageNames.get(code) ?? code;
    }
    const filtered = translations.filter((item) => item.id && item.language && item.language !== "und");
    return NextResponse.json({ ok: true, translations: filtered }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ ok: false, error: "youversion_request_failed", translations: [] }, { status: 502 });
  }
}
