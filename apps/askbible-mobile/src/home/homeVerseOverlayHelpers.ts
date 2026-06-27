import { parseVerseKey } from "../bible/parse-verse-key";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import type { AppLocale } from "../i18n/config";
import { flowLocaleForHomeVerseTranslationId } from "./homePrayerVersePrefs";

const CJK_CHAR_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const LATIN_CHAR_RE = /[A-Za-z]/;

function hasCjkChars(text: string): boolean {
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
