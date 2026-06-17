import type { AppLocale } from "../i18n/config";
import { localizeZhText } from "../i18n/site-copy";
import {
  legacyFigureCharacterRoleEn,
  resolveLegacyFigureEnglishDisplayName,
} from "./legacyFigureEnglishDisplayName";
import type { MobileLegacyFigureProfile, MobileLegacyFigureTimelineEntry } from "./mobileLegacyFiguresCore";
import { getMobileLegacyFigureProfileById } from "./mobileLegacyFiguresCore";

export function resolveMobileLegacyFigureView(
  profile: MobileLegacyFigureProfile,
  locale: AppLocale,
): MobileLegacyFigureProfile {
  if (locale === "en") {
    const en = profile.en;
    const displayNameZh = resolveLegacyFigureEnglishDisplayName(
      profile.englishName,
      en?.displayName,
      profile.displayNameZh,
    );
    if (en) {
      return {
        ...profile,
        displayNameZh,
        scripturePersonalityZh: en.scripturePersonality ?? profile.scripturePersonalityZh,
        periodLabelZh: en.periodLabel ?? profile.periodLabelZh,
        lifespanZh: en.lifespan ?? profile.lifespanZh,
        characterRoleZh:
          en.characterRole ?? legacyFigureCharacterRoleEn(profile.characterRoleZh) ?? profile.characterRoleZh,
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
    return {
      ...profile,
      displayNameZh,
      characterRoleZh:
        legacyFigureCharacterRoleEn(profile.characterRoleZh) ?? profile.characterRoleZh,
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
  if (locale === "en") {
    return resolveLegacyFigureEnglishDisplayName(figure.englishName, undefined, figure.displayNameZh);
  }
  return localizeZhText(locale, figure.displayNameZh);
}
