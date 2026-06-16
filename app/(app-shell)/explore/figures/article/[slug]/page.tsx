import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { ExploreProsePage } from "@/components/explore/ExploreProsePage";
import { LegacyArticleScriptureBody } from "@/components/legacy/LegacyArticleScriptureBody";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { localizeLegacyFigureArticle } from "@/lib/legacy-figure-locale";
import { readLegacyFigureEnBlockBySlug } from "@/lib/legacy-figure-articles-en-bundle";
import { readLegacyFigureOrphanArticleBySlug } from "@/lib/legacy-figure-preview";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import { getMessages } from "@/lib/i18n/messages";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const article = readLegacyFigureOrphanArticleBySlug(slug);
  if (!article) return { title: sitePageTitle("圣经人物库") };
  return { title: sitePageTitle(article.title) };
}

export default async function ExploreFigureOrphanArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = readLegacyFigureOrphanArticleBySlug(slug);
  if (!article) notFound();

  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const enBlock = readLegacyFigureEnBlockBySlug(slug);
  let view = localizeLegacyFigureArticle(article, locale);
  if (locale === "en" && enBlock?.article) {
    view = { ...view, ...enBlock.article };
  }
  const exploreCopy = getMessages(locale).pages.explore;

  return (
    <ExploreParchmentChrome proseScroll>
      <ExploreProsePage className="figure-parchment-page">
        <Link href="/explore/figures" className="explore-prose-back underline">
          {exploreCopy.figuresBack}
        </Link>

        <header className="explore-prose-header text-center">
          <h1 className="explore-prose-title">{view.title}</h1>
          {view.summary ? (
            <p className="explore-prose-subtitle">{view.summary}</p>
          ) : null}
        </header>

        <div className="explore-prose-body figure-library-article-body">
          <LegacyArticleScriptureBody content={view.body} locale={locale} variant="explore" />
        </div>
      </ExploreProsePage>
    </ExploreParchmentChrome>
  );
}
