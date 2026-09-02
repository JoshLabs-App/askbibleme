import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type {
  YearsDaysEternityBlock,
  YearsDaysEternityDocument,
  YearsDaysEternityScriptureBlock,
  YearsDaysEternitySection,
} from "./years-days-eternity-types";

function zhTwBlock(block: YearsDaysEternityBlock): YearsDaysEternityBlock {
  if (block.type === "divider") return block;
  if (block.type === "scripture") {
    return { ...block, lines: block.lines.map(toZhTwText), ref: toZhTwText(block.ref) };
  }
  return { ...block, lines: block.lines.map(toZhTwText) };
}

function zhTwScriptureBlock(block: YearsDaysEternityScriptureBlock): YearsDaysEternityScriptureBlock {
  return { ...block, lines: block.lines.map(toZhTwText), ref: toZhTwText(block.ref) };
}

function zhTwSection(section: YearsDaysEternitySection): YearsDaysEternitySection {
  return {
    ...section,
    title: toZhTwText(section.title),
    blocks: section.blocks.map(zhTwBlock),
  };
}

/**
 * Converts every user-facing string in a zh-CN document to zh-TW, in one pass, so a field added
 * to YearsDaysEternityDocument later is covered automatically instead of needing a new call site
 * (this replaces a prior fix that only converted the page's caption and left the title/prose/
 * section titles/scripture text on the same page simplified).
 */
export function applyZhTwToYearsDaysEternityDocument(
  doc: YearsDaysEternityDocument,
): YearsDaysEternityDocument {
  return {
    pageTitle: toZhTwText(doc.pageTitle),
    intro: doc.intro.map(zhTwBlock),
    sections: doc.sections.map(zhTwSection),
    closing: doc.closing.map(zhTwBlock),
    finale: {
      leadLines: doc.finale.leadLines.map(toZhTwText),
      scripture: zhTwScriptureBlock(doc.finale.scripture),
    },
    encouragement: zhTwScriptureBlock(doc.encouragement),
  };
}
