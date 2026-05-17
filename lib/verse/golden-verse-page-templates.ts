import { READ_PARCHMENT_BACKGROUND_PATHS } from "@/lib/read/read-parchment-background";
import type { GoldenVerseBackgroundItem } from "@/lib/golden-verses/background-uploads";

/** 内置金句页底图（不含后台上传） */
export const GOLDEN_VERSE_PAGE_BUILTIN_TEMPLATE_IDS = [
  "wide",
  "scroll",
  "scroll2",
  "scroll3",
] as const;

export type GoldenVersePageBuiltinTemplateId = (typeof GOLDEN_VERSE_PAGE_BUILTIN_TEMPLATE_IDS)[number];

export type GoldenVersePageUploadTemplateId = `upload:${string}`;

export type GoldenVersePageTemplateId =
  | GoldenVersePageBuiltinTemplateId
  | GoldenVersePageUploadTemplateId;

export type GoldenVersePageTemplateDef = {
  id: GoldenVersePageTemplateId;
  imagePath: string | null;
  /** 后台上传项的展示名 */
  label?: string;
};

export const GOLDEN_VERSE_PAGE_BUILTIN_TEMPLATES: readonly GoldenVersePageTemplateDef[] = [
  { id: "wide", imagePath: "/verse/golden-verse-scroll-wide.jpg" },
  { id: "scroll", imagePath: READ_PARCHMENT_BACKGROUND_PATHS[1] },
  { id: "scroll2", imagePath: READ_PARCHMENT_BACKGROUND_PATHS[2] },
  { id: "scroll3", imagePath: READ_PARCHMENT_BACKGROUND_PATHS[3] },
] as const;

export function isGoldenVersePageUploadTemplateId(
  raw: string,
): raw is GoldenVersePageUploadTemplateId {
  return raw.startsWith("upload:");
}

export function isGoldenVersePageBuiltinTemplateId(
  raw: unknown,
): raw is GoldenVersePageBuiltinTemplateId {
  return (
    typeof raw === "string" &&
    (GOLDEN_VERSE_PAGE_BUILTIN_TEMPLATE_IDS as readonly string[]).includes(raw)
  );
}

export function goldenVersePageUploadTemplateId(backgroundId: string): GoldenVersePageUploadTemplateId {
  return `upload:${backgroundId}`;
}

export function parseGoldenVersePageUploadTemplateId(
  templateId: GoldenVersePageTemplateId,
): string | null {
  if (!isGoldenVersePageUploadTemplateId(templateId)) return null;
  const id = templateId.slice("upload:".length);
  return id || null;
}

export function normalizeGoldenVersePageTemplateId(
  raw: unknown,
  backgrounds: readonly GoldenVerseBackgroundItem[],
): GoldenVersePageTemplateId {
  if (backgrounds.length === 0) {
    if (typeof raw === "string" && isGoldenVersePageBuiltinTemplateId(raw.trim())) {
      return raw.trim() as GoldenVersePageBuiltinTemplateId;
    }
    return "wide";
  }
  if (typeof raw !== "string" || !raw.trim()) {
    return defaultGoldenVersePageTemplateId(backgrounds);
  }
  const t = raw.trim();
  if (t === "custom" || isGoldenVersePageBuiltinTemplateId(t)) {
    return defaultGoldenVersePageTemplateId(backgrounds);
  }
  if (isGoldenVersePageUploadTemplateId(t)) {
    const bgId = t.slice("upload:".length);
    if (backgrounds.some((b) => b.id === bgId)) return t;
    return defaultGoldenVersePageTemplateId(backgrounds);
  }
  return defaultGoldenVersePageTemplateId(backgrounds);
}

export function resolveGoldenVersePageTemplateImageUrl(
  templateId: GoldenVersePageTemplateId,
  backgrounds: readonly GoldenVerseBackgroundItem[],
): string | null {
  const uploadId = parseGoldenVersePageUploadTemplateId(templateId);
  if (uploadId) {
    return backgrounds.find((b) => b.id === uploadId)?.url ?? null;
  }
  const def = GOLDEN_VERSE_PAGE_BUILTIN_TEMPLATES.find((t) => t.id === templateId);
  return def?.imagePath ?? null;
}

/** 页模板选择器：仅后台实际上传的背景（不含内置羊皮卷） */
export function listGoldenVersePageTemplateOptions(
  backgrounds: readonly GoldenVerseBackgroundItem[],
): GoldenVersePageTemplateDef[] {
  return backgrounds.map((b) => ({
    id: goldenVersePageUploadTemplateId(b.id),
    imagePath: b.url,
    label: b.label,
  }));
}

export function defaultGoldenVersePageTemplateId(
  backgrounds: readonly GoldenVerseBackgroundItem[],
): GoldenVersePageTemplateId {
  const first = backgrounds[0];
  return first ? goldenVersePageUploadTemplateId(first.id) : "wide";
}

export function goldenVersePageTemplateAriaLabel(
  opt: GoldenVersePageTemplateDef,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  if (isGoldenVersePageUploadTemplateId(opt.id)) {
    if (opt.label?.trim()) return opt.label.trim();
    const shortId = opt.id.slice("upload:".length).slice(0, 8);
    return t("pages.goldenVerses.pageTemplates.upload", { id: shortId });
  }
  return t(`pages.goldenVerses.pageTemplates.${opt.id}`);
}
