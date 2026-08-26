import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type { MobileLegacyFigureProfile } from "@/lib/explore/legacy-figures-mobile-bundle-types";
import {
  legacyFigureCharacterRoleEn,
  resolveLegacyFigureEnglishDisplayName,
} from "@/lib/legacy-figure-english-display-name";

/** 对齐 App `resolveMobileLegacyFigureView`。 */
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

  const localize = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  return {
    ...profile,
    displayNameZh: localize(profile.displayNameZh),
    scripturePersonalityZh: profile.scripturePersonalityZh
      ? localize(profile.scripturePersonalityZh)
      : profile.scripturePersonalityZh,
    periodLabelZh: profile.periodLabelZh ? localize(profile.periodLabelZh) : profile.periodLabelZh,
    lifespanZh: profile.lifespanZh ? localize(profile.lifespanZh) : profile.lifespanZh,
    characterRoleZh: profile.characterRoleZh ? localize(profile.characterRoleZh) : profile.characterRoleZh,
    article: profile.article
      ? {
          ...profile.article,
          title: localize(profile.article.title),
          summary: localize(profile.article.summary),
          body: localize(profile.article.body),
        }
      : profile.article,
  };
}
