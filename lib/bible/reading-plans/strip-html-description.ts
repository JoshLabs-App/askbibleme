/** Strip tags from upstream HTML snippets for safe plain-text display. */
export function stripReadingPlanHtml(html: string): string {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
