import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import {
  readLegacyFigureEnBlockById,
  type LegacyFigureEnProfileBlock,
} from "@/lib/legacy-figure-articles-en-bundle";
import type { LegacyFigureArticle, LegacyFigureProfile } from "@/lib/legacy-figure-preview";
import {
  resolveLegacyFigureEnglishDisplayName,
  legacyFigureCharacterRoleEn,
} from "@/lib/legacy-figure-english-display-name";

export { resolveLegacyFigureEnglishDisplayName } from "@/lib/legacy-figure-english-display-name";

function localizeCharacterRoleZh(text: string, locale: AppLocale): string {
  if (locale === "en") return legacyFigureCharacterRoleEn(text) ?? text;
  if (locale === "zh-TW") return toZhTwText(text);
  return text;
}

function applyEnBlock(
  profile: LegacyFigureProfile,
  en: LegacyFigureEnProfileBlock,
): LegacyFigureProfile {
  const article: LegacyFigureArticle | null = en.article
    ? {
        ...(profile.article ?? {
          slug: profile.linkedArticleSlug || profile.slug,
          authorName: "AskBible",
          updatedAt: "",
        }),
        title: en.article.title,
        summary: en.article.summary,
        body: en.article.body,
      }
    : profile.article;

  return {
    ...profile,
    displayNameZh: resolveLegacyFigureEnglishDisplayName(
      profile.englishName,
      en.displayName,
      profile.displayNameZh,
    ),
    scripturePersonalityZh: en.scripturePersonality ?? profile.scripturePersonalityZh,
    periodLabelZh: en.periodLabel ?? profile.periodLabelZh,
    lifespanZh: en.lifespan ?? profile.lifespanZh,
    characterRoleZh: en.characterRole ?? localizeCharacterRoleZh(profile.characterRoleZh, "en"),
    article,
  };
}

export function legacyFigureDisplayName(
  profile: Pick<LegacyFigureProfile, "id" | "displayNameZh" | "englishName">,
  locale: AppLocale,
): string {
  if (locale === "en") {
    const en = readLegacyFigureEnBlockById(profile.id);
    return resolveLegacyFigureEnglishDisplayName(
      profile.englishName,
      en?.displayName,
      profile.displayNameZh,
    );
  }
  if (locale === "zh-TW") return toZhTwText(profile.displayNameZh);
  return profile.displayNameZh;
}

export function localizeLegacyFigureArticle(
  article: LegacyFigureArticle,
  locale: AppLocale,
  profileId?: string,
): LegacyFigureArticle {
  if (locale === "en" && profileId) {
    const en = readLegacyFigureEnBlockById(profileId);
    if (en?.article) {
      return {
        ...article,
        title: en.article.title,
        summary: en.article.summary,
        body: en.article.body,
      };
    }
  }
  if (locale !== "zh-TW") return article;
  return {
    ...article,
    title: toZhTwText(article.title),
    summary: toZhTwText(article.summary),
    body: toZhTwText(article.body),
  };
}

export function localizeLegacyFigureProfileView(
  profile: LegacyFigureProfile,
  locale: AppLocale,
): LegacyFigureProfile {
  if (locale === "en") {
    const en = readLegacyFigureEnBlockById(profile.id);
    if (en) return applyEnBlock(profile, en);
    return {
      ...profile,
      displayNameZh: resolveLegacyFigureEnglishDisplayName(
        profile.englishName,
        undefined,
        profile.displayNameZh,
      ),
      characterRoleZh: localizeCharacterRoleZh(profile.characterRoleZh, locale),
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
      ? localizeLegacyFigureArticle(profile.article, locale, profile.id)
      : null,
  };
}

export function localizeLegacyFigureProfilesForLocale(
  profiles: LegacyFigureProfile[],
  locale: AppLocale,
): LegacyFigureProfile[] {
  return profiles.map((profile) => localizeLegacyFigureProfileView(profile, locale));
}
