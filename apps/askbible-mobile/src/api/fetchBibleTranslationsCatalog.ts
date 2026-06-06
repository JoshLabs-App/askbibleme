import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { BUNDLED_SCRIPTURE_TRANSLATION_IDS } from "../bible/bundled-scripture-translations";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "../bible/translations-types";

const CATALOG_CACHE_KEY = "askbible.mobile.bible-translations-catalog.v1";
const CATALOG_CACHE_TTL_MS = 60_000;

const OFFLINE_BUNDLED_INDEX: BibleTranslationsIndex = {
  translations: [
    {
      id: "cuv-simp",
      labelZh: "和合本（简体）",
      labelEn: "Chinese Union Version (Simplified)",
      language: "zh-Hans",
      bundled: true,
    },
    {
      id: "cuv-trad",
      labelZh: "和合本（繁體）",
      labelEn: "Chinese Union Version (Traditional)",
      language: "zh-Hant",
      bundled: true,
    },
    {
      id: "web-en",
      labelZh: "WEB 英译本",
      labelEn: "World English Bible",
      language: "en",
      bundled: true,
    },
  ],
  defaultTranslationId: "cuv-simp",
};

type CachedCatalog = {
  fetchedAt: number;
  index: BibleTranslationsIndex;
};

function isCatalogShape(raw: unknown): raw is BibleTranslationsIndex {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.translations);
}

function normalizeCatalog(raw: unknown): BibleTranslationsIndex | null {
  if (!isCatalogShape(raw)) return null;
  const translations = raw.translations
    .filter((t): t is BibleTranslationMeta => Boolean(t?.id))
    .map((t) => ({
      id: String(t.id).trim(),
      labelZh: String(t.labelZh || "").trim(),
      labelEn: String(t.labelEn || "").trim(),
      language: String(t.language || "").trim(),
      bundled: Boolean(t.bundled) || (BUNDLED_SCRIPTURE_TRANSLATION_IDS as readonly string[]).includes(t.id),
      bytes: typeof t.bytes === "number" && t.bytes >= 0 ? t.bytes : undefined,
      downloadUrl: typeof t.downloadUrl === "string" ? t.downloadUrl : t.downloadUrl === null ? null : undefined,
    }))
    .filter((t) => Boolean(t.id));
  const defaultTranslationId =
    typeof raw.defaultTranslationId === "string" && raw.defaultTranslationId.trim()
      ? raw.defaultTranslationId.trim()
      : null;
  return {
    translations,
    defaultTranslationId:
      defaultTranslationId && translations.some((t) => t.id === defaultTranslationId)
        ? defaultTranslationId
        : translations[0]?.id ?? "cuv-simp",
  };
}

async function readCachedCatalog(): Promise<BibleTranslationsIndex | null> {
  try {
    const raw = (await AsyncStorage.getItem(CATALOG_CACHE_KEY))?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    if (!parsed?.index || Date.now() - parsed.fetchedAt > CATALOG_CACHE_TTL_MS) return null;
    return normalizeCatalog(parsed.index);
  } catch {
    return null;
  }
}

async function writeCachedCatalog(index: BibleTranslationsIndex): Promise<void> {
  try {
    const payload: CachedCatalog = { fetchedAt: Date.now(), index };
    await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function catalogCandidates(base: string): string[] {
  const trimmed = base.replace(/\/+$/, "");
  return [`${trimmed}/api/mobile/bible/translations`, `${trimmed}/api/home/bible-translations-catalog`];
}

async function fetchRemoteCatalog(): Promise<BibleTranslationsIndex | null> {
  const base = getAskBibleBaseUrl();
  for (const url of catalogCandidates(base)) {
    try {
      const res = await fetchWithTimeout(url, { timeoutMs: 12_000 });
      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      const normalized = normalizeCatalog(json);
      if (normalized && normalized.translations.length > 0) {
        await writeCachedCatalog(normalized);
        return normalized;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** 同步内置译本表（离线兜底：仅 3 个默认译本） */
export function bundledBibleTranslationsCatalog(): BibleTranslationsIndex {
  return OFFLINE_BUNDLED_INDEX;
}

/** 优先拉 askbible.me 全量目录；离线时回退内置 3 译本。 */
export async function fetchBibleTranslationsCatalog(): Promise<BibleTranslationsIndex> {
  const cached = await readCachedCatalog();
  if (cached) return cached;

  const remote = await fetchRemoteCatalog();
  if (remote) return remote;

  return OFFLINE_BUNDLED_INDEX;
}

export function translationMetaFromCatalog(
  catalog: BibleTranslationsIndex,
  translationId: string,
): BibleTranslationMeta | undefined {
  const id = translationId.trim();
  return catalog.translations.find((t) => t.id === id);
}
