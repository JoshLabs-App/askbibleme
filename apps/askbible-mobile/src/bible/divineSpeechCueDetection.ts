import {
  GOSPEL_BOOKS,
  type DivineSpeechInferContext,
  type DivineSpeechSpan,
  type SpeakerInferenceState,
} from "./divineSpeechTypes";
import { startsWithKnownOpenQuote } from "./divineSpeechQuoteParsingCore";

const ZH_PRONOUN_SPEECH_CUE_RE =
  /(?:^|[，。；\s])他(?:就|又)?(?:說|说|回答說|回答说|回答|對[^「」『』“”‘’﹁﹂﹃﹄\n]{0,12}說|对[^「」『』“”‘’﹁﹂﹃﹄\n]{0,12}说|大聲說|大声说|吩咐|講|讲)\s*[:：]?/;
const EN_PRONOUN_SPEECH_CUE_RE =
  /(?:^|[\s,.;])he(?:\s+(?:said|answered|replied|cried|spoke|told(?:\s+\w+)?))\s*:?\s*/i;

const ZH_ASKING_DIVINE_CUE_RE =
  /(?:(?:问|問|对|對|向|求)[^「」『』“”‘’﹁﹂﹃﹄\n]{0,8}(?:耶穌|耶稣|主耶穌|主耶稣|耶和華|耶和华|神|主)|(?:門徒|门徒|眾人|众人|法利賽人|法利赛人|百姓)[^「」『』“”‘’﹁﹂﹃﹄\n]{0,8}(?:问|問)[^「」『』“”‘’﹁﹂﹃﹄\n]{0,6}(?:耶穌|耶稣|主耶穌|主耶稣|耶和華|耶和华|神|主))[^「」『』“”‘’﹁﹂﹃﹄\n]{0,12}(?:說|说|請教|请教|回答|回覆|回复)/;
const EN_ASKING_DIVINE_CUE_RE =
  /(?:asked|said to|spoke to|questioned)\s+(?:jesus|the lord|yahweh|god)\b/i;

const ZH_STRONG_HUMAN_CUE_RE =
  /(?:蛇|女人|婦人|妇人|門徒|门徒|眾人|众人|法利賽人|法利赛人|百姓|彼得|亞伯拉罕|亚伯拉罕|摩西|撒但|魔鬼|他們|他们)[^「」『』“”‘’﹁﹂﹃﹄\n]{0,12}(?:說|说|問|问|回答|大聲說|大声说|吩咐)/;
const EN_STRONG_HUMAN_CUE_RE =
  /(?:the disciples|the crowd|the people|pharisees|the woman|the serpent|peter|they)\b[^"\n]{0,18}(?:said|asked|answered|replied|cried)/i;

export function detectPronounSpeechCue(text: string, loc: "zh" | "en"): boolean {
  return loc === "zh" ? ZH_PRONOUN_SPEECH_CUE_RE.test(text) : EN_PRONOUN_SPEECH_CUE_RE.test(text);
}

export function detectAskingDivineCue(text: string, loc: "zh" | "en" | null): boolean {
  if (!loc) return false;
  return loc === "zh" ? ZH_ASKING_DIVINE_CUE_RE.test(text) : EN_ASKING_DIVINE_CUE_RE.test(text);
}

export function detectStrongHumanCue(text: string, loc: "zh" | "en" | null): boolean {
  if (!loc) return false;
  return loc === "zh" ? ZH_STRONG_HUMAN_CUE_RE.test(text) : EN_STRONG_HUMAN_CUE_RE.test(text);
}

export function shouldTreatQuotedAsDivineByContext(
  text: string,
  ctx: DivineSpeechInferContext,
  loc: "zh" | "en" | null,
  quoted: readonly DivineSpeechSpan[],
  divineFromTriggers: readonly DivineSpeechSpan[],
  state: SpeakerInferenceState,
): boolean {
  if (!quoted.length || !loc) return false;
  if (divineFromTriggers.length > 0) return true;
  if (!GOSPEL_BOOKS.has(ctx.bookId)) return false;
  if (detectStrongHumanCue(text, loc)) return false;

  const startsWithQuote = startsWithKnownOpenQuote(text);
  const hasPronounSpeechCue = detectPronounSpeechCue(text, loc);
  if (state.pendingDivineReply && (hasPronounSpeechCue || startsWithQuote)) return true;
  if (state.divineDiscourseActive && startsWithQuote) return true;
  return false;
}
