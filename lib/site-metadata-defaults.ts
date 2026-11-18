import { ASKBIBLE_PRODUCT_NAME } from "./askbible-product-name";

/**
 * 默认标题用于根布局；子页与客户端通过 sitePageTitle 生成完整标题。
 * 根布局不重复套模板，避免品牌后缀出现两次。
 */
export const SITE_METADATA_DEFAULT_TITLE = ASKBIBLE_PRODUCT_NAME;
/** 前台子页 `<title>`：`音乐` → `音乐 | AskBible.me` */
export const SITE_METADATA_TITLE_TEMPLATE = `%s | ${ASKBIBLE_PRODUCT_NAME}` as const;

/** 浏览器标签标题：`音乐` → `音乐 | AskBible.me` */
export function sitePageTitle(segment: string): string {
  const s = segment.trim();
  if (!s) return SITE_METADATA_DEFAULT_TITLE;
  return SITE_METADATA_TITLE_TEMPLATE.replace("%s", s);
}

/**
 * 多段中文名用 ` · ` 连接后再加后缀：`创世记` + `祷告` → `创世记 · 祷告 | AskBible.me`
 */
export function sitePageTitleWithSuffix(parts: string[]): string {
  const body = parts.map((p) => p.trim()).filter(Boolean).join(" · ");
  if (!body) return SITE_METADATA_DEFAULT_TITLE;
  return `${body} | ${SITE_METADATA_DEFAULT_TITLE}`;
}
