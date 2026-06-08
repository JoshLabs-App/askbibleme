import Link from "next/link";
import { notFound } from "next/navigation";
import { LegacyArticleMarkdown } from "@/components/legacy/LegacyArticleMarkdown";
import { ScriptureChrome } from "@/components/scripture/ScriptureChrome";
import { readLegacyCommunityArticleBySlug } from "@/lib/legacy-community-articles";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import "../legacy-articles.css";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const article = readLegacyCommunityArticleBySlug(slug);
  if (!article) return { title: sitePageTitle("旧站文章预览") };
  return {
    title: sitePageTitle(article.title),
    robots: { index: false, follow: false },
  };
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function LegacyArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  const article = readLegacyCommunityArticleBySlug(slug);
  if (!article) notFound();

  return (
    <ScriptureChrome scrollHome>
      <div className="legacy-articles-page legacy-articles-page--detail">
        <nav className="legacy-articles-breadcrumb" aria-label="文章导航">
          <Link href="/dev/legacy-articles" className="legacy-articles-back">
            ← 返回列表
          </Link>
        </nav>

        <header className="legacy-articles-article-header">
          <p className="legacy-articles-eyebrow">{article.columnLabel} · 临时预览</p>
          <h1 className="legacy-articles-article-title">{article.title}</h1>
          <p className="legacy-articles-meta">
            {article.authorName ? <span>{article.authorName}</span> : null}
            {article.updatedAt ? <span>更新于 {formatDate(article.updatedAt)}</span> : null}
          </p>
          {article.summary ? <p className="legacy-articles-summary">{article.summary}</p> : null}
        </header>

        <article className="legacy-articles-body">
          <LegacyArticleMarkdown content={article.body} />
        </article>
      </div>
    </ScriptureChrome>
  );
}
