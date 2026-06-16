import type { AppLocale } from "../i18n/config";
import { toZhTwText } from "../i18n/site-copy";
import { getExploreModulesContent } from "./exploreModuleContent";
import type {
  YearsDaysEternityBlock,
  YearsDaysEternityDocument,
  YearsDaysEternityScriptureBlock,
} from "./years-days-eternity-types";

export function getYearsDaysEternityZh(): YearsDaysEternityDocument {
  return getExploreModulesContent().yearsDaysEternity.zh;
}

export function getYearsDaysEternityEn(): YearsDaysEternityDocument {
  return getExploreModulesContent().yearsDaysEternity.en;
}

function localizeEternityScriptureBlock(block: YearsDaysEternityScriptureBlock): YearsDaysEternityScriptureBlock {
  return {
    ...block,
    lines: block.lines.map((line) => toZhTwText(line)),
    ref: toZhTwText(block.ref),
  };
}

function localizeEternityBlock(block: YearsDaysEternityBlock): YearsDaysEternityBlock {
  if (block.type === "scripture") return localizeEternityScriptureBlock(block);
  if (block.type === "prose") {
    return { ...block, lines: block.lines.map((line) => toZhTwText(line)) };
  }
  return block;
}

export function resolveYearsDaysEternityDocument(locale: AppLocale): YearsDaysEternityDocument {
  if (locale === "en") return getYearsDaysEternityEn();
  const zh = getYearsDaysEternityZh();
  if (locale !== "zh-TW") return zh;
  return {
    pageTitle: toZhTwText(zh.pageTitle),
    intro: zh.intro.map(localizeEternityBlock),
    sections: zh.sections.map((section) => ({
      ...section,
      title: toZhTwText(section.title),
      blocks: section.blocks.map(localizeEternityBlock),
    })),
    closing: zh.closing.map(localizeEternityBlock),
    finale: {
      leadLines: zh.finale.leadLines.map((line) => toZhTwText(line)),
      scripture: localizeEternityScriptureBlock(zh.finale.scripture),
    },
    encouragement: localizeEternityScriptureBlock(zh.encouragement),
  };
}