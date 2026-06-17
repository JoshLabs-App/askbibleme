import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { ExploreArticleScriptureContent } from "@/components/explore/ExploreArticleScriptureContent";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import {
  readExploreFeaturedArticleBySlug,
  readExploreFeaturedArticleSlugs,
} from "@/lib/explore/explore-featured-articles";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { sitePageTitle } from "@/lib/site-metadata-defaults";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return readExploreFeaturedArticleSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const article = readExploreFeaturedArticleBySlug(slug, locale);
  if (!article) return { title: sitePageTitle("文章") };
  return { title: sitePageTitle(article.title) };
}

export default async function ExploreArticlePage({ params }: Props) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const article = readExploreFeaturedArticleBySlug(slug, locale);
  if (!article) notFound();

  return (
    <ExploreParchmentChrome>
      <ExploreArticleScriptureContent article={article} locale={locale} />
    </ExploreParchmentChrome>
  );
}
