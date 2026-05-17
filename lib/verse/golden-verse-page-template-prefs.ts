import type { GoldenVerseBackgroundItem } from "@/lib/golden-verses/background-uploads";
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
  backgrounds: readonly GoldenVerseBackgroundItem[],
): GoldenVersePageTemplatePrefsV1 {
  const fallback: GoldenVersePageTemplatePrefsV1 = {
    version: 1,
    templateId: defaultGoldenVersePageTemplateId(backgrounds),
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return fallback;
    const p = JSON.parse(raw) as Partial<GoldenVersePageTemplatePrefsV1>;
    if (p?.version !== 1) return fallback;
    const templateId = normalizeGoldenVersePageTemplateId(p.templateId, backgrounds);
    return { version: 1, templateId };
  } catch {
    return fallback;
  }
}

export function writeGoldenVersePageTemplatePrefs(
  templateId: GoldenVersePageTemplateId,
  backgrounds: readonly GoldenVerseBackgroundItem[],
): void {
  if (typeof window === "undefined") return;
  try {
    const normalized: GoldenVersePageTemplatePrefsV1 = {
      version: 1,
      templateId: normalizeGoldenVersePageTemplateId(templateId, backgrounds),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new Event(GOLDEN_VERSE_PAGE_TEMPLATE_UPDATED_EVENT));
  } catch {
    /* ignore */
  }
}

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
  backgrounds: readonly GoldenVerseBackgroundItem[],
): GoldenVersePageTemplateId {
  return readGoldenVersePageTemplatePrefs(backgrounds).templateId;
}

export function getGoldenVersePageTemplateServerSnapshot(
  backgrounds: readonly GoldenVerseBackgroundItem[],
): GoldenVersePageTemplateId {
  return defaultGoldenVersePageTemplateId(backgrounds);
}
