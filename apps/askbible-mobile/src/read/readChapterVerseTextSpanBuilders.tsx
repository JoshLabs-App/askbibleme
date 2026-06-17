import type { ReactNode } from "react";
import { Text } from "react-native";
import type { VerseSpeechPart } from "../bible/verse-annotations";
import { readChapterVerseTextStyles as styles } from "./readChapterVerseTextStyles";

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
}): ReactNode[] {
  const { text, parts, highlightedCharIndexes, activeHighlightColor } = args;
  const chars = text.split("");
  if (!chars.length) return [];
  const kinds = buildSpeechKindsByCharIndex(text, parts);

  const spans: ReactNode[] = [];
  let runStart = 0;
  let runColor = highlightedCharIndexes.get(0) ?? null;
  let runMarked = Boolean(runColor);
  let runKind = kinds[0];

  for (let i = 1; i <= chars.length; i += 1) {
    const nextColor = i < chars.length ? (highlightedCharIndexes.get(i) ?? null) : null;
    const nextMarked = Boolean(nextColor);
    const nextKind = i < chars.length ? kinds[i] : null;
    const sameRun =
      i < chars.length && nextMarked === runMarked && nextKind === runKind && nextColor === runColor;
    if (sameRun) continue;

    const chunk = chars.slice(runStart, i).join("");
    const kindStyle = runKind ? speechSegmentStyle(runKind) : undefined;
    spans.push(
      <Text
        key={`h:${runStart}-${i}:${runMarked ? "m" : "n"}:${runKind ?? "none"}`}
        style={[
          kindStyle,
          runMarked && styles.savedHighlight,
          runMarked && { backgroundColor: runColor ?? activeHighlightColor },
        ]}
      >
        {chunk}
      </Text>,
    );

    runStart = i;
    runMarked = Boolean(nextMarked);
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
