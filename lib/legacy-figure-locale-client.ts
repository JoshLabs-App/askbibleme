import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import {
  legacyFigureCharacterRoleEn,
  resolveLegacyFigureEnglishDisplayName,
} from "@/lib/legacy-figure-english-display-name";
import type { LegacyFigureArticle, LegacyFigureProfile } from "@/lib/legacy-figure-preview";

export function legacyFigureDisplayNameClient(
  profile: Pick<LegacyFigureProfile, "displayNameZh" | "englishName">,
  locale: AppLocale,
): string {
  if (locale === "en") {
    return resolveLegacyFigureEnglishDisplayName(
      profile.englishName,
      undefined,
      profile.displayNameZh,
    );
  }
  if (locale === "zh-TW") return toZhTwText(profile.displayNameZh);
  return profile.displayNameZh;
}

/** Client-safe locale view (no disk EN bundle; mobile refresh supplies EN article text). */
export function localizeLegacyFigureProfileViewClient(
  profile: LegacyFigureProfile,
  locale: AppLocale,
): LegacyFigureProfile {
  if (locale === "en") {
    return {
      ...profile,
      displayNameZh: resolveLegacyFigureEnglishDisplayName(
        profile.englishName,
        undefined,
        profile.displayNameZh,
      ),
      characterRoleZh:
        legacyFigureCharacterRoleEn(profile.characterRoleZh) ?? profile.characterRoleZh,
    };
  }

  const localize = (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text);
  const article: LegacyFigureArticle | null = profile.article
    ? {
        ...profile.article,
        title: localize(profile.article.title),
        summary: localize(profile.article.summary),
        body: localize(profile.article.body),
      }
    : null;

  return {
    ...profile,
    displayNameZh: localize(profile.displayNameZh),
    scripturePersonalityZh: profile.scripturePersonalityZh
      ? localize(profile.scripturePersonalityZh)
      : profile.scripturePersonalityZh,
    periodLabelZh: profile.periodLabelZh ? localize(profile.periodLabelZh) : profile.periodLabelZh,
    lifespanZh: profile.lifespanZh ? localize(profile.lifespanZh) : profile.lifespanZh,
    characterRoleZh: profile.characterRoleZh ? localize(profile.characterRoleZh) : profile.characterRoleZh,
    article,
  };
}
