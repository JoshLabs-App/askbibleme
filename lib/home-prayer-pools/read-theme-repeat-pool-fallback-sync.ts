import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { normalizeVerseTextForHomeDisplay } from "@/lib/bible/normalize-verse-text-for-home-display";
import type { HomePrayerChunkV1 } from "@/lib/home-prayer-pools/types";
import { EXPLORE_CURATED_700_POOL_SCOPE_ID } from "@/lib/scripture/explore-curated-pool-scope-id";
import generatedBootstrap from "@/lib/generated/home-verse-bootstrap.json";

function normalizeEntry(e: HomeVerseEntry): HomeVerseEntry {
  return {
    ref: normalizeVerseTextForHomeDisplay(e.ref) || e.ref.trim(),
    lines: e.lines.map((ln) => normalizeVerseTextForHomeDisplay(ln) || ln.trim()),
  };
}

/**
 * RSC / 池未就绪时：从构建期抽取的 bootstrap 经文取首屏兜底（与客户端祷告池同源，零 fs）。
 */
export function readThemeRepeatPoolFallbackSync(
  _cwd: string,
  locales: ReadonlyArray<AppLocale>,
  scopeId: string = EXPLORE_CURATED_700_POOL_SCOPE_ID,
): Record<AppLocale, HomeVerseEntry[]> {
  const want = new Set(locales);
  const rows = (generatedBootstrap as Record<string, HomePrayerChunkV1["verses"]>)[scopeId] ?? [];

  const zh: HomeVerseEntry[] = [];
  const zhTw: HomeVerseEntry[] = [];
  const en: HomeVerseEntry[] = [];
  for (const row of rows) {
    if (want.has("zh-CN") && row.locales["zh-CN"]?.lines?.length) {
      zh.push(normalizeEntry(row.locales["zh-CN"]));
    }
    if (want.has("zh-TW") && row.locales["zh-TW"]?.lines?.length) {
      zhTw.push(normalizeEntry(row.locales["zh-TW"]));
    } else if (want.has("zh-TW") && row.locales["zh-CN"]?.lines?.length) {
      zhTw.push(normalizeEntry(row.locales["zh-CN"]));
    }
    if (want.has("en") && row.locales.en?.lines?.length) {
      en.push(normalizeEntry(row.locales.en));
    }
  }
  return { "zh-CN": zh, "zh-TW": zhTw, en };
}
