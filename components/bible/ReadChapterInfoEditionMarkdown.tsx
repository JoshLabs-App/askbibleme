"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeInfoEditionCompareMarkdown } from "@/lib/bible/info-edition-v1-format";

const components: Partial<Components> = {
  h1: ({ children }) => (
    <h2 className="read-info-edition-h1 mb-2.5 text-balance text-[0.98rem] font-semibold leading-snug tracking-tight text-amber-950/95 dark:text-stone-100">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="read-info-edition-h2 mb-2 mt-5 border-b border-amber-900/12 pb-1 text-[0.9rem] font-semibold text-amber-950/92 dark:border-stone-600/30 dark:text-stone-100/95">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="read-info-edition-h3 mb-1 mt-3.5 text-[0.8125rem] font-semibold text-amber-950/88 dark:text-stone-200/92">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-2.5 text-[0.875rem] leading-[1.72] text-amber-950/82 dark:text-stone-300/88 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2.5 ml-4 list-disc space-y-1 text-[0.875rem] leading-[1.68] marker:text-amber-800/40 dark:marker:text-stone-500/55">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2.5 ml-4 list-decimal space-y-1 text-[0.875rem] leading-[1.68] marker:text-amber-800/40 dark:marker:text-stone-500/55">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-amber-950/80 dark:text-stone-300/85">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-amber-950/95 dark:text-stone-100">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 space-y-2 border-l-2 border-amber-800/25 py-0.5 pl-3 text-[0.9rem] leading-relaxed text-amber-900/75 dark:border-stone-500/35 dark:text-stone-300/85 [&>p]:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-t border-amber-900/10 dark:border-stone-600/25" />,
};

export function ReadChapterInfoEditionMarkdown({ content }: { content: string }) {
  const trimmed = normalizeInfoEditionCompareMarkdown(content);
  if (!trimmed) return null;
  return (
    <div className="read-chapter-info-edition-md select-text">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
