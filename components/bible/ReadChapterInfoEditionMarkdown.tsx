"use client";

import Link from "next/link";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeInfoEditionCompareMarkdown } from "@/lib/bible/info-edition-v1-format";
import { askbibleReadPath, parseAskbibleReadLink } from "@/lib/bible/parse-askbible-read-link";

const components: Partial<Components> = {
  h1: ({ children }) => (
    <h2 className="read-info-edition-h1">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="read-info-edition-h2">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="read-info-edition-h3">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="read-info-edition-p">{children}</p>
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
    <blockquote className="my-3 space-y-2 border-l-[3px] border-[#A56A2D] py-0.5 pl-3 text-[0.9rem] leading-relaxed text-[#8C562A] dark:border-[#A56A2D] dark:text-[#D8A97A] [&>p]:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-6 border-t border-amber-900/10 dark:border-stone-600/25" />,
  a: ({ href, children }) => {
    const parsed = parseAskbibleReadLink(href ?? "");
    if (parsed) {
      return (
        <Link
          href={askbibleReadPath(parsed)}
          className="read-info-edition-link underline decoration-amber-800/35 underline-offset-2 dark:decoration-stone-500/45"
        >
          {children}
        </Link>
      );
    }
    if (href?.startsWith("/read/")) {
      return (
        <Link
          href={href}
          className="read-info-edition-link underline decoration-amber-800/35 underline-offset-2 dark:decoration-stone-500/45"
        >
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        className="read-info-edition-link underline decoration-amber-800/35 underline-offset-2 dark:decoration-stone-500/45"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    );
  },
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
