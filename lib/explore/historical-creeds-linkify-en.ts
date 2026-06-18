import { linkifyExploreArticleScriptureRefsEn as linkifyArticleScriptureRefsEn } from "./linkify-explore-article-scripture-refs-en";

const EN_BOOK_ABBREV_NORMALIZE: Array<[RegExp, string]> = [
  [/\b1\s*Cor(?:inthians)?\.?\s+/gi, "1 Corinthians "],
  [/\b2\s*Cor(?:inthians)?\.?\s+/gi, "2 Corinthians "],
  [/\b1\s*Thess(?:alonians)?\.?\s+/gi, "1 Thessalonians "],
  [/\b2\s*Thess(?:alonians)?\.?\s+/gi, "2 Thessalonians "],
  [/\b1\s*Tim(?:othy)?\.?\s+/gi, "1 Timothy "],
  [/\b2\s*Tim(?:othy)?\.?\s+/gi, "2 Timothy "],
  [/\b1\s*Pet(?:er)?\.?\s+/gi, "1 Peter "],
  [/\b2\s*Pet(?:er)?\.?\s+/gi, "2 Peter "],
  [/\b1\s*John\s+/gi, "1 John "],
  [/\b2\s*John\s+/gi, "2 John "],
  [/\b3\s*John\s+/gi, "3 John "],
  [/\bGen(?:esis)?\.?\s+/gi, "Genesis "],
  [/\bEx(?:odus)?\.?\s+/gi, "Exodus "],
  [/\bDeut(?:eronomy)?\.?\s+/gi, "Deuteronomy "],
  [/\bPs(?:alms?)?\.?\s+/gi, "Psalms "],
  [/\bMatt(?:hew)?\.?\s+/gi, "Matthew "],
  [/\bRom(?:ans)?\.?\s+/gi, "Romans "],
  [/\bRev(?:elation)?\.?\s+/gi, "Revelation "],
  [/\bHeb(?:rews)?\.?\s+/gi, "Hebrews "],
  [/\bCol(?:ossians)?\.?\s+/gi, "Colossians "],
  [/\bPhil(?:ippians)?\.?\s+/gi, "Philippians "],
  [/\bMic(?:ah)?\.?\s+/gi, "Micah "],
  [/\bGal(?:atians)?\.?\s+/gi, "Galatians "],
];

function normalizeEnglishCreedScriptureAbbrevs(text: string): string {
  let t = String(text);
  for (const [pattern, replacement] of EN_BOOK_ABBREV_NORMALIZE) {
    t = t.replace(pattern, replacement);
  }
  return t;
}

/** English historical-creed bodies: Romans 3:19, (1 John 4:9; John 3:16), 1 Cor. 2:2, etc. */
export function linkifyHistoricalCreedEnglishRefs(text: string): string {
  return linkifyArticleScriptureRefsEn(normalizeEnglishCreedScriptureAbbrevs(text));
}
