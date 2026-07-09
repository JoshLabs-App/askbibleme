import { parseVerseKey } from "../bible/parse-verse-key";

/** Deep link opened by home-screen widget → expo-router read chapter route. */
export function buildWidgetReadChapterUrl(verseKey: string): string | null {
  const parsed = parseVerseKey(verseKey);
  if (!parsed) return null;
  return `askbible://read/${parsed.bookId}/${parsed.chapter}?verse=${parsed.verse}`;
}

export function widgetReadChapterExpoPath(rawPath: string): string | null {
  const trimmed = rawPath.trim();
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  const [pathPart, queryPart = ""] = withoutScheme.split("?", 2);
  const match = pathPart.match(/^\/?read\/([A-Z0-9]{2,8})\/(\d+)$/i);
  if (!match) return null;
  const bookId = match[1]!.toUpperCase();
  const chapter = match[2]!;
  const query = new URLSearchParams(queryPart);
  const verse = query.get("verse");
  const autoplay = query.get("autoplay");
  const out = new URLSearchParams();
  if (verse) out.set("verse", verse);
  if (autoplay) out.set("autoplay", autoplay);
  const qs = out.toString();
  // Route groups like (tabs) are omitted from public URLs — never prefix with /(tabs).
  return qs ? `/read/${bookId}/${chapter}?${qs}` : `/read/${bookId}/${chapter}`;
}

export type WidgetReadDeepLinkTarget = {
  bookId: string;
  chapter: string;
  verse?: string;
};

/** Parsed read-chapter target from widget / system deep link URL. */
export function parseWidgetReadDeepLink(rawPath: string): WidgetReadDeepLinkTarget | null {
  const expoPath = widgetReadChapterExpoPath(rawPath);
  if (!expoPath) return null;
  const [pathPart, queryPart = ""] = expoPath.split("?", 2);
  const match = pathPart.match(/^\/read\/([A-Z0-9]{2,8})\/(\d+)$/i);
  if (!match) return null;
  const verse = new URLSearchParams(queryPart).get("verse");
  return {
    bookId: match[1]!.toUpperCase(),
    chapter: match[2]!,
    ...(verse ? { verse } : {}),
  };
}
