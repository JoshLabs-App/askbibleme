import type { ScriptureVerseXrefs } from "@/lib/bible/scripture-xref-types";

/**
 * 静态交叉引用的形状与路径约定——生成端（scripts/build-static-xrefs.ts）与读取端
 * （lib/bible/load-chapter-xrefs.ts）共用，避免两边各写一份而漂移。
 *
 * 与经文同样按卷切分：整个 xref 库只有 1.7MB，切成 66 卷后单卷很小，
 * 读一章不必把整库读进内存，也不需要 fs。
 */
export const STATIC_XREFS_DIR_REL = "public/xrefs";
export const STATIC_XREFS_URL_PREFIX = "/xrefs";

export type StaticXrefsBookFile = {
  /** 结构版本；改形状时读取端据此拒绝旧产物，而不是静默错读。 */
  v: 1;
  /** 章号（字符串）→ 该章有 xref 的节，按节序排列。 */
  c: Record<string, ScriptureVerseXrefs[]>;
};

const BOOK_ID_RE = /^[A-Z0-9]{2,8}$/;

/** bookId 来自路由参数，必须校验后才可拼进路径。 */
export function isSafeStaticXrefBookId(bookId: string): boolean {
  return BOOK_ID_RE.test(bookId);
}

export function staticXrefsBookRelPath(bookId: string): string {
  return `${STATIC_XREFS_DIR_REL}/${bookId}.json`;
}

export function staticXrefsBookUrlPath(bookId: string): string {
  return `${STATIC_XREFS_URL_PREFIX}/${bookId}.json`;
}
