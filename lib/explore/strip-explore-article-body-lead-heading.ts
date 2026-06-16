/** Explore article pages already show `title`; drop redundant lead heading in markdown body. */
export function stripExploreArticleBodyLeadHeading(body: string): string {
  let text = body.replace(/^\uFEFF/, "").trimStart();
  if (!text) return body;

  const h1 = text.match(/^#\s+[^\n]+\n+/);
  if (h1) {
    text = text.slice(h1[0].length);
  } else {
    const bold = text.match(/^\*\*[^*\n]+\*\*\n+/);
    if (bold) text = text.slice(bold[0].length);
  }

  text = text.replace(/^\*[^*\n]+\*\n+/, "");
  text = text.replace(/^---\s*\n+/, "");

  const trimmed = text.trimStart();
  return trimmed.length > 0 ? trimmed : body;
}
