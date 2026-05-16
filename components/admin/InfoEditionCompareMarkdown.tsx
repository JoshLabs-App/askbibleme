"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeInfoEditionCompareMarkdown } from "@/lib/bible/info-edition-v1-format";

const components: Partial<Components> = {
  h1: ({ children }) => (
    <h1 className="mb-2 text-[14px] font-semibold leading-snug tracking-tight text-adminFg first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 border-b border-adminLine/50 pb-1 text-[12px] font-semibold text-adminFg first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2.5 text-[11px] font-semibold text-adminFg/95 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-0.5 mt-2 text-[10px] font-medium uppercase tracking-wide text-adminMuted first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-2 text-[12px] leading-relaxed text-adminFg/92 last:mb-0 [&+ul]:mt-0 [&+ol]:mt-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-3.5 list-disc space-y-0.5 text-[12px] marker:text-adminMuted/80">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-3.5 list-decimal space-y-0.5 text-[12px] marker:text-adminMuted/80">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed text-adminFg/88">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-adminFg">{children}</strong>,
  em: ({ children }) => <em className="italic text-adminFg/85">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-adminFg/25 py-0.5 pl-2.5 text-[11px] leading-relaxed text-adminMuted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-t border-adminLine/60" />,
  code: ({ className: codeClass, children }) => {
    const isBlock = typeof codeClass === "string" && /language-/.test(codeClass);
    if (isBlock) return <code className={codeClass}>{children}</code>;
    return (
      <code className="rounded bg-adminFg/[0.06] px-1 py-px font-mono text-[10px] text-adminFg/90">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded border border-adminLine/70 bg-adminBg/80 p-2 font-mono text-[10px] leading-snug text-adminFg">
      {children}
    </pre>
  ),
};

export function InfoEditionCompareMarkdown({ content }: { content: string }) {
  const trimmed = normalizeInfoEditionCompareMarkdown(content);
  if (!trimmed) return null;
  return (
    <div className="info-edition-compare-md min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
