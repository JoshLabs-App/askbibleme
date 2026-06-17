import { splitTextByScriptureSearchKeyword } from "@/lib/bible/scripture-search";

type Props = {
  text: string;
  query: string;
  highlightClassName?: string;
};

/** 搜索结果 / 章页：在经文片段内高亮搜索词 */
export function ScriptureSearchHighlightedText({
  text,
  query,
  highlightClassName = "read-scripture-search-hit-keyword",
}: Props) {
  const keyword = query.trim();
  if (!keyword) return text;
  const parts = splitTextByScriptureSearchKeyword(text, keyword);
  if (!parts.some((part) => part.match)) return text;
  return parts.map((part, idx) =>
    part.match ? (
      <mark key={`${part.text}-${idx}`} className={highlightClassName}>
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}
