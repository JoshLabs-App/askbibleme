/** 单章内的连续经节（与 `selah-bible-v1` 书卷 OSIS id 对齐）。 */
export type VerseRef = {
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  /** 若省略，由解析端按界面语言从 `translations.json` 选择译本 */
  translationId?: string;
};
