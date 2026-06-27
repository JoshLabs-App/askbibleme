/** Article section titles may carry markdown numbering (e.g.「1. 阅读圣经」)— strip for accordion headers. */
const SECTION_TITLE_OWN_INDEX = /^\d+\.\s+/;

export function stripExploreFeaturedArticleSectionTitleIndex(title: string): string {
  const trimmed = title.trim();
  const stripped = trimmed.replace(SECTION_TITLE_OWN_INDEX, "").trim();
  return stripped || trimmed;
}

export function exploreFeaturedArticleSectionHeaderLabel(
  title: string,
  accordionIndex: number,
): { indexLabel: string; title: string } {
  return {
    indexLabel: `${accordionIndex + 1}.`,
    title: stripExploreFeaturedArticleSectionTitleIndex(title),
  };
}
