import { notFound } from "next/navigation";
import { ReadChapterPageClient } from "@/components/bible/ReadChapterPageClient";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

/**
 * 读经章页：静态壳。
 *
 * 这里不读 cookie / headers / searchParams，也不读文件——语言、译本偏好、`?verse=` `?q=`、
 * 经文与交叉引用全部由浏览器端取（见 ReadChapterPageClient）。这样 CDN 可以缓存整页，
 * 不再每次现渲染（此前线上 `cache-control: private, no-store`，首字节约 1.7s），
 * 也不再依赖服务端 fs，为迁到边缘运行时（Cloudflare）扫清最大的一块障碍。
 * 页面标题在客户端按界面语言更新；这里的标题是默认语言兜底。
 */
type Props = {
  params: Promise<{ bookId: string; chapter: string }>;
};

function resolveChapter(bookId: string, chapterRaw: string): { bookId: string; chapter: number } | null {
  const id = String(bookId || "").trim().toUpperCase();
  const chapter = Number(chapterRaw);
  const book = scriptureBooks.find((b) => b.bookId === id);
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null;
  return { bookId: id, chapter };
}

/** 全部 1189 章构建期预渲染成静态 HTML（壳很小，内容由浏览器取）。 */
export function generateStaticParams() {
  return scriptureBooks.flatMap((book) =>
    Array.from({ length: book.chapters }, (_, i) => ({ bookId: book.bookId, chapter: String(i + 1) })),
  );
}

/** 只认构建期列出的章；其余（如 /read/JHN/99）直接 404，不在运行时现渲染。 */
export const dynamicParams = false;

export async function generateMetadata({ params }: Props) {
  const { bookId, chapter } = await params;
  const resolved = resolveChapter(bookId, chapter);
  if (!resolved) return { title: sitePageTitle("经文") };
  return {
    title: sitePageTitle(
      `${getScriptureBookDisplayName(resolved.bookId, DEFAULT_LOCALE)} ${resolved.chapter}`,
    ),
  };
}

export default async function ReadChapterPage({ params }: Props) {
  const { bookId, chapter } = await params;
  const resolved = resolveChapter(bookId, chapter);
  if (!resolved) notFound();
  return <ReadChapterPageClient bookId={resolved.bookId} chapter={resolved.chapter} />;
}
