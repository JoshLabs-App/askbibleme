/**
 * 静态经文文件的形状与路径约定——生成端（scripts/build-static-scripture.ts）与
 * 读取端（lib/bible/load-static-scripture-chapter.ts）共用，避免两边各写一份而漂移。
 *
 * 布局：`public/scripture/{translationId}/{BOOK}.json`，一卷一个文件（约 100KB），
 * 读一章只取一个文件，可被 CDN 全缓存，且不需要 fs。
 */
export const STATIC_SCRIPTURE_DIR_REL = "public/scripture";

/** 对外 URL 前缀（public/ 之下即站点根）。 */
export const STATIC_SCRIPTURE_URL_PREFIX = "/scripture";

/**
 * 有 `speech_spans`（朗读分色）或 `theme_repeat_count`（金句色带）时用对象，
 * 否则退化成纯字符串——多数节两者皆无，省去为少数节让整份文件都背上键名。
 * 见 lib/bible/loaded-chapter-verse.ts。
 */
export type StaticScriptureVerse = string | { t: string; s?: string; r?: number };

export type StaticScriptureBookFile = {
  /** 结构版本；将来改形状时读取端据此拒绝旧产物而不是静默错读。 */
  v: 1;
  /** 章号（字符串）→ 该章各节，按节序排列（下标 0 即第 1 节）。 */
  c: Record<string, StaticScriptureVerse[]>;
};

const TRANSLATION_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
const BOOK_ID_RE = /^[A-Z0-9]{2,8}$/;

/** 两个 id 都来自路由参数，必须校验后才可拼进路径，避免越界读取。 */
export function isSafeStaticScriptureIds(translationId: string, bookId: string): boolean {
  return TRANSLATION_ID_RE.test(translationId) && BOOK_ID_RE.test(bookId);
}

export function staticScriptureBookRelPath(translationId: string, bookId: string): string {
  return `${STATIC_SCRIPTURE_DIR_REL}/${translationId}/${bookId}.json`;
}

export function staticScriptureBookUrlPath(translationId: string, bookId: string): string {
  return `${STATIC_SCRIPTURE_URL_PREFIX}/${translationId}/${bookId}.json`;
}
