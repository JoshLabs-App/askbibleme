import {
  defaultGoldenVersePageTemplateId,
  normalizeGoldenVersePageTemplateId,
  type GoldenVersePageTemplateId,
} from "@/lib/verse/golden-verse-page-templates";

const STORAGE_KEY = "selah-golden-verse-page-template-v1";

export const GOLDEN_VERSE_PAGE_TEMPLATE_UPDATED_EVENT = "selah:golden-verse-page-template-updated";

export type GoldenVersePageTemplatePrefsV1 = {
  version: 1;
  templateId: GoldenVersePageTemplateId;
};

export function readGoldenVersePageTemplatePrefs(
  customUploadUrl: string | null,
): GoldenVersePageTemplatePrefsV1 {
  const fallback: GoldenVersePageTemplatePrefsV1 = {
    version: 1,
    templateId: defaultGoldenVersePageTemplateId(customUploadUrl),
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return fallback;
    const p = JSON.parse(raw) as Partial<GoldenVersePageTemplatePrefsV1>;
    if (p?.version !== 1) return fallback;
    const templateId = normalizeGoldenVersePageTemplateId(p.templateId);
    if (templateId === "custom" && !customUploadUrl?.trim()) {
      return { version: 1, templateId: "wide" };
    }
    return { version: 1, templateId };
  } catch {
    return fallback;
  }
}

export function writeGoldenVersePageTemplatePrefs(templateId: GoldenVersePageTemplateId): void {
  if (typeof window === "undefined") return;
  try {
    const normalized: GoldenVersePageTemplatePrefsV1 = {
      version: 1,
      templateId: normalizeGoldenVersePageTemplateId(templateId),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event(GOLDEN_VERSE_PAGE_TEMPLATE_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

/** `useSyncExternalStore`：SSR 用默认模板，客户端 hydration 后再读 localStorage */
export function subscribeGoldenVersePageTemplate(onStoreChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onStoreChange();
  };
  window.addEventListener(GOLDEN_VERSE_PAGE_TEMPLATE_UPDATED_EVENT, onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(GOLDEN_VERSE_PAGE_TEMPLATE_UPDATED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getGoldenVersePageTemplateClientSnapshot(
  customUploadUrl: string | null,
): GoldenVersePageTemplateId {
  return readGoldenVersePageTemplatePrefs(customUploadUrl).templateId;
}

export function getGoldenVersePageTemplateServerSnapshot(
  customUploadUrl: string | null,
): GoldenVersePageTemplateId {
  return defaultGoldenVersePageTemplateId(customUploadUrl);
}
