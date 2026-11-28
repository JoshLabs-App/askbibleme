import type { ReactNode } from "react";

export interface SimpleMarkdownProps {
  markdown: string;
  onOpenReader?: (bookId: string, chapter: number) => void;
}

function parseReadLink(href: string): { bookId: string; chapter: number } | null {
  const m = href.match(/^\/read\/([A-Za-z0-9]+)(?:\/(\d+))?/);
  if (!m) return null;
  const bookId = m[1].toUpperCase();
  const ch = m[2] ? Number(m[2]) : 1;
  return { bookId, chapter: Number.isFinite(ch) && ch > 0 ? ch : 1 };
}

function renderInline(
  text: string,
  onOpenReader?: (bookId: string, chapter: number) => void,
): ReactNode[] {
  const parts: ReactNode[] = [];
  const tokenRe = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const label = linkMatch[1];
        const href = linkMatch[2].trim();
        const readTarget = parseReadLink(href);
        if (readTarget && onOpenReader) {
          parts.push(
            <button
              key={`rd-${keyIdx++}`}
              type="button"
              className="ab-inline-link"
              onClick={() => onOpenReader(readTarget.bookId, readTarget.chapter)}
            >
              {label}
            </button>,
          );
        } else if (/^https?:\/\//i.test(href)) {
          parts.push(
            <a
              key={`a-${keyIdx++}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="ab-inline-link"
            >
              {label}
            </a>,
          );
        } else {
          parts.push(label);
        }
      } else {
        parts.push(token);
      }
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={`b-${keyIdx++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={`i-${keyIdx++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={`c-${keyIdx++}`} className="ab-inline-code">
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = tokenRe.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/**
 * 轻量安全 Markdown 渲染器（零 dangerouslySetInnerHTML，支持站内经文直跳与羊皮卷样式令牌）
 */
export function SimpleMarkdown({ markdown, onOpenReader }: SimpleMarkdownProps) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let keyIdx = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${keyIdx++}`} className="ab-divider" />);
      i += 1;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${keyIdx++}`} className="ab-md-h3">
          {renderInline(trimmed.slice(4), onOpenReader)}
        </h3>,
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${keyIdx++}`} className="ab-md-h2">
          {renderInline(trimmed.slice(3), onOpenReader)}
        </h2>,
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${keyIdx++}`} className="ab-md-h1">
          {renderInline(trimmed.slice(2), onOpenReader)}
        </h1>,
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote key={`bq-${keyIdx++}`} className="ab-verse-quote">
          {quoteLines.map((ql, idx) => (
            <p key={idx} className="ab-md-p" style={{ marginBottom: idx === quoteLines.length - 1 ? 0 : 6 }}>
              {renderInline(ql, onOpenReader)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${keyIdx++}`} className="ab-md-list">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, onOpenReader)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${keyIdx++}`} className="ab-md-list">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, onOpenReader)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(?:#{1,3}\s|>|---|[-*]\s|\d+\.\s)/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`p-${keyIdx++}`} className="ab-md-p">
        {renderInline(paraLines.join(" "), onOpenReader)}
      </p>,
    );
  }

  return <div className="ab-md">{blocks}</div>;
}
