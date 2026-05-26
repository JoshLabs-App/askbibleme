/** 与网站 `lib/bible/info-edition-v1-format.ts` 一致 */
export function normalizeInfoEditionCompareMarkdown(raw: string): string {
  let text = raw.trim();
  const fence = /^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```$/i;
  const m = text.match(fence);
  if (m) text = m[1].trim();
  const lines = text.split(/\r?\n/);
  const isHeading = (line: string) => /^#{1,6}\s+\S/.test(line.trim());
  const isHorizontalRule = (line: string) => /^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim());
  const cleaned: string[] = [];

  const nearestMeaningfulLine = (
    start: number,
    step: -1 | 1,
  ): string | null => {
    for (let i = start; i >= 0 && i < lines.length; i += step) {
      const candidate = lines[i].trim();
      if (!candidate) continue;
      return candidate;
    }
    return null;
  };

  let firstHeadingSeen = false;

  for (let i = 0; i < lines.length; i += 1) {
    const headingMatch = lines[i].match(/^(\s*)#{1,6}(\s+\S.*)$/);
    if (headingMatch) {
      if (!firstHeadingSeen) {
        firstHeadingSeen = true;
        lines[i] = `${headingMatch[1]}#${headingMatch[2]}`;
      } else if (/^(\s*)#(\s+\S.*)$/.test(lines[i])) {
        lines[i] = lines[i].replace(/^(\s*)#(\s+\S.*)$/, "$1##$2");
      }
    }

    const line = lines[i];
    if (!isHorizontalRule(line)) {
      cleaned.push(line);
      continue;
    }

    const prev = nearestMeaningfulLine(i - 1, -1);
    const next = nearestMeaningfulLine(i + 1, 1);
    const shouldDrop =
      !prev ||
      !next ||
      isHorizontalRule(prev) ||
      isHorizontalRule(next) ||
      isHeading(prev) ||
      isHeading(next);
    if (!shouldDrop) cleaned.push(line);
  }

  const merged = enforcePrimaryHeadingStructure(mergeHardWrappedParagraphLines(cleaned));
  text = merged
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // Flatten nested list indentation on mobile so all lines align left.
  // We keep top-level ordered markers (e.g. "1.") but remove nested bullet/list prefixes.
  text = text
    .replace(/^[ \t]+[-*+]\s+/gm, "")
    .replace(/^[ \t]+\d+\.\s+/gm, "");
  return text;
}

function enforcePrimaryHeadingStructure(lines: string[]): string[] {
  const next = [...lines];
  const firstMeaningfulIndex = next.findIndex((line) => line.trim().length > 0);
  if (firstMeaningfulIndex < 0) return next;

  const firstLine = next[firstMeaningfulIndex];
  const headingMatch = firstLine.match(/^(\s*)#{1,6}\s+(\S.*)$/);
  if (headingMatch) {
    next[firstMeaningfulIndex] = `${headingMatch[1]}# ${headingMatch[2]}`;
  } else {
    next[firstMeaningfulIndex] = `# ${firstLine.trim()}`;
  }

  for (let i = firstMeaningfulIndex + 1; i < next.length; i += 1) {
    if (/^(\s*)#(\s+\S.*)$/.test(next[i])) {
      next[i] = next[i].replace(/^(\s*)#(\s+\S.*)$/, "$1##$2");
    }
  }

  // Backward compatibility: normalize legacy info titles like
  // "# 马太福音第23章导读" -> "# 马太福音 23章"
  const firstHeading = next[firstMeaningfulIndex];
  const legacyZhGuideHeading = firstHeading.match(
    /^(\s*#\s*)(.+?)\s*第?\s*(\d+)\s*章\s*导读\s*$/u,
  );
  if (legacyZhGuideHeading) {
    const [, prefix, bookName, chapterNum] = legacyZhGuideHeading;
    next[firstMeaningfulIndex] = `${prefix}${bookName.trim()} ${chapterNum}章`;
  }

  return next;
}

function mergeHardWrappedParagraphLines(lines: string[]): string[] {
  const isHorizontalRule = (line: string) => /^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim());
  const isParagraphText = (line: string): boolean => {
    const t = line.trim();
    if (!t) return false;
    if (isHorizontalRule(t)) return false;
    if (/^(#{1,6}\s|>|\* |- |\+ |```|~~~)/.test(t)) return false;
    if (/^\d+\.\s/.test(t)) return false;
    return true;
  };

  const out: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    let currentRaw = lines[i];
    if (!isParagraphText(currentRaw)) {
      out.push(currentRaw);
      continue;
    }

    let current = currentRaw.replace(/\s+$/, "");
    while (
      /\s{2,}$/.test(currentRaw) &&
      i + 1 < lines.length &&
      isParagraphText(lines[i + 1])
    ) {
      const next = lines[i + 1].trim();
      current = `${current} ${next}`;
      i += 1;
      currentRaw = lines[i];
    }
    out.push(current);
  }
  return out;
}
