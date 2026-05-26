/**
 * 从发现版（查经引导）正文中移除「经文祷告」整段（含相关经文、祷告引导）。
 * 用于已发布 markdown 批量清理，无需整章重生成。
 */
export function stripGuidePrayerSectionFromMarkdown(markdown: string): {
  markdown: string;
  stripped: boolean;
} {
  if (!markdown?.trim()) return { markdown: markdown ?? "", stripped: false };

  const prayerHeading =
    /(^|\n)#{1,3}\s*[四4][、.．]?\s*经文祷告[^\n]*\n[\s\S]*?(?=\n#{1,3}\s*[五5][、.．]?\s*一句话总结)/m;

  if (!prayerHeading.test(markdown)) {
    if (!/经文祷告|祷告引导/.test(markdown)) {
      return { markdown, stripped: false };
    }
    const fallback =
      /(^|\n)#{1,3}\s*[^\n]*经文祷告[^\n]*\n[\s\S]*?(?=\n#{1,3}\s*[^\n]*一句话总结|\s*$)/m;
    if (!fallback.test(markdown)) return { markdown, stripped: false };
    let next = markdown.replace(fallback, "\n");
    next = renumberSummaryHeading(next);
    return { markdown: normalizeGap(next), stripped: true };
  }

  let next = markdown.replace(prayerHeading, "\n");
  next = renumberSummaryHeading(next);
  return { markdown: normalizeGap(next), stripped: true };
}

function renumberSummaryHeading(md: string): string {
  return md.replace(
    /(^|\n)(#{1,3}\s*)[五5][、.．]?\s*一句话总结/g,
    "$1$2四、一句话总结",
  );
}

function normalizeGap(md: string): string {
  return md.replace(/\n{4,}/g, "\n\n\n").trimEnd() + "\n";
}
