"use client";

import Link from "next/link";
import { ExploreProsePage } from "@/components/explore/ExploreProsePage";
import { LegacyArticleScriptureBody } from "@/components/legacy/LegacyArticleScriptureBody";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMobileLegacyFigureProfile } from "@/hooks/useMobileLegacyFigureProfile";
import type { AppLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import type { LegacyFigureProfile } from "@/lib/legacy-figure-preview";

type Props = {
  slug: string;
  initialProfile: LegacyFigureProfile;
  locale: AppLocale;
};

export function ExploreFigureDetailClient({ slug, initialProfile, locale: localeProp }: Props) {
  const { locale: clientLocale } = useLocale();
  const locale = clientLocale ?? localeProp;
  const view = useMobileLegacyFigureProfile(slug, initialProfile);
  const article = view.article;
  const exploreCopy = getMessages(locale).pages.explore;
  const metaChips = [view.periodLabelZh, view.lifespanZh, view.characterRoleZh].filter(Boolean);
  const showEnglishSubtitle =
    locale !== "en" && view.englishName && view.englishName !== view.displayNameZh;

  return (
    <ExploreProsePage className="figure-parchment-page">
      <Link href="/explore/figures" className="explore-prose-back underline">
        {exploreCopy.figuresBack}
      </Link>

      <header className="explore-prose-header text-center">
        <h1 className="explore-prose-title">{view.displayNameZh}</h1>
        {showEnglishSubtitle ? (
          <p className="figure-parchment-period">{view.englishName}</p>
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
          {view.linkedArticleSlug
            ? locale === "en"
              ? "Profile is linked to an article, but body text is not in the preview bundle."
              : locale === "zh-TW"
                ? "檔案已綁定文章，但預覽數據裡未找到正文。"
                : "档案已绑定文章，但预览数据里未找到正文。"
            : locale === "en"
              ? "This profile has no article body yet."
              : locale === "zh-TW"
                ? "此人物檔案尚未綁定文章正文。"
                : "此人物档案尚未绑定文章正文。"}
        </p>
      )}
    </ExploreProsePage>
  );
}
