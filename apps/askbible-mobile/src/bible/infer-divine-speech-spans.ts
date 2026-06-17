/**
 * 与仓库根目录 `lib/bible/infer-divine-speech-spans.ts` 保持同步。
 * 试点：自动推断「神 / 主耶稣直接发言」在节内的字符区间。
 */

export type { DivineSpeechInferContext, DivineSpeechSpan, SpeechHighlightKind } from "./divineSpeechTypes";

export { isDivineSpeechPilotChapter, inferDivineSpeechSpans, inferAllQuotedSpeechSpans } from "./inferDivineSpeechCore";

export { splitTextByDivineSpeechSpans } from "./divineSpeechSpanUtils";

export {
  splitChapterVersesBySpeechHighlights,
  splitTextBySpeechHighlights,
  translationSupportsSpeechHighlight,
} from "./divineSpeechHighlightSplit";
