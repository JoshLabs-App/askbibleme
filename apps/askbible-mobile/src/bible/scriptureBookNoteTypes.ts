export type ScriptureBookSpiritualFrame = {
  divine: string;
  human: string;
  invitation: string;
};

export type ScriptureBookNote = {
  bookId: string;
  stageId: string;
  groupId: string;
  spiritualFrame: ScriptureBookSpiritualFrame;
  summary: string;
  keywords?: string[];
  imageHint?: string;
};
