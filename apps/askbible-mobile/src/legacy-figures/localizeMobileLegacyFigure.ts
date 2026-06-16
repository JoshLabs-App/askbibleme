import type { AppLocale } from "../i18n/config";
import { localizeZhText } from "../i18n/site-copy";
import type { MobileLegacyFigureProfile, MobileLegacyFigureTimelineEntry } from "./mobileLegacyFiguresCore";
import { getMobileLegacyFigureProfileById } from "./mobileLegacyFiguresCore";

const CHARACTER_ROLE_EN: Record<string, string> = {
  主人物: "Primary character",
  相关人物: "Related figure",
};

export function resolveMobileLegacyFigureView(
  profile: MobileLegacyFigureProfile,
  locale: AppLocale,
): MobileLegacyFigureProfile {
  if (locale === "en" && profile.en) {
    const en = profile.en;
    return {
      ...profile,
      displayNameZh: en.displayName || profile.englishName || profile.displayNameZh,
      scripturePersonalityZh: en.scripturePersonality ?? profile.scripturePersonalityZh,
      periodLabelZh: en.periodLabel ?? profile.periodLabelZh,
      lifespanZh: en.lifespan ?? profile.lifespanZh,
      characterRoleZh: en.characterRole ?? CHARACTER_ROLE_EN[profile.characterRoleZh ?? ""] ?? profile.characterRoleZh,
      article: en.article
        ? {
            ...(profile.article ?? {
              slug: profile.linkedArticleSlug || profile.slug,
            }),
            title: en.article.title,
            summary: en.article.summary,
            body: en.article.body,
          }
        : profile.article,
    };
  }

  if (locale === "en") {
    return {
      ...profile,
      displayNameZh: profile.englishName || profile.displayNameZh,
      characterRoleZh:
        CHARACTER_ROLE_EN[profile.characterRoleZh ?? ""] ?? profile.characterRoleZh,
    };
  }

  return {
    ...profile,
    displayNameZh: localizeZhText(locale, profile.displayNameZh),
    scripturePersonalityZh: profile.scripturePersonalityZh
      ? localizeZhText(locale, profile.scripturePersonalityZh)
      : profile.scripturePersonalityZh,
    periodLabelZh: profile.periodLabelZh
      ? localizeZhText(locale, profile.periodLabelZh)
      : profile.periodLabelZh,
    lifespanZh: profile.lifespanZh ? localizeZhText(locale, profile.lifespanZh) : profile.lifespanZh,
    characterRoleZh: profile.characterRoleZh
      ? localizeZhText(locale, profile.characterRoleZh)
      : profile.characterRoleZh,
    article: profile.article
      ? {
          ...profile.article,
          title: localizeZhText(locale, profile.article.title),
          summary: localizeZhText(locale, profile.article.summary),
          body: localizeZhText(locale, profile.article.body),
        }
      : profile.article,
  };
}

export function mobileLegacyFigureDisplayName(
  figure: Pick<MobileLegacyFigureTimelineEntry, "id" | "displayNameZh" | "englishName">,
  locale: AppLocale,
): string {
  const full = getMobileLegacyFigureProfileById(figure.id);
  if (full) return resolveMobileLegacyFigureView(full, locale).displayNameZh;
  if (locale === "en") return figure.englishName || figure.displayNameZh;
  return localizeZhText(locale, figure.displayNameZh);
}
