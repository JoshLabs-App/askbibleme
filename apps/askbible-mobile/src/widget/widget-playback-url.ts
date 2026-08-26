import type { WidgetPlaybackAction } from "./widgetPlaybackRequest";

export function buildWidgetPlaybackDeepLink(
  action: WidgetPlaybackAction,
  verseKey?: string,
): string {
  if (action === "verse" && verseKey?.trim()) {
    return `askbible://widget/play?action=verse&verseKey=${encodeURIComponent(verseKey.trim().toUpperCase())}`;
  }
  return `askbible://widget/play?action=${action}`;
}
