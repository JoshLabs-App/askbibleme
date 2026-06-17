import type {
  DivineSpeechInferContext,
  QuoteContinuationState,
  SpeakerInferenceState,
  SpeechHighlightKind,
} from "./divineSpeechTypes";
import type { DivineSpeechSpan } from "./divineSpeechTypes";
import {
  detectAskingDivineCue,
  detectStrongHumanCue,
  shouldTreatQuotedAsDivineByContext,
} from "./divineSpeechCueDetection";
import { findContinuationCloseIndex, findLastUnclosedQuote } from "./divineSpeechQuoteParsingCore";
import {
  coalesceSpeechKinds,
  heuristicLocale,
  intersectSpans,
  mergeDivineSpeechSpans,
  subtractSpans,
} from "./divineSpeechSpanUtils";
import { enAllQuotedSpans, zhAllQuotedSpans } from "./divineSpeechQuoteParsingCore";
import { inferDivineSpeechSpans } from "./inferDivineSpeechCore";

function inferAllQuotedSpeechSpans(text: string, translationId: string): DivineSpeechSpan[] {
  const loc = heuristicLocale(translationId);
  if (!loc) return [];
  const spans = loc === "zh" ? zhAllQuotedSpans(text) : enAllQuotedSpans(text);
  return mergeDivineSpeechSpans(spans).filter((s) => s.start < s.end && s.end <= text.length);
}

export function translationSupportsSpeechHighlight(translationId: string): boolean {
  return heuristicLocale(translationId) != null;
}

function splitVerseSpeechHighlights(
  text: string,
  ctx: DivineSpeechInferContext,
  quoteContinuation: QuoteContinuationState,
  speakerState: SpeakerInferenceState,
): {
  parts: Array<{ kind: SpeechHighlightKind; text: string }>;
  quoteContinuation: QuoteContinuationState;
  speakerState: SpeakerInferenceState;
} {
  if (!translationSupportsSpeechHighlight(ctx.translationId)) {
    return {
      parts: [{ kind: "plain", text }],
      quoteContinuation: null,
      speakerState,
    };
  }
  if (!text.length) {
    return {
      parts: [],
      quoteContinuation: null,
      speakerState: { ...speakerState, pendingDivineReply: false },
    };
  }

  const loc = heuristicLocale(ctx.translationId);
  const kinds: SpeechHighlightKind[] = Array(text.length).fill("plain");
  const divine: DivineSpeechSpan[] = [];
  let nextContinuation: QuoteContinuationState = null;
  let nextSpeakerState: SpeakerInferenceState = { ...speakerState, pendingDivineReply: false };

  if (quoteContinuation) {
    const closeAt = findContinuationCloseIndex(text, quoteContinuation.closeChar);
    const end = closeAt === -1 ? text.length : closeAt + 1;
    for (let i = 0; i < end; i++) {
      kinds[i] = quoteContinuation.kind;
    }
    if (closeAt === -1) {
      return {
        parts: coalesceSpeechKinds(text, kinds),
        quoteContinuation,
        speakerState: {
          ...nextSpeakerState,
          divineDiscourseActive: quoteContinuation.kind === "divine",
        },
      };
    }
  }

  const quoted = inferAllQuotedSpeechSpans(text, ctx.translationId);
  const divineFromTriggers = intersectSpans(inferDivineSpeechSpans(text, ctx), quoted);
  divine.push(...divineFromTriggers);
  const treatQuotedAsDivineByContext = shouldTreatQuotedAsDivineByContext(
    text,
    ctx,
    loc,
    quoted,
    divineFromTriggers,
    speakerState,
  );
  if (treatQuotedAsDivineByContext) {
    divine.push(...quoted);
  }
  const human = subtractSpans(quoted, divine);

  for (const s of human) {
    for (let i = s.start; i < s.end; i++) kinds[i] = "human";
  }
  for (const s of divine) {
    for (let i = s.start; i < s.end; i++) kinds[i] = "divine";
  }

  const unmatched = findLastUnclosedQuote(text);
  if (unmatched) {
    const innerIdx = unmatched.openIndex + 1;
    const k = innerIdx < kinds.length ? kinds[innerIdx] : "plain";
    const continuationKind: Exclude<SpeechHighlightKind, "plain"> = k === "divine" ? "divine" : "human";
    nextContinuation = { kind: continuationKind, closeChar: unmatched.closeChar };
  }

  const hasQuotedSpeech = quoted.length > 0;
  const hasExplicitDivineCue = divineFromTriggers.length > 0;
  const hasAskingDivineCue = detectAskingDivineCue(text, loc);
  const hasStrongHumanCue = detectStrongHumanCue(text, loc);

  const verseDivineSpeech =
    hasQuotedSpeech && (hasExplicitDivineCue || treatQuotedAsDivineByContext || nextContinuation?.kind === "divine");
  nextSpeakerState.divineDiscourseActive = verseDivineSpeech || (speakerState.divineDiscourseActive && !hasStrongHumanCue);
  if (hasStrongHumanCue) {
    nextSpeakerState.divineDiscourseActive = false;
  }
  if (hasAskingDivineCue) {
    nextSpeakerState.pendingDivineReply = true;
  }

  return {
    parts: coalesceSpeechKinds(text, kinds),
    quoteContinuation: nextContinuation,
    speakerState: nextSpeakerState,
  };
}

export function splitTextBySpeechHighlights(
  text: string,
  ctx: DivineSpeechInferContext,
): Array<{ kind: SpeechHighlightKind; text: string }> {
  return splitVerseSpeechHighlights(text, ctx, null, {
    pendingDivineReply: false,
    divineDiscourseActive: false,
  }).parts;
}

export function splitChapterVersesBySpeechHighlights(
  verses: readonly { verse: number; text: string }[],
  base: Omit<DivineSpeechInferContext, "verse">,
): Array<Array<{ kind: SpeechHighlightKind; text: string }>> {
  if (!translationSupportsSpeechHighlight(base.translationId)) {
    return verses.map((v) => [{ kind: "plain", text: v.text }]);
  }
  let quoteContinuation: QuoteContinuationState = null;
  let speakerState: SpeakerInferenceState = {
    pendingDivineReply: false,
    divineDiscourseActive: false,
  };
  const out: Array<Array<{ kind: SpeechHighlightKind; text: string }>> = [];
  for (const v of verses) {
    const ctx = { ...base, verse: v.verse };
    const { parts, quoteContinuation: next, speakerState: nextSpeakerState } = splitVerseSpeechHighlights(
      v.text,
      ctx,
      quoteContinuation,
      speakerState,
    );
    out.push(parts);
    quoteContinuation = next;
    speakerState = nextSpeakerState;
  }
  return out;
}
