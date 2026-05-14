/**
 * 与 `app/layout.tsx` 中 `generateMetadata().title` 保持一致（单一事实来源）。
 * 改站点默认标题 / 模板时请改此处并保留与 metadata 同步。
 */
export const SITE_METADATA_DEFAULT_TITLE = "Selah.my" as const;
/** 前台子页 `<title>`：`音乐` → `音乐 | Selah.my` */
export const SITE_METADATA_TITLE_TEMPLATE = "%s | Selah.my" as const;

/** 浏览器标签标题：`音乐` → `音乐 | Selah.my` */
export function sitePageTitle(segment: string): string {
  const s = segment.trim();
  if (!s) return SITE_METADATA_DEFAULT_TITLE;
  return SITE_METADATA_TITLE_TEMPLATE.replace("%s", s);
}

/**
 * 多段中文名用 ` · ` 连接后再加后缀：`创世记` + `祷告` → `创世记 · 祷告 | Selah.my`
 */
export function sitePageTitleWithSuffix(parts: string[]): string {
  const body = parts.map((p) => p.trim()).filter(Boolean).join(" · ");
  if (!body) return SITE_METADATA_DEFAULT_TITLE;
  return `${body} | ${SITE_METADATA_DEFAULT_TITLE}`;
}
