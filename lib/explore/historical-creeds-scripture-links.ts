export type { CreedReadLinkSegment } from "./creed-scripture-rich-text-shared";

export {
  CREED_READ_LINK_RE,
  splitCreedReadLinks,
  formatWcfProofCitationLineAsLinks,
  formatWcfProofItem,
  parseProofBlockText,
  parseWcfProofCitationLine,
  splitDoctrineAndInlineProofs,
  extractInlineProofTail,
  linkifyNormalizedChineseRefs,
  linkifyWcfCompactRefs,
} from "./historical-creeds-scripture-links.mjs";
