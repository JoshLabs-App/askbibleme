import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { ExploreParchmentChrome } from "@/components/explore/ExploreParchmentChrome";
import { ExploreProsePage } from "@/components/explore/ExploreProsePage";
import { LegacyArticleScriptureBody } from "@/components/legacy/LegacyArticleScriptureBody";
import { resolveRequestLocale } from "@/lib/i18n/request-locale";
import { localizeLegacyFigureProfileView, legacyFigureDisplayName } from "@/lib/legacy-figure-locale";
import { readLegacyFigureProfileBySlug } from "@/lib/legacy-figure-preview";
import { sitePageTitle } from "@/lib/site-metadata-defaults";
import { getMessages } from "@/lib/i18n/messages";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const profile = readLegacyFigureProfileBySlug(slug);
  if (!profile) return { title: sitePageTitle("圣经人物库") };
  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  return { title: sitePageTitle(legacyFigureDisplayName(profile, locale)) };
}

export default async function ExploreFigureDetailPage({ params }: Props) {
  const { slug } = await params;
  const profile = readLegacyFigureProfileBySlug(slug);
  if (!profile) notFound();

  const cookieStore = await cookies();
  const headerList = await headers();
  const locale = resolveRequestLocale(cookieStore, headerList.get("accept-language"));
  const view = localizeLegacyFigureProfileView(profile, locale);
  const article = view.article;
  const exploreCopy = getMessages(locale).pages.explore;
  const metaChips = [
    view.periodLabelZh,
    view.lifespanZh,
    view.characterRoleZh,
  ].filter(Boolean);
  const showEnglishSubtitle =
    locale !== "en" && profile.englishName && profile.englishName !== view.displayNameZh;

  return (
    <ExploreParchmentChrome proseScroll>
      <ExploreProsePage className="figure-parchment-page">
        <Link href="/explore/figures" className="explore-prose-back underline">
          {exploreCopy.figuresBack}
        </Link>

        <header className="explore-prose-header text-center">
          <h1 className="explore-prose-title">{view.displayNameZh}</h1>
          {showEnglishSubtitle ? (
            <p className="figure-parchment-period">{profile.englishName}</p>
          ) : null}
          {view.scripturePersonalityZh ? (
            <p className="explore-prose-subtitle">{view.scripturePersonalityZh}</p>
          ) : article?.summary ? (
            <p className="explore-prose-subtitle">{article.summary}</p>
          ) : null}
          {metaChips.length ? (
            <div className="figure-library-detail-meta">
              {metaChips.map((chip) => (
                <span key={chip} className="figure-library-meta-chip">
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </header>

        {article ? (
          <div className="explore-prose-body figure-library-article-body">
            <LegacyArticleScriptureBody content={article.body} locale={locale} variant="explore" />
          </div>
        ) : (
          <p className="figure-parchment-hint">
            {profile.linkedArticleSlug
              ? "档案已绑定文章，但预览数据里未找到正文。"
              : "此人物档案尚未绑定文章正文。"}
          </p>
        )}
      </ExploreProsePage>
    </ExploreParchmentChrome>
  );
}
