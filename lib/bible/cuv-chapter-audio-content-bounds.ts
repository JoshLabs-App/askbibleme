/**
 * 和合本整章朗读 MP3 常见结构：先口播书卷+章（如「创世记第三十三章」），再读正文。
 * 经文高亮若从 t=0 起按比例摊到各节，会把片头时间「算进」第一节，导致整体偏前。
 *
 * 此处提供「正文起算」的秒数偏移；可按卷章微调（同一 CDN 各章片头长短仍略有出入）。
 */
const DEFAULT_LEAD_IN_SEC = 5;

/** `BOOK:chapter`，如 `GEN:33` */
const LEAD_IN_SEC_BY_CHAPTER: Record<string, number> = {
  // 片头略长时可在此逐章加大；默认见 `DEFAULT_LEAD_IN_SEC`
  "GEN:33": 6,
};

function chapterKey(bookId: string, chapter: number): string {
  const id = String(bookId || "").trim().toUpperCase();
  if (!id || !Number.isInteger(chapter) || chapter < 1) return "";
  return `${id}:${chapter}`;
}

export type CuvChapterAudioContentBounds = {
  /** 从文件开头到「第一节正文开读」的秒数；此前不高亮任何节 */
  leadInSec: number;
  /** 从文件末尾向内扣除的秒数（尾声音乐等），不参与经文比例映射 */
  trailOutSec: number;
};

export function getCuvChapterAudioContentBounds(bookId: string, chapter: number): CuvChapterAudioContentBounds {
  const key = chapterKey(bookId, chapter);
  const lead = key && LEAD_IN_SEC_BY_CHAPTER[key] != null ? LEAD_IN_SEC_BY_CHAPTER[key]! : DEFAULT_LEAD_IN_SEC;
  const leadInSec = Math.max(0, Number.isFinite(lead) ? lead : DEFAULT_LEAD_IN_SEC);
  return { leadInSec, trailOutSec: 0 };
}
