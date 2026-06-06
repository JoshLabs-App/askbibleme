export type VerseHighlightMap = Map<number, string>;
export type ChapterHighlightMap = Map<number, VerseHighlightMap>;

export function cloneHighlightMap(input: ChapterHighlightMap): ChapterHighlightMap {
  const out = new Map<number, VerseHighlightMap>();
  for (const [verse, set] of input.entries()) {
    out.set(verse, new Map(set));
  }
  return out;
}

export function countHighlightedChars(input: ChapterHighlightMap): number {
  let total = 0;
  for (const set of input.values()) total += set.size;
  return total;
}

export type HighlightUnit = {
  text: string;
  start: number;
  end: number;
  selectable: boolean;
};

function isHanChar(char: string): boolean {
  return /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/.test(char);
}

function isLatinWordChar(char: string): boolean {
  return /[A-Za-z0-9]/.test(char);
}

function isLatinWordConnector(char: string): boolean {
  return char === "'" || char === "-";
}

/** 与 iOS 一致：中文单字、英文词、标点可单独选中 */
export function tokenizeHighlightUnits(text: string): HighlightUnit[] {
  const chars = text.split("");
  const units: HighlightUnit[] = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (/\s/.test(ch)) {
      const start = i;
      i += 1;
      while (i < chars.length && /\s/.test(chars[i]!)) i += 1;
      units.push({ text: chars.slice(start, i).join(""), start, end: i, selectable: false });
      continue;
    }
    if (isHanChar(ch)) {
      units.push({ text: ch, start: i, end: i + 1, selectable: true });
      i += 1;
      continue;
    }
    if (isLatinWordChar(ch)) {
      const start = i;
      i += 1;
      while (i < chars.length) {
        const next = chars[i]!;
        if (isLatinWordChar(next)) {
          i += 1;
          continue;
        }
        if (isLatinWordConnector(next) && i + 1 < chars.length && isLatinWordChar(chars[i + 1]!)) {
          i += 1;
          continue;
        }
        break;
      }
      units.push({ text: chars.slice(start, i).join(""), start, end: i, selectable: true });
      continue;
    }
    units.push({ text: ch, start: i, end: i + 1, selectable: true });
    i += 1;
  }
  return units;
}

export type VerseSpeechKind = "divine" | "human" | "plain";

export function speechKindsForText(text: string, parts: { kind: string; text: string }[] | null): VerseSpeechKind[] {
  const kinds = new Array<VerseSpeechKind>(text.length).fill("plain");
  if (!parts?.length) return kinds;
  let cursor = 0;
  for (const seg of parts) {
    const segChars = seg.text.split("");
    const kind: VerseSpeechKind =
      seg.kind === "divine" ? "divine" : seg.kind === "human" ? "human" : "plain";
    for (let j = 0; j < segChars.length && cursor + j < kinds.length; j += 1) {
      kinds[cursor + j] = kind;
    }
    cursor += segChars.length;
    if (cursor >= kinds.length) break;
  }
  return kinds;
}
