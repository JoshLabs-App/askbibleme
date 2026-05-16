import type { ReactNode } from "react";

/** 文章内联：中间点分隔，无药丸边框 */
export function PrayerThemeTags({ tags }: { tags: string[] }): ReactNode {
  if (!tags.length) return null;
  return (
    <p className="prayer-muted text-[0.82em] leading-relaxed">
      <span className="opacity-70">主题</span>
      <span className="mx-1.5 opacity-35">·</span>
      {tags.map((tag, i) => (
        <span key={tag}>
          {i > 0 ? <span className="opacity-35"> · </span> : null}
          {tag}
        </span>
      ))}
    </p>
  );
}
