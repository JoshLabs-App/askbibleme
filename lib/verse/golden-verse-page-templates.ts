import { READ_PARCHMENT_BACKGROUND_PATHS } from "@/lib/read/read-parchment-background";

/** 金句页可选底图模板（内置 + 后台上传） */
export const GOLDEN_VERSE_PAGE_TEMPLATE_IDS = [
  "custom",
  "wide",
  "scroll",
  "scroll2",
  "scroll3",
] as const;

export type GoldenVersePageTemplateId = (typeof GOLDEN_VERSE_PAGE_TEMPLATE_IDS)[number];

export type GoldenVersePageTemplateDef = {
  id: GoldenVersePageTemplateId;
  /** 内置静态路径；`custom` 由后台 `backgroundImageUrl` 注入 */
  imagePath: string | null;
};

export const GOLDEN_VERSE_PAGE_TEMPLATES: readonly GoldenVersePageTemplateDef[] = [
  { id: "custom", imagePath: null },
  { id: "wide", imagePath: "/verse/golden-verse-scroll-wide.jpg" },
  { id: "scroll", imagePath: READ_PARCHMENT_BACKGROUND_PATHS[1] },
  { id: "scroll2", imagePath: READ_PARCHMENT_BACKGROUND_PATHS[2] },
  { id: "scroll3", imagePath: READ_PARCHMENT_BACKGROUND_PATHS[3] },
] as const;

export function isGoldenVersePageTemplateId(raw: unknown): raw is GoldenVersePageTemplateId {
  return (
    typeof raw === "string" &&
    (GOLDEN_VERSE_PAGE_TEMPLATE_IDS as readonly string[]).includes(raw)
  );
}

export function normalizeGoldenVersePageTemplateId(raw: unknown): GoldenVersePageTemplateId {
  return isGoldenVersePageTemplateId(raw) ? raw : "wide";
}

export function resolveGoldenVersePageTemplateImageUrl(
  templateId: GoldenVersePageTemplateId,
  customUploadUrl: string | null,
): string | null {
  if (templateId === "custom") {
    return customUploadUrl?.trim() || null;
  }
  const def = GOLDEN_VERSE_PAGE_TEMPLATES.find((t) => t.id === templateId);
  return def?.imagePath ?? null;
}

/** 给定后台上传地址时，哪些模板应在选择器里展示 */
export function listGoldenVersePageTemplateOptions(customUploadUrl: string | null): GoldenVersePageTemplateDef[] {
  const hasCustom = Boolean(customUploadUrl?.trim());
  return GOLDEN_VERSE_PAGE_TEMPLATES.filter((t) => t.id !== "custom" || hasCustom);
}

export function defaultGoldenVersePageTemplateId(customUploadUrl: string | null): GoldenVersePageTemplateId {
  return customUploadUrl?.trim() ? "custom" : "wide";
}
