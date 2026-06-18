import type { HistoricalCreedBodyContent } from "./types";

export const ABRIDGED_BOOK_NOTE_ZH =
  "【提要节选】本篇为成书篇幅，此处仅录开篇与结构提要；若要通读全文，请查阅原典印本。";
export const ABRIDGED_BOOK_NOTE_ZH_TW =
  "【提要節選】本篇為成書篇幅，此處僅錄開篇與結構提要；若要通讀全文，請查閱原典印本。";
export const ABRIDGED_BOOK_NOTE_EN =
  "[Abridged] This document is book-length; what follows is an opening sample and structural outline. Consult a printed edition for the full text.";

export function articleBody(
  zhArticles: string[],
  zhTwArticles: string[],
  enArticles: string[],
): HistoricalCreedBodyContent {
  return { bodyZh: zhArticles, bodyZhTw: zhTwArticles, bodyEn: enArticles };
}

export function withAbridgedNote(
  content: HistoricalCreedBodyContent,
): HistoricalCreedBodyContent {
  return {
    bodyZh: [ABRIDGED_BOOK_NOTE_ZH, ...content.bodyZh],
    bodyZhTw: [ABRIDGED_BOOK_NOTE_ZH_TW, ...content.bodyZhTw],
    bodyEn: [ABRIDGED_BOOK_NOTE_EN, ...content.bodyEn],
  };
}

/** One Chicago-style article: affirmation + denial */
export function chicagoArticle(
  n: number,
  zhAffirm: string,
  zhDeny: string,
  enAffirm: string,
  enDeny: string,
): { zh: string; zhTw: string; en: string } {
  const zh = `第 ${n} 条\n我们确认：${zhAffirm}\n我们否认：${zhDeny}`;
  const zhTw = `第 ${n} 條\n我們確認：${zhAffirm}\n我們否認：${zhDeny}`;
  const en = `Article ${n}\nWE AFFIRM that ${enAffirm}\nWE DENY that ${enDeny}`;
  return { zh, zhTw: zhTw.replace(/我们/g, "我們").replace(/确认/g, "確認").replace(/否认/g, "否認"), en };
}
