"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
};

/**
 * 中间栏 Markdown 渲染：GFM（表格、任务列表、删除线等）+ 阅读向排版。
 */
const components: Partial<Components> = {
  h1: ({ children }) => (
    <h1 className="mb-3 mt-10 border-b border-border/70 pb-2.5 text-[1.25rem] font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2.5 mt-8 text-[1.0625rem] font-semibold tracking-tight text-ink first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 text-[0.975rem] font-semibold text-ink/95 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1.5 mt-5 text-[0.8125rem] font-semibold uppercase tracking-wide text-muted first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-[14px] leading-[1.75] text-ink/88 last:mb-0 [&+ul]:mt-0 [&+ol]:mt-0">
      {children}
    </p>
  ),
  ul: ({ children, className }) => (
    <ul
      className={`mb-4 ml-5 list-disc space-y-1 marker:text-muted/80 [&>li]:pl-0.5 ${className ?? ""}`}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 ml-5 list-decimal space-y-1 marker:text-muted/80 [&>li]:pl-0.5">
      {children}
    </ol>
  ),
  li: ({ children, className }) => (
    <li
      className={`text-[14px] leading-[1.7] text-ink/88 [&>p]:mb-2 [&>p]:last:mb-0 ${className ?? ""}`}
    >
      {children}
    </li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-ink">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-ink/85">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-[3px] border-sand pl-3 text-[13px] italic leading-relaxed text-muted">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-t border-border/80" />,
  a: ({ href, children }) => (
    <a
      href={href}
      className="break-all font-medium text-ink underline decoration-border underline-offset-[3px] hover:decoration-sand"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="my-3 overflow-x-auto rounded-lg border border-border/70 bg-surface/90 px-3 py-2.5 font-mono text-[12px] leading-snug text-ink [&>code]:bg-transparent [&>code]:p-0 [&>code]:ring-0">
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
      <code className="rounded bg-surface px-1 py-px font-mono text-[12px] text-ink/90 ring-1 ring-border/50">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border/70 bg-canvas/40">
      <table className="w-full min-w-[12rem] border-collapse text-left text-[13px] text-ink/90">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border bg-surface/90">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-border/40 last:border-b-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="px-3 py-2 font-semibold text-ink">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 align-top text-ink/88">{children}</td>
  ),
  del: ({ children }) => (
    <del className="text-muted line-through">{children}</del>
  ),
  input: ({ type, checked, disabled }) => {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={Boolean(checked)}
          disabled={disabled ?? true}
          readOnly
          className="mr-2 align-middle accent-ink/70"
          aria-hidden
        />
      );
    }
    return null;
  },
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element -- 用户文档内链图片；外链由浏览器加载
    <img
      src={typeof src === "string" ? src : ""}
      alt={typeof alt === "string" ? alt : ""}
      className="my-4 h-auto max-w-full rounded-md border border-border/60"
      loading="lazy"
    />
  ),
};

export function StudioDocMarkdown({ content }: Props) {
  if (!content.trim()) {
    return (
      <p className="text-[14px] leading-relaxed text-muted/85">
        暂无正文。点「编辑」撰写 Markdown；「阅读」为格式化预览。
      </p>
    );
  }

  return (
    <article className="studio-doc-readable max-w-[52rem] text-[14px] leading-[1.7] text-ink/90 selection:bg-ink/[0.06]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
