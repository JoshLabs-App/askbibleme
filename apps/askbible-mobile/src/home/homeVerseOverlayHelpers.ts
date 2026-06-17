import { parseVerseKey } from "../bible/parse-verse-key";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import type { AppLocale } from "../i18n/config";
import { SHELL_TAB_BAR_CLEARANCE } from "../shell/shellLayout";
import {
  HOME_SCENE_THUMB_SIZE,
  HOME_SCENE_THUMB_SLOT_PAD,
} from "./HomeSceneThumb";
import { flowLocaleForHomeVerseTranslationId } from "./homePrayerVersePrefs";

export const PHI = (1 + Math.sqrt(5)) / 2;
/** 上黄金线（距安全区顶 ≈ 38.2%） */
export const GOLDEN_UPPER = 1 - 1 / PHI;
/** 首页经文整体上移 10% 视口高度 */
export const HOME_VERSE_UP_SHIFT = 0.1;
export const HOME_VERSE_TOP_PAD = 12;
/** 与 `HomeNatureScreen` `bottomBand` + 场景条行高对齐 */
export const HOME_SCENE_STRIP_BAND_H =
  12 + 6 + (HOME_SCENE_THUMB_SIZE + HOME_SCENE_THUMB_SLOT_PAD * 2) + 6;

const CJK_CHAR_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const LATIN_CHAR_RE = /[A-Za-z]/;

export function homeVerseMaxHeightPx(
  screenH: number,
  insets: { top: number; bottom: number },
): number {
  const usableH = Math.max(1, screenH - insets.top - insets.bottom);
  const goldenY = insets.top + usableH * (GOLDEN_UPPER - HOME_VERSE_UP_SHIFT);
  const spaceAbove = Math.max(0, goldenY - insets.top - HOME_VERSE_TOP_PAD);
  const stripTop = screenH - (SHELL_TAB_BAR_CLEARANCE + insets.bottom) - HOME_SCENE_STRIP_BAND_H;
  const spaceBelow = Math.max(0, stripTop - goldenY);
  // 以“中线”对齐黄金线：块体上下各占一半。
  return Math.floor(Math.min(spaceAbove, spaceBelow) * 2);
}

export function hasCjkChars(text: string): boolean {
  return CJK_CHAR_RE.test(text);
}

export function resolveSpeechLocale(
  speechMain: string,
  translationId: string,
): AppLocale {
  const text = speechMain.trim();
  if (text) {
    if (LATIN_CHAR_RE.test(text) && !hasCjkChars(text)) return "en";
    if (hasCjkChars(text)) return "zh-CN";
  }
  return flowLocaleForHomeVerseTranslationId(translationId);
}

function referenceForSpeech(ref: string, isEnglish: boolean): string {
  const raw = String(ref || "").trim();
  if (!raw) return "";
  return raw.replace(
    /(\d+)\s*:\s*(\d+)(?:\s*[-~—]\s*(\d+))?/g,
    (_m, chapterRaw: string, verseStartRaw: string, verseEndRaw?: string) => {
      const chapter = String(chapterRaw).trim();
      const verseStart = String(verseStartRaw).trim();
      const verseEnd = verseEndRaw ? String(verseEndRaw).trim() : "";
      if (isEnglish) {
        return verseEnd
          ? `chapter ${chapter} verse ${verseStart} to ${verseEnd}`
          : `chapter ${chapter} verse ${verseStart}`;
      }
      return verseEnd ? `${chapter}章${verseStart}到${verseEnd}节` : `${chapter}章${verseStart}节`;
    },
  );
}

export function referenceForSpeechByVerseKey(
  verseKey: string | null | undefined,
  ref: string,
  isEnglish: boolean,
): string {
  const parsed = verseKey ? parseVerseKey(verseKey) : null;
  if (!parsed) return referenceForSpeech(ref, isEnglish);
  const bookName = getScriptureBookDisplayName(parsed.bookId, isEnglish ? "en" : "zh-CN");
  if (isEnglish) {
    return `${bookName} chapter ${parsed.chapter} verse ${parsed.verse}`;
  }
  return `${bookName}${parsed.chapter}章${parsed.verse}节`;
}
