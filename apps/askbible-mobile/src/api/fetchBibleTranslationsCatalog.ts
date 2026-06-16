import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { BUNDLED_SCRIPTURE_TRANSLATION_IDS } from "../bible/bundled-scripture-translations";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "../bible/translations-types";

const CATALOG_CACHE_KEY = "askbible.mobile.bible-translations-catalog.v1";
const CATALOG_CACHE_TTL_MS = 60_000;
const REMOTE_CATALOG_BASE = "https://askbible.me";

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
  baseUrl?: string;
};

function isCatalogShape(raw: unknown): raw is BibleTranslationsIndex {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.translations);
}

function isSparseCatalog(index: BibleTranslationsIndex | null | undefined): boolean {
  return !index || index.translations.length <= OFFLINE_BUNDLED_INDEX.translations.length;
}

function normalizeCatalog(raw: unknown, catalogBaseUrl: string): BibleTranslationsIndex | null {
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
      downloadUrl:
        typeof t.downloadUrl === "string" && t.downloadUrl.trim()
          ? toAbsoluteUrl(catalogBaseUrl, t.downloadUrl.trim())
          : t.downloadUrl === null
            ? null
            : undefined,
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

async function readCachedCatalog(maxAgeMs?: number): Promise<BibleTranslationsIndex | null> {
  try {
    const raw = (await AsyncStorage.getItem(CATALOG_CACHE_KEY))?.trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    if (!parsed?.index) return null;
    if (maxAgeMs != null && Date.now() - parsed.fetchedAt > maxAgeMs) return null;
    const normalized = normalizeCatalog(parsed.index, parsed.baseUrl || REMOTE_CATALOG_BASE);
    if (isSparseCatalog(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}

async function writeCachedCatalog(index: BibleTranslationsIndex, baseUrl: string): Promise<void> {
  try {
    const payload: CachedCatalog = { fetchedAt: Date.now(), index, baseUrl };
    await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function catalogCandidates(base: string): string[] {
  const trimmed = base.replace(/\/+$/, "");
  return [`${trimmed}/api/mobile/bible/translations`, `${trimmed}/api/home/bible-translations-catalog`];
}

function remoteCatalogUrls(): string[] {
  const urls: string[] = [];
  const addBase = (base: string) => {
    for (const url of catalogCandidates(base)) {
      if (!urls.includes(url)) urls.push(url);
    }
  };
  addBase(REMOTE_CATALOG_BASE);
  const configured = getAskBibleBaseUrl();
  if (!/askbible\.me/i.test(configured)) addBase(configured);
  return urls;
}

async function fetchRemoteCatalogOnce(): Promise<BibleTranslationsIndex | null> {
  for (const url of remoteCatalogUrls()) {
    try {
      const res = await fetchWithTimeout(url, {
        timeoutMs: 15_000,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      let catalogBase = REMOTE_CATALOG_BASE;
      try {
        catalogBase = new URL(url).origin;
      } catch {
        /* keep default */
      }
      const normalized = normalizeCatalog(json, catalogBase);
      if (normalized && !isSparseCatalog(normalized)) {
        await writeCachedCatalog(normalized, catalogBase);
        return normalized;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchRemoteCatalog(): Promise<BibleTranslationsIndex | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const index = await fetchRemoteCatalogOnce();
    if (index) return index;
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
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
  const cached = await readCachedCatalog(CATALOG_CACHE_TTL_MS);
  if (cached) return cached;

  const remote = await fetchRemoteCatalog();
  if (remote) return remote;

  return OFFLINE_BUNDLED_INDEX;
}

/** 资源更新检查：跳过短缓存，尽量拉最新目录。 */
export async function fetchBibleTranslationsCatalogFresh(): Promise<BibleTranslationsIndex> {
  const remote = await fetchRemoteCatalog();
  if (remote) return remote;
  const cached = await readCachedCatalog();
  if (cached) return cached;
  return OFFLINE_BUNDLED_INDEX;
}

/** 清除可能只含内置 3 译本的旧缓存（升级目录拉取逻辑后一次性修复）。 */
export async function clearBibleTranslationsCatalogCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CATALOG_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function translationMetaFromCatalog(
  catalog: BibleTranslationsIndex,
  translationId: string,
): BibleTranslationMeta | undefined {
  const id = translationId.trim();
  return catalog.translations.find((t) => t.id === id);
}
