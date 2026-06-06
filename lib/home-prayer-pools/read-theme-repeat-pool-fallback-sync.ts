import fs from "node:fs";
import path from "node:path";
import type { AppLocale } from "@/lib/i18n/config";
import type { HomeVerseEntry } from "@/lib/i18n/home-verses";
import { normalizeVerseTextForHomeDisplay } from "@/lib/bible/normalize-verse-text-for-home-display";
import type { HomePrayerChunkV1, HomePrayerManifestV1 } from "@/lib/home-prayer-pools/types";
import {
  DEFAULT_THEME_REPEAT_MIN_COUNT,
  themeRepeatPoolScopeId,
} from "@/lib/scripture/theme-repeat-pool-scope-id";

const FALLBACK_KEY_LIMIT = 40;

function poolDir(cwd: string, scopeId: string): string {
  return path.join(cwd, "public", "data", "home-prayer-pools", scopeId);
}

function normalizeEntry(e: HomeVerseEntry): HomeVerseEntry {
  return {
    ref: normalizeVerseTextForHomeDisplay(e.ref) || e.ref.trim(),
    lines: e.lines.map((ln) => normalizeVerseTextForHomeDisplay(ln) || ln.trim()),
  };
}

/**
 * RSC / 池未就绪时：从已提交的 `theme-repeat-ge{N}` 静态 chunk 取 bootstrap 经文（与客户端祷告池同源）。
 */
export function readThemeRepeatPoolFallbackSync(
  cwd: string,
  locales: ReadonlyArray<AppLocale>,
  minCount: number = DEFAULT_THEME_REPEAT_MIN_COUNT,
): Record<AppLocale, HomeVerseEntry[]> {
  const want = new Set(locales);
  const empty: Record<AppLocale, HomeVerseEntry[]> = { "zh-CN": [], "zh-TW": [], en: [] };
  const scopeId = themeRepeatPoolScopeId(minCount);
  const manifestPath = path.join(poolDir(cwd, scopeId), "manifest.json");
  if (!fs.existsSync(manifestPath)) return empty;

  let manifest: HomePrayerManifestV1;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as HomePrayerManifestV1;
  } catch {
    return empty;
  }
  if (manifest.version !== 1 || !Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    return empty;
  }

  const bootstrap = manifest.bootstrapVerseKeys;
  const keys =
    bootstrap && bootstrap.length > 0
      ? bootstrap.slice(0, FALLBACK_KEY_LIMIT)
      : manifest.entries.slice(0, FALLBACK_KEY_LIMIT).map((e) => e.verseKey);

  const chunkCache = new Map<number, HomePrayerChunkV1>();
  const bodies = new Map<string, HomePrayerChunkV1["verses"][number]>();

  for (const key of keys) {
    if (bodies.has(key)) continue;
    const row = manifest.entries.find((e) => e.verseKey === key);
    if (!row) continue;
    const ci = row.chunkIndex;
    if (!chunkCache.has(ci)) {
      const chunkPath = path.join(poolDir(cwd, scopeId), `chunk-${ci}.json`);
      if (!fs.existsSync(chunkPath)) continue;
      try {
        chunkCache.set(ci, JSON.parse(fs.readFileSync(chunkPath, "utf8")) as HomePrayerChunkV1);
      } catch {
        continue;
      }
    }
    const verse = chunkCache.get(ci)?.verses.find((v) => v.verseKey === key);
    if (verse) bodies.set(key, verse);
  }

  const zh: HomeVerseEntry[] = [];
  const zhTw: HomeVerseEntry[] = [];
  const en: HomeVerseEntry[] = [];
  for (const key of keys) {
    const row = bodies.get(key);
    if (!row) continue;
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

  return { "zh-CN": zh, "zh-TW": zhTw.length ? zhTw : zh, en: en };
}
