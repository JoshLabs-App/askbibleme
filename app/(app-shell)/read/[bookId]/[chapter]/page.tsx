import { notFound } from "next/navigation";
import { ReadChapterNav } from "@/components/bible/ReadChapterNav";
import { loadChapterFromDefaultTranslation } from "@/lib/bible/load-chapter-from-default-translation";

type Props = { params: Promise<{ bookId: string; chapter: string }> };

export async function generateMetadata({ params }: Props) {
  const { bookId, chapter } = await params;
  const data = loadChapterFromDefaultTranslation(bookId, Number(chapter));
  if (!data) return { title: "经文" };
  return { title: `${data.bookName} ${data.chapter}` };
}

export default async function ReadChapterPage({ params }: Props) {
  const { bookId, chapter } = await params;
  const ch = Number(chapter);
  if (!Number.isFinite(ch)) notFound();
  const data = loadChapterFromDefaultTranslation(bookId, ch);
  if (!data) notFound();

  return (
    <main className="mx-auto min-h-full w-full max-w-lg flex-1 px-5 pb-28 pt-6 text-ink">
      <ReadChapterNav />
      <h1 className="mt-4 font-serif text-[1.35rem] font-medium tracking-tight text-ink/90">
        {data.bookName}{" "}
        <span className="tabular-nums text-[0.92em] font-normal text-muted">第 {data.chapter} 章</span>
      </h1>
      <p className="mt-1 text-[11px] text-muted">
        {data.labelZh}
        {data.labelEn ? ` · ${data.labelEn}` : ""}
      </p>
      <article className="mt-8 space-y-4 text-[15px] leading-[1.75] text-ink/90">
        {data.verses.map((v) => (
          <p key={v.verse} className="font-serif">
            <span className="mr-1.5 align-top text-[11px] font-sans tabular-nums text-muted">{v.verse}</span>
            {v.text}
          </p>
        ))}
      </article>
    </main>
  );
}
