import type { ReactNode } from "react";
import { Text } from "react-native";
import type { VerseSpeechPart } from "../bible/verse-annotations";
import { readChapterVerseTextStyles as styles } from "./readChapterVerseTextStyles";
import { READ_PARCHMENT_COLOR_MODE } from "./readParchmentTheme";
import { verseTextHighlightFill } from "./read-verse-text-highlights";

export function speechSegmentStyle(kind: VerseSpeechPart["kind"]) {
  if (kind === "divine") return styles.divine;
  if (kind === "human") return styles.human;
  return undefined;
}

export function buildSpeechKindsByCharIndex(
  text: string,
  parts: VerseSpeechPart[] | null,
): Array<VerseSpeechPart["kind"] | null> {
  const chars = text.split("");
  const kinds = new Array<VerseSpeechPart["kind"] | null>(chars.length).fill(null);
  if (!parts?.length) return kinds;
  let cursor = 0;
  for (const seg of parts) {
    const segChars = seg.text.split("");
    for (let i = 0; i < segChars.length && cursor + i < kinds.length; i += 1) {
      kinds[cursor + i] = seg.kind;
    }
    cursor += segChars.length;
    if (cursor >= kinds.length) break;
  }
  return kinds;
}

export function buildHighlightedCharSpans(args: {
  text: string;
  parts: VerseSpeechPart[] | null;
  highlightedCharIndexes: Map<number, string>;
  activeHighlightColor: string;
  /** 跟读高亮：当前正在读的那一句的字符区间（前闭后开）；null = 不在跟读 */
  audioFollowRange?: { start: number; end: number } | null;
}): ReactNode[] {
  const { text, parts, highlightedCharIndexes, activeHighlightColor, audioFollowRange } = args;
  const chars = text.split("");
  if (!chars.length) return [];
  const kinds = buildSpeechKindsByCharIndex(text, parts);
  const following = (i: number) =>
    Boolean(audioFollowRange && i >= audioFollowRange.start && i < audioFollowRange.end);

  const spans: ReactNode[] = [];
  let runStart = 0;
  let runColor = highlightedCharIndexes.get(0) ?? null;
  let runMarked = Boolean(runColor);
  let runFollow = following(0);
  let runKind = kinds[0];

  for (let i = 1; i <= chars.length; i += 1) {
    const nextColor = i < chars.length ? (highlightedCharIndexes.get(i) ?? null) : null;
    const nextMarked = Boolean(nextColor);
    const nextFollow = i < chars.length ? following(i) : false;
    const nextKind = i < chars.length ? kinds[i] : null;
    const sameRun =
      i < chars.length &&
      nextMarked === runMarked &&
      nextFollow === runFollow &&
      nextKind === runKind &&
      nextColor === runColor;
    if (sameRun) continue;

    const chunk = chars.slice(runStart, i).join("");
    const kindStyle = runKind ? speechSegmentStyle(runKind) : undefined;
    spans.push(
      <Text
        key={`h:${runStart}-${i}:${runMarked ? "m" : "n"}${runFollow ? "f" : ""}:${runKind ?? "none"}`}
        style={[
          kindStyle,
          runMarked && styles.savedHighlight,
          runMarked && {
            backgroundColor: verseTextHighlightFill(
              runColor ?? activeHighlightColor,
              READ_PARCHMENT_COLOR_MODE === "dark",
            ),
          },
          // 用户划的重点压过跟读：自己划的优先级更高
          !runMarked && runFollow && styles.audioFollow,
        ]}
      >
        {chunk}
      </Text>,
    );

    runStart = i;
    runMarked = Boolean(nextMarked);
    runFollow = nextFollow;
    runColor = nextColor;
    runKind = nextKind;
  }

  return spans;
}

export function buildSpeechSegments(parts: VerseSpeechPart[] | null) {
  return parts?.map((seg, i) => (
    <Text key={i} style={speechSegmentStyle(seg.kind)}>
      {seg.text}
    </Text>
  ));
}
