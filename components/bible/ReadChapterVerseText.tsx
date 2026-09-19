"use client";

import { useCallback, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import type { VerseSpeechPart } from "@/lib/bible/verse-annotations";
import {
  speechKindsForText,
  tokenizeHighlightUnits,
  type VerseSpeechKind,
} from "@/lib/read/read-verse-highlight-utils";
import { verseTextHighlightStyle } from "@/lib/read/read-verse-text-highlights";
import { ScriptureSearchHighlightedText } from "@/components/bible/ScriptureSearchHighlightedText";

type Props = {
  text: string;
  parts: VerseSpeechPart[] | null;
  highlightedCharIndexes?: Map<number, string> | null;
  highlightEditMode?: boolean;
  activeHighlightColor: string;
  onToggleHighlightUnit?: (start: number, end: number, color: string) => void;
  onPaintHighlightUnit?: (start: number, end: number, mode: "add" | "remove", color: string) => void;
  goldenMark?: boolean;
  bookmarkMark?: boolean;
  /** 跟读高亮：当前正在读的那一句在节正文里的字符区间；null = 不在跟读 */
  audioFollowRange?: { start: number; end: number } | null;
  /** 经文搜索跳入：在节内高亮匹配词 */
  searchKeyword?: string | null;
};

function speechClass(kind: VerseSpeechKind): string {
  if (kind === "divine") return "read-chapter-divine-speech";
  if (kind === "human") return "read-chapter-human-speech";
  return "";
}

function markerClass(_goldenMark?: boolean, bookmarkMark?: boolean): string {
  if (bookmarkMark) return " read-chapter-bookmark-marker";
  return "";
}

function HighlightedSpans({
  text,
  parts,
  highlightedCharIndexes,
  goldenMark,
  bookmarkMark,
  audioFollowRange = null,
}: {
  text: string;
  parts: VerseSpeechPart[] | null;
  highlightedCharIndexes: Map<number, string>;
  goldenMark?: boolean;
  bookmarkMark?: boolean;
  /** 跟读高亮：当前正在读的那一句的字符区间（前闭后开） */
  audioFollowRange?: { start: number; end: number } | null;
}) {
  const kinds = useMemo(() => speechKindsForText(text, parts), [text, parts]);
  const chars = text.split("");
  const following = (i: number) =>
    Boolean(audioFollowRange && i >= audioFollowRange.start && i < audioFollowRange.end);
  const spans: ReactNode[] = [];
  let runStart = 0;
  let runColor = highlightedCharIndexes.get(0) ?? null;
  let runMarked = Boolean(runColor);
  let runFollow = following(0);
  let runKind = kinds[0] ?? "plain";

  for (let i = 1; i <= chars.length; i += 1) {
    const nextColor = i < chars.length ? (highlightedCharIndexes.get(i) ?? null) : null;
    const nextMarked = Boolean(nextColor);
    const nextKind = i < chars.length ? kinds[i]! : "plain";
    const nextFollow = i < chars.length ? following(i) : false;
    const sameRun =
      i < chars.length &&
      nextMarked === runMarked &&
      nextFollow === runFollow &&
      nextKind === runKind &&
      nextColor === runColor;
    if (sameRun) continue;

    const chunk = chars.slice(runStart, i).join("");
    spans.push(
      <span
        key={`${runStart}-${i}`}
        className={[
          speechClass(runKind),
          markerClass(goldenMark && !runMarked, bookmarkMark && !runMarked),
          runMarked ? "read-chapter-verse-text-highlight" : "",
          // 用户划的重点压过跟读：自己划的优先级更高
          !runMarked && runFollow ? "read-chapter-verse-audio-follow" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={runMarked && runColor ? (verseTextHighlightStyle(runColor) as CSSProperties) : undefined}
      >
        {chunk}
      </span>,
    );

    runStart = i;
    runMarked = Boolean(nextMarked);
    runFollow = nextFollow;
    runColor = nextColor;
    runKind = nextKind;
  }

  return <>{spans}</>;
}

function EditModeUnits({
  text,
  parts,
  highlightedCharIndexes,
  activeHighlightColor,
  onToggleHighlightUnit,
  onPaintHighlightUnit,
}: {
  text: string;
  parts: VerseSpeechPart[] | null;
  highlightedCharIndexes: Map<number, string> | null;
  activeHighlightColor: string;
  onToggleHighlightUnit: (start: number, end: number, color: string) => void;
  onPaintHighlightUnit?: (start: number, end: number, mode: "add" | "remove", color: string) => void;
}) {
  const kinds = useMemo(() => speechKindsForText(text, parts), [text, parts]);
  const units = useMemo(() => tokenizeHighlightUnits(text), [text]);
  const dragStateRef = useRef<{
    active: boolean;
    mode: "add" | "remove";
    lastUnit: number;
    seen: Set<number>;
    dragged: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const resolveUnitIndex = useCallback((target: EventTarget | null): number => {
    if (!(target instanceof Element)) return -1;
    const node = target.closest("[data-highlight-unit-index]") as HTMLElement | null;
    if (!node) return -1;
    const n = Number(node.dataset.highlightUnitIndex);
    return Number.isInteger(n) ? n : -1;
  }, []);

  const paintUnitRange = useCallback(
    (startUnitIndex: number, endUnitIndex: number, mode: "add" | "remove") => {
      const step = endUnitIndex > startUnitIndex ? 1 : -1;
      let cursor = startUnitIndex + step;
      while ((step > 0 && cursor <= endUnitIndex) || (step < 0 && cursor >= endUnitIndex)) {
        const unit = units[cursor];
        if (unit?.selectable && !dragStateRef.current?.seen.has(cursor)) {
          if (onPaintHighlightUnit) {
            onPaintHighlightUnit(unit.start, unit.end, mode, activeHighlightColor);
          } else {
            onToggleHighlightUnit(unit.start, unit.end, activeHighlightColor);
          }
          dragStateRef.current?.seen.add(cursor);
        }
        cursor += step;
      }
    },
    [activeHighlightColor, onPaintHighlightUnit, onToggleHighlightUnit, units],
  );

  const beginDrag = useCallback(
    (index: number) => {
      const unit = units[index];
      if (!unit?.selectable) return;
      dragStateRef.current = {
        active: true,
        mode: "add",
        lastUnit: index,
        seen: new Set<number>(),
        dragged: false,
      };
    },
    [units],
  );

  const extendDrag = useCallback(
    (index: number) => {
      const state = dragStateRef.current;
      if (!state?.active || index < 0 || index === state.lastUnit) return;
      const unit = units[index];
      if (!unit?.selectable) return;
      const startUnit = units[state.lastUnit];
      if (!state.dragged && startUnit?.selectable) {
        if (onPaintHighlightUnit) {
          onPaintHighlightUnit(startUnit.start, startUnit.end, state.mode, activeHighlightColor);
        } else {
          onToggleHighlightUnit(startUnit.start, startUnit.end, activeHighlightColor);
        }
        state.seen.add(state.lastUnit);
        state.dragged = true;
      }
      paintUnitRange(state.lastUnit, index, state.mode);
      state.lastUnit = index;
      suppressClickRef.current = true;
    },
    [paintUnitRange, units],
  );

  const finishDrag = useCallback(() => {
    const dragged = dragStateRef.current?.dragged ?? false;
    dragStateRef.current = null;
    if (dragged) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }, []);

  return (
    <span
      className="read-chapter-verse-text-edit-root"
      onPointerMove={(e) => {
        if (!dragStateRef.current?.active) return;
        const index = resolveUnitIndex((document.elementFromPoint(e.clientX, e.clientY) as Element | null));
        extendDrag(index);
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onPointerLeave={finishDrag}
    >
      {units.map((unit, idx) => {
        if (!unit.selectable) {
          return (
            <span key={`ws-${idx}`} className="read-chapter-verse-text-whitespace">
              {unit.text}
            </span>
          );
        }
        let allSelected = true;
        for (let i = unit.start; i < unit.end; i += 1) {
          if (!highlightedCharIndexes?.has(i)) {
            allSelected = false;
            break;
          }
        }
        const color = highlightedCharIndexes?.get(unit.start) ?? activeHighlightColor;
        const kind = kinds[unit.start] ?? "plain";
        return (
          <button
            key={`u-${idx}-${unit.start}`}
            type="button"
            data-highlight-unit-index={idx}
            className={[
              "read-chapter-verse-text-unit",
              speechClass(kind),
              allSelected ? "read-chapter-verse-text-highlight read-chapter-verse-text-unit--selected" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={allSelected ? (verseTextHighlightStyle(color) as CSSProperties) : undefined}
            onPointerDown={(e) => {
              if (!highlightedCharIndexes && !onToggleHighlightUnit && !onPaintHighlightUnit) return;
              beginDrag(idx);
              suppressClickRef.current = false;
            }}
            onPointerEnter={(e) => {
              if (!dragStateRef.current?.active) return;
              if (e.buttons === 0) return;
              extendDrag(idx);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (suppressClickRef.current) {
                e.preventDefault();
                return;
              }
              onToggleHighlightUnit(unit.start, unit.end, activeHighlightColor);
            }}
          >
            {unit.text}
          </button>
        );
      })}
    </span>
  );
}

function SpeechPartsBody({
  parts,
  goldenMark,
  bookmarkMark,
}: {
  parts: VerseSpeechPart[];
  goldenMark?: boolean;
  bookmarkMark?: boolean;
}) {
  const mark = markerClass(goldenMark, bookmarkMark);
  return (
    <>
      {parts.map((seg, si) =>
        seg.kind === "divine" ? (
          <span key={si} className={`read-chapter-divine-speech${mark}`}>
            {seg.text}
          </span>
        ) : seg.kind === "human" ? (
          <span key={si} className={`read-chapter-human-speech${mark}`}>
            {seg.text}
          </span>
        ) : (
          <span key={si} className={mark.trim() || undefined}>
            {seg.text}
          </span>
        ),
      )}
    </>
  );
}

function SearchKeywordBody({
  text,
  keyword,
}: {
  text: string;
  keyword: string;
}) {
  return (
    <ScriptureSearchHighlightedText
      text={text}
      query={keyword}
      highlightClassName="read-chapter-verse-search-keyword"
    />
  );
}

export function ReadChapterVerseText({
  text,
  parts,
  highlightedCharIndexes = null,
  highlightEditMode = false,
  activeHighlightColor,
  onToggleHighlightUnit,
  onPaintHighlightUnit,
  goldenMark = false,
  bookmarkMark = false,
  audioFollowRange = null,
  searchKeyword = null,
}: Props) {
  if (highlightEditMode && onToggleHighlightUnit) {
    return (
      <EditModeUnits
        text={text}
        parts={parts}
        highlightedCharIndexes={highlightedCharIndexes}
        activeHighlightColor={activeHighlightColor}
        onToggleHighlightUnit={onToggleHighlightUnit}
        onPaintHighlightUnit={onPaintHighlightUnit}
      />
    );
  }

  if (searchKeyword) {
    return <SearchKeywordBody text={text} keyword={searchKeyword} />;
  }

  // 跟读高亮也走逐字符分段这条路：没有划重点、只在跟读时同样要分段
  if (highlightedCharIndexes?.size || audioFollowRange) {
    return (
      <HighlightedSpans
        text={text}
        parts={parts}
        highlightedCharIndexes={highlightedCharIndexes ?? new Map()}
        goldenMark={goldenMark}
        bookmarkMark={bookmarkMark}
        audioFollowRange={audioFollowRange}
      />
    );
  }

  if (parts?.length) {
    return <SpeechPartsBody parts={parts} goldenMark={goldenMark} bookmarkMark={bookmarkMark} />;
  }

  return (
    <span className={markerClass(goldenMark, bookmarkMark).trim() || undefined}>{text}</span>
  );
}
