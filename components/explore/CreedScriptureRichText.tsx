import Link from "next/link";
import { parseReadPath } from "@/lib/bible/parse-askbible-read-link";
import { splitCreedReadLinks } from "@/lib/explore/historical-creeds-scripture-links";

type Props = {
  text: string;
  className?: string;
};

export function CreedScriptureRichText({ text, className }: Props) {
  const segments = splitCreedReadLinks(text);

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={index}>{segment.text}</span>;
        }
        const parsed = parseReadPath(segment.href);
        const href =
          parsed != null
            ? `/read/${parsed.bookId}/${parsed.chapter}${parsed.verse != null ? `?verse=${parsed.verse}` : ""}`
            : segment.href;
        return (
          <Link
            key={index}
            href={href}
            className="font-medium text-amber-800/95 underline decoration-amber-700/40 underline-offset-2"
          >
            {segment.text}
          </Link>
        );
      })}
    </span>
  );
}
