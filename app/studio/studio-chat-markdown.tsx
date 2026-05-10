"use client";

import ReactMarkdown from "react-markdown";

type Props = {
  content: string;
  className?: string;
};

/**
 * Studio 右侧助理气泡：把 Markdown 渲染为安静、易扫读的排版（标题 / 列表 / 代码）。
 */
export function StudioChatMarkdown({ content, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mb-1.5 mt-3 border-b border-border/50 pb-1 text-[13px] font-semibold tracking-tight text-ink first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1 mt-2.5 text-[12px] font-semibold text-ink/95 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-2 text-[11px] font-semibold text-violet-900/85 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-2 text-[11px] leading-relaxed text-ink/92 last:mb-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 ml-3 list-disc space-y-1 text-[11px] text-ink/90 marker:text-muted">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 ml-3 list-decimal space-y-1 text-[11px] text-ink/90 marker:text-muted">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed [&>p]:mb-0">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-ink/85">{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-sand pl-2.5 text-[11px] italic leading-relaxed text-muted">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-border/70" />,
          a: ({ href, children }) => (
            <a
              href={href}
              className="break-all text-[11px] text-ink underline decoration-border underline-offset-2 hover:decoration-sand"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          pre: ({ children }) => (
            <pre className="mb-2 mt-1 overflow-x-auto rounded-lg border border-border/60 bg-canvas px-2.5 py-2 font-mono text-[10px] leading-snug text-ink [&>code]:rounded-none [&>code]:bg-transparent [&>code]:p-0 [&>code]:ring-0">
              {children}
            </pre>
          ),
          code: ({ className: codeClass, children }) => {
            const isBlock =
              typeof codeClass === "string" && /language-/.test(codeClass);
            if (isBlock) {
              return <code className={codeClass}>{children}</code>;
            }
            return (
              <code className="rounded bg-canvas px-1 py-px font-mono text-[10px] text-ink/90 ring-1 ring-border/40">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
