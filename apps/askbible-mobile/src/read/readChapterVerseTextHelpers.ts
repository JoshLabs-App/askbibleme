import type { VerseSpeechPart } from "../bible/verse-annotations";

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
        if (
          isLatinWordConnector(next) &&
          i + 1 < chars.length &&
          isLatinWordChar(chars[i + 1]!)
        ) {
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

export function unitFullySelected(
  unit: HighlightUnit,
  selected: Map<number, string> | null | undefined,
): boolean {
  if (!unit.selectable || !selected?.size) return false;
  for (let i = unit.start; i < unit.end; i += 1) {
    if (!selected.has(i)) return false;
  }
  return true;
}
