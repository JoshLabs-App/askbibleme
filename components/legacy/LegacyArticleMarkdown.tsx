"use client";

import Link from "next/link";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askbibleReadPath, parseAskbibleReadLink } from "@/lib/bible/parse-askbible-read-link";

const READ_CHAPTER_PATH = /^\/read\/([A-Za-z0-9]{2,5})\/(\d+)(?:\?verse=(\d+))?$/;

function buildComponents(
  linkScriptureRefs: boolean,
  variant: "default" | "explore",
): Partial<Components> {
  const explore = variant === "explore";

  return {
    h1: ({ children }) => (
      <h1 className={explore ? "explore-prose-h1 first:mt-0" : "mb-4 font-serif text-[clamp(1.35rem,3.5vw,1.75rem)] font-medium leading-snug tracking-[0.02em] text-ink/92 first:mt-0"}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2
        className={
          explore
            ? "explore-prose-h2 first:mt-0"
            : "mb-3 mt-8 border-b border-ink/10 pb-2 font-serif text-[1.15rem] font-medium tracking-[0.02em] text-ink/88 first:mt-0"
        }
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={explore ? "explore-prose-h3 first:mt-0" : "mb-2 mt-6 text-[1rem] font-semibold text-ink/86 first:mt-0"}>
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4
        className={
          explore
            ? "explore-prose-h4 first:mt-0"
            : "mb-1.5 mt-4 text-[14px] font-medium uppercase tracking-[0.08em] text-ink/62 first:mt-0"
        }
      >
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p
        className={
          explore
            ? "explore-prose-p last:mb-0 [&+ul]:mt-0 [&+ol]:mt-0"
            : "mb-4 text-[15px] leading-[1.8] text-ink/78 last:mb-0 [&+ul]:mt-0 [&+ol]:mt-0"
        }
      >
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul
        className={
          explore
            ? "explore-prose-ul marker:text-[#a56a2d]/55"
            : "mb-4 ml-5 list-disc space-y-2 text-[15px] leading-[1.75] text-ink/78 marker:text-ink/35"
        }
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={
          explore
            ? "explore-prose-ol marker:text-[#8b5a2b]/70"
            : "mb-4 ml-5 list-decimal space-y-2 text-[15px] leading-[1.75] text-ink/78 marker:text-ink/45"
        }
      >
        {children}
      </ol>
    ),
    li: ({ children }) => <li className={explore ? "explore-prose-li" : "pl-1"}>{children}</li>,
    strong: ({ children }) => (
      <strong className={explore ? "explore-prose-strong" : "font-semibold text-ink/90"}>{children}</strong>
    ),
    em: ({ children }) => <em className={explore ? "explore-prose-em" : "italic text-ink/82"}>{children}</em>,
    blockquote: ({ children }) => (
      <blockquote className={explore ? "explore-prose-blockquote" : "my-5 border-l-2 border-ink/20 py-1 pl-4 text-[15px] leading-[1.75] text-ink/68"}>
        {children}
      </blockquote>
    ),
    hr: () => (explore ? <hr className="explore-prose-hr" /> : <hr className="my-8 border-ink/10" />),
    a: ({ href, children }) => {
      if (linkScriptureRefs) {
        const parsed = parseAskbibleReadLink(href ?? "");
        if (parsed) {
          return (
            <Link href={askbibleReadPath(parsed)} className={explore ? "explore-prose-link" : "font-medium text-ink/88 underline decoration-ink/35 underline-offset-4 transition hover:text-ink"}>
              {children}
            </Link>
          );
        }
        if (href && READ_CHAPTER_PATH.test(href)) {
          return (
            <Link href={href} className={explore ? "explore-prose-link" : "font-medium text-ink/88 underline decoration-ink/35 underline-offset-4 transition hover:text-ink"}>
              {children}
            </Link>
          );
        }
      }
      return (
        <a
          href={href}
          className={explore ? "explore-prose-link" : "underline decoration-ink/25 underline-offset-4 transition hover:text-ink/92"}
          target={href?.startsWith("http") ? "_blank" : undefined}
          rel={href?.startsWith("http") ? "noreferrer" : undefined}
        >
          {children}
        </a>
      );
    },
    code: ({ className: codeClass, children }) => {
      const isBlock = typeof codeClass === "string" && /language-/.test(codeClass);
      if (isBlock) return <code className={codeClass}>{children}</code>;
      return (
        <code className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[13px] text-ink/85">
          {children}
        </code>
      );
    },
    pre: ({ children }) => (
      <pre className="my-4 overflow-x-auto rounded-lg border border-ink/10 bg-ink/[0.03] p-4 font-mono text-[13px] leading-relaxed text-ink/82">
        {children}
      </pre>
    ),
  };
}

export function LegacyArticleMarkdown({
  content,
  linkScriptureRefs = false,
  variant = "default",
}: {
  content: string;
  linkScriptureRefs?: boolean;
  variant?: "default" | "explore";
}) {
  const trimmed = content.trim();
  if (!trimmed) return null;
  const components = buildComponents(linkScriptureRefs, variant);
  return (
    <div className="legacy-article-md min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {trimmed}
      </ReactMarkdown>
    </div>
  );
}
