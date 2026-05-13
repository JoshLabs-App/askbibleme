import type { ReactNode } from "react";

/** 文章内联：中间点分隔，无药丸边框 */
export function PrayerThemeTags({ tags }: { tags: string[] }): ReactNode {
  if (!tags.length) return null;
  return (
    <p className="text-[13px] leading-relaxed text-muted">
      <span className="text-ink/45">主题</span>
      <span className="mx-1.5 text-ink/25">·</span>
      {tags.map((tag, i) => (
        <span key={tag}>
          {i > 0 ? <span className="text-ink/25"> · </span> : null}
          {tag}
        </span>
      ))}
    </p>
  );
}
