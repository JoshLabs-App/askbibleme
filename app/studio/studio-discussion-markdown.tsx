"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
};

/**
 * 右侧 AI 讨论区「可以这样走」正文：GFM + 侧栏阅读向排版（层级、列表、引用、分隔线）。
 */
const components: Partial<Components> = {
  h2: ({ children }) => (
    <h2 className="mb-2 mt-4 text-[0.8125rem] font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-3 text-[0.75rem] font-semibold text-ink/95 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-2.5 text-[13px] leading-relaxed text-ink/90 last:mb-0 [&+ul]:mt-0 [&+ol]:mt-0">
      {children}
    </p>
  ),
  ul: ({ children, className }) => (
    <ul
      className={`mb-3 ml-4 list-disc space-y-1 text-[13px] marker:text-muted/75 [&>li]:pl-0.5 ${className ?? ""}`}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 ml-4 list-decimal space-y-1 text-[13px] marker:text-muted/75 [&>li]:pl-0.5">
      {children}
    </ol>
  ),
  li: ({ children, className }) => (
    <li
      className={`leading-relaxed text-ink/88 [&>p]:mb-1.5 [&>p]:last:mb-0 ${className ?? ""}`}
    >
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-ink/85">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2.5 border-l-[3px] border-sand/90 bg-canvas/40 py-1 pl-3 text-[12.5px] leading-relaxed text-ink/82 [&>p]:mb-2 [&>p]:last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-t border-border/60" />,
  a: ({ href, children }) => (
    <a
      href={href}
      className="break-all font-medium text-ink underline decoration-border underline-offset-2 hover:decoration-sand"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  code: ({ className: codeClass, children }) => {
    const isBlock =
      typeof codeClass === "string" && /language-/.test(codeClass);
    if (isBlock) {
      return <code className={codeClass}>{children}</code>;
    }
    return (
      <code className="rounded bg-surface px-1 py-px font-mono text-[11px] text-ink/90 ring-1 ring-border/45">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2.5 overflow-x-auto rounded-md border border-border/65 bg-surface/85 px-2.5 py-2 font-mono text-[11px] leading-snug text-ink [&>code]:bg-transparent [&>code]:p-0">
      {children}
    </pre>
  ),
};

export function StudioDiscussionMarkdown({ content }: Props) {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  return (
    <div className="discussion-markdown text-[13px] leading-relaxed text-ink/90 selection:bg-ink/[0.06]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
