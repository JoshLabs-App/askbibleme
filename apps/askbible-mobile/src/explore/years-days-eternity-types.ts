export type YearsDaysEternityProseBlock = {
  type: "prose";
  lines: string[];
};

export type YearsDaysEternityScriptureBlock = {
  type: "scripture";
  lines: string[];
  ref: string;
};

export type YearsDaysEternityDividerBlock = {
  type: "divider";
};

export type YearsDaysEternityBlock =
  | YearsDaysEternityProseBlock
  | YearsDaysEternityScriptureBlock
  | YearsDaysEternityDividerBlock;

export type YearsDaysEternitySection = {
  id: string;
  title: string;
  blocks: YearsDaysEternityBlock[];
};

export type YearsDaysEternityFinale = {
  leadLines: string[];
  scripture: YearsDaysEternityScriptureBlock;
};

export type YearsDaysEternityDocument = {
  pageTitle: string;
  intro: YearsDaysEternityBlock[];
  sections: YearsDaysEternitySection[];
  closing: YearsDaysEternityBlock[];
  finale: YearsDaysEternityFinale;
  encouragement: YearsDaysEternityScriptureBlock;
};
