export type DivineSpeechSpan = { start: number; end: number };

export const DIVINE_SPEECH_PILOT_CHAPTERS: readonly { bookId: string; chapter: number }[] = [
  { bookId: "GEN", chapter: 1 },
  { bookId: "EXO", chapter: 20 },
  { bookId: "JHN", chapter: 3 },
];

export type DivineSpeechInferContext = {
  translationId: string;
  bookId: string;
  chapter: number;
  verse: number;
};

export type SpeechHighlightKind = "plain" | "divine" | "human";

export const GOSPEL_BOOKS = new Set(["MAT", "MRK", "LUK", "JHN"]);

export type QuoteContinuationState = {
  kind: Exclude<SpeechHighlightKind, "plain">;
  closeChar: string;
} | null;

export type SpeakerInferenceState = {
  pendingDivineReply: boolean;
  divineDiscourseActive: boolean;
};

export const ZH_CLOSE_QUOTES = ["」", "』", "﹂", "﹄"] as const;

export const QUOTE_PAIRS = new Map<string, string>([
  ["「", "」"],
  ["『", "』"],
  ["“", "”"],
  ["‘", "’"],
  ["﹁", "﹂"],
  ["﹃", "﹄"],
  ['"', '"'],
]);

export const OPEN_QUOTES = new Set<string>(QUOTE_PAIRS.keys());

export const ZH_QUOTE_PAIRS = new Map<string, string>([
  ["「", "」"],
  ["『", "』"],
  ["“", "”"],
  ["‘", "’"],
  ["﹁", "﹂"],
  ["﹃", "﹄"],
]);
