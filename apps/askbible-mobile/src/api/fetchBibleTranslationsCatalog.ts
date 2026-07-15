import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { BUNDLED_SCRIPTURE_TRANSLATION_IDS } from "../bible/bundled-scripture-translations";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "../bible/translations-types";

const CATALOG_CACHE_KEY = "askbible.mobile.bible-translations-catalog.v1";
const CATALOG_CACHE_TTL_MS = 60_000;
const REMOTE_CATALOG_BASE = "https://askbible.me";
const EXCLUDED_TRANSLATION_IDS = new Set(["heb-leningrad"]);

const OFFLINE_BUNDLED_INDEX: BibleTranslationsIndex = {
  translations: [
    {
      id: "ccb-zh-hans",
      labelZh: "当代译本（简体）",
      labelEn: "Contemporary Chinese Bible (Simplified)",
      language: "zh-Hans",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "36",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "ccb-zh-hant",
      labelZh: "當代譯本（繁體）",
      labelEn: "Contemporary Chinese Bible (Traditional)",
      language: "zh-Hant",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "1392",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "cnv-zh-hant",
      labelZh: "新譯本（繁體）",
      labelEn: "Chinese New Version (Traditional)",
      language: "zh-Hant",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "40",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "cnvs-zh-hans",
      labelZh: "新译本（简体）",
      labelEn: "Chinese New Version (Simplified)",
      language: "zh-Hans",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "41",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "csbs-zh-hans",
      labelZh: "中文标准译本（简体）",
      labelEn: "Chinese Standard Bible (Simplified)",
      language: "zh-Hans",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "43",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "csbt-zh-hant",
      labelZh: "中文標準譯本（繁體）",
      labelEn: "Chinese Standard Bible (Traditional)",
      language: "zh-Hant",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "312",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "rcuv-zh-hant",
      labelZh: "和合本修訂版",
      labelEn: "Revised Chinese Union Version",
      language: "zh-Hant",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "139",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "rcuvss-zh-hans",
      labelZh: "和合本修订版",
      labelEn: "Revised Chinese Union Version (Simplified)",
      language: "zh-Hans",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "140",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "cunp-zh-hant",
      labelZh: "新標點和合本, 神版",
      labelEn: "Chinese Union Version with New Punctuation, God-Version",
      language: "zh-Hant",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "46",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "cunp-zh-hant-god",
      labelZh: "新標點和合本, 上帝版",
      labelEn: "Chinese Union Version with New Punctuation, God-Version",
      language: "zh-Hant",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "414",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "cunpss-zh-hant",
      labelZh: "新標點和合本, 上帝版",
      labelEn: "Chinese Union Version with New Punctuation, God-Version",
      language: "zh-Hant",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "47",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "cunpss-zh-hans",
      labelZh: "新标点和合本, 神版",
      labelEn: "Chinese Union Version with New Punctuation, God-Version",
      language: "zh-Hans",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "2224",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "feb-zh-hans",
      labelZh: "免费的易读圣经",
      labelEn: "Free Easy-to-Read Bible",
      language: "zh-Hans",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "3354",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "mandarin-zh-hans",
      labelZh: "普通话本",
      labelEn: "Mandarin Bible",
      language: "zh-Hans",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "3780",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "rcv-zh-hant",
      labelZh: "恢復本（繁體）",
      labelEn: "Recovery Version Traditional Chinese",
      language: "zh-Hant",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "4230",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
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
      id: "niv",
      labelZh: "NIV 英文新国际版",
      labelEn: "New International Version (NIV)",
      language: "en",
      bundled: false,
      downloadUrl: null,
      provider: "youversion",
      remoteId: "111",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "esv",
      labelZh: "ESV 英文标准版",
      labelEn: "English Standard Version (ESV)",
      language: "en",
      bundled: false,
      downloadUrl: null,
      provider: "esv",
      remoteId: null,
      delivery: "chapter-api",
      enabled: true,
      copyright:
        "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 Crossway.",
      publisherUrl: "https://www.esv.org",
    },
    {
      id: "nlt",
      labelZh: "NLT 现代英语译本",
      labelEn: "New Living Translation (NLT)",
      language: "en",
      bundled: false,
      downloadUrl: null,
      provider: "api-bible",
      remoteId: "d6e14a625393b4da-01",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "nkjv",
      labelZh: "NKJV 新钦定版",
      labelEn: "New King James Version (NKJV)",
      language: "en",
      bundled: false,
      downloadUrl: null,
      provider: "api-bible",
      remoteId: "63097d2a0a2f7db3-01",
      delivery: "chapter-api",
      enabled: true,
      copyright: null,
      publisherUrl: null,
    },
    {
      id: "kjv",
      labelZh: "KJV 英文钦定本",
      labelEn: "King James Version (KJV)",
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

function mergeCatalogIndices(
  ...indices: Array<BibleTranslationsIndex | null | undefined>
): BibleTranslationsIndex {
  const merged = new Map<string, BibleTranslationMeta>();
  let defaultTranslationId: string | null = null;

  for (const index of indices) {
    if (!index) continue;
    if (!defaultTranslationId && index.defaultTranslationId) {
      defaultTranslationId = index.defaultTranslationId;
    }
    for (const item of index.translations) {
      const id = String(item?.id || "").trim();
      if (!id) continue;
      merged.set(id, { ...item, id });
    }
  }

  const translations = [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
  const resolvedDefault =
    defaultTranslationId && translations.some((item) => item.id === defaultTranslationId)
      ? defaultTranslationId
      : translations[0]?.id ?? "cuv-simp";

  return {
    translations,
    defaultTranslationId: resolvedDefault,
  };
}

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
    .filter((t) => !EXCLUDED_TRANSLATION_IDS.has(String(t.id).trim()))
    .map((t) => ({
      ...(t as BibleTranslationMeta),
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
    return mergeCatalogIndices(OFFLINE_BUNDLED_INDEX, normalized);
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
  const configured = getAskBibleBaseUrl();
  if (!/askbible\.me/i.test(configured)) addBase(configured);
  addBase(REMOTE_CATALOG_BASE);
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
        const merged = mergeCatalogIndices(OFFLINE_BUNDLED_INDEX, normalized);
        await writeCachedCatalog(merged, catalogBase);
        return merged;
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

/** 同步内置译本表（离线兜底：保留中文前两项 + 常用英文译本） */
export function bundledBibleTranslationsCatalog(): BibleTranslationsIndex {
  return OFFLINE_BUNDLED_INDEX;
}

/** 优先拉 askbible.me 全量目录；离线时回退内置目录。 */
export async function fetchBibleTranslationsCatalog(): Promise<BibleTranslationsIndex> {
  const cached = await readCachedCatalog(CATALOG_CACHE_TTL_MS);
  if (cached) return cached;

  const remote = await fetchRemoteCatalog();
  if (remote) return mergeCatalogIndices(OFFLINE_BUNDLED_INDEX, remote);

  return OFFLINE_BUNDLED_INDEX;
}

/** 资源更新检查：跳过短缓存，尽量拉最新目录。 */
export async function fetchBibleTranslationsCatalogFresh(): Promise<BibleTranslationsIndex> {
  const remote = await fetchRemoteCatalog();
  if (remote) return mergeCatalogIndices(OFFLINE_BUNDLED_INDEX, remote);
  const cached = await readCachedCatalog();
  if (cached) return cached;
  return OFFLINE_BUNDLED_INDEX;
}

/** 清除可能只含旧目录的缓存（升级目录拉取逻辑后一次性修复）。 */
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
