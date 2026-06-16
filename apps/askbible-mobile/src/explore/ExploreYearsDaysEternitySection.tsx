import { useEffect, useMemo, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { InteractionManager, Pressable, StyleSheet, Text, View } from "react-native";
import { loadChapterFromBundledTranslation } from "../bible/load-chapter";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { scriptureBooks } from "../bible/scripture-books";
import type { AppLocale } from "../i18n/config";
import { useLocale } from "../i18n/LocaleProvider";
import { localizeZhText } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { getYearsDaysEternityEn, getYearsDaysEternityZh, resolveYearsDaysEternityDocument } from "./years-days-eternity-content";
import {
  filterEternityProse,
  filterEternityScriptures,
  formatScriptureBlockBody,
} from "./years-days-eternity-blocks";
import { getRedemptionTimelineCaption } from "./years-days-eternity-redemption-eras";
import type {
  YearsDaysEternityFinale,
  YearsDaysEternityScriptureBlock,
} from "./years-days-eternity-types";
import { exploreStyles as shared } from "./exploreParchmentStyles";

type RefVersePart = { chapter: number; start: number; end: number };

function parseZhRefParts(ref: string): { bookId: string; parts: RefVersePart[] } | null {
  const normalized = ref.replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(.+?)\s+(\d+):(.+)$/);
  if (!m) return null;
  const bookName = m[1]?.trim();
  const baseChapter = Number(m[2]);
  const tail = m[3]?.trim() ?? "";
  if (!bookName || !Number.isInteger(baseChapter) || baseChapter < 1 || !tail) return null;
  const bookId = scriptureBooks.find((b) => b.bookName === bookName)?.bookId;
  if (!bookId) return null;
  const parts: RefVersePart[] = [];
  const segments = tail.split(",").map((x) => x.trim()).filter(Boolean);
  for (const seg of segments) {
    let chapter = baseChapter;
    let verseSpec = seg;
    if (seg.includes(":")) {
      const cm = seg.match(/^(\d+):(.+)$/);
      if (!cm) continue;
      chapter = Number(cm[1]);
      verseSpec = cm[2]?.trim() ?? "";
    }
    if (!Number.isInteger(chapter) || chapter < 1 || !verseSpec) continue;
    const rm = verseSpec.match(/^(\d+)-(\d+)$/);
    if (rm) {
      const start = Number(rm[1]);
      const end = Number(rm[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
        parts.push({ chapter, start, end });
      }
      continue;
    }
    const single = Number(verseSpec);
    if (Number.isInteger(single) && single >= 1) {
      parts.push({ chapter, start: single, end: single });
    }
  }
  if (!parts.length) return null;
  return { bookId, parts };
}

function formatRefPart(part: RefVersePart): string {
  return part.start === part.end ? `${part.start}` : `${part.start}-${part.end}`;
}

function localizeRefLabel(rawRef: string, locale: AppLocale): string {
  if (locale === "en") {
    const parsed = parseZhRefParts(rawRef);
    if (!parsed) return rawRef;
    const book = getScriptureBookDisplayName(parsed.bookId, locale);
    if (!book) return rawRef;
    const uniqueChapters = Array.from(new Set(parsed.parts.map((p) => p.chapter)));
    if (uniqueChapters.length === 1) {
      const chapter = uniqueChapters[0];
      const spec = parsed.parts.map((p) => formatRefPart(p)).join(",");
      return `${book} ${chapter}:${spec}`;
    }
    const spec = parsed.parts.map((p) => `${p.chapter}:${formatRefPart(p)}`).join(", ");
    return `${book} ${spec}`;
  }
  return localizeZhText(locale, rawRef);
}

function formatLoadedVerses(lines: string[]): string {
  const cleaned = lines.map((line) => line.trim()).filter((line) => line.length > 0);
  return cleaned.join(" ");
}

async function loadEternityEnScriptureBodiesForRefs(
  refs: string[],
): Promise<Record<string, string>> {
  const chapterCache = new Map<
    string,
    Awaited<ReturnType<typeof loadChapterFromBundledTranslation>>
  >();
  const next: Record<string, string> = {};

  for (const ref of refs) {
    const parsed = parseZhRefParts(ref);
    if (!parsed) continue;
    const lines: string[] = [];
    for (const part of parsed.parts) {
      const chapterKey = `${parsed.bookId}:${part.chapter}`;
      if (!chapterCache.has(chapterKey)) {
        try {
          const loaded = await loadChapterFromBundledTranslation(
            parsed.bookId,
            part.chapter,
            "web-en",
          );
          chapterCache.set(chapterKey, loaded);
        } catch {
          chapterCache.set(chapterKey, null);
        }
      }
      const loaded = chapterCache.get(chapterKey);
      if (!loaded) continue;
      for (const verse of loaded.verses) {
        if (verse.verse >= part.start && verse.verse <= part.end) {
          lines.push(verse.text);
        }
      }
    }
    if (lines.length > 0) next[ref] = formatLoadedVerses(lines);
  }
  return next;
}

function stripSectionTitlePrefix(title: string): string {
  return title
    .replace(/^\s*\d+\s*[\.\)、]\s*/, "")
    .replace(/^\s*[一二三四五六七八九十]+\s*[、.]\s*/, "")
    .trim();
}

function ProseBlock({ lines, center }: { lines: string[]; center?: boolean }) {
  return (
    <View style={[styles.proseBlock, center && styles.proseBlockCenter]}>
      {lines.map((line, i) => (
        <Text key={i} style={[styles.proseLine, center && styles.proseLineCenter]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function CompactScriptureFlow({
  scriptures,
  bodyOverrideByRef,
  refOverrideByRef,
}: {
  scriptures: YearsDaysEternityScriptureBlock[];
  bodyOverrideByRef?: Record<string, string>;
  refOverrideByRef?: Record<string, string>;
}) {
  if (scriptures.length === 0) return null;
  return (
    <View style={styles.scriptureFlowCol}>
      {scriptures.map((block, i) => (
        <View key={`${block.ref}-${i}`} style={styles.scripturePassage}>
          <Text style={styles.scriptureFlow}>
            {bodyOverrideByRef?.[block.ref] ?? formatScriptureBlockBody(block.lines)}
          </Text>
          <Text style={styles.scriptureRefLine}>— {refOverrideByRef?.[block.ref] ?? block.ref}</Text>
        </View>
      ))}
    </View>
  );
}

function EncouragementSection({ scripture }: { scripture: YearsDaysEternityScriptureBlock }) {
  return (
    <View style={styles.encouragement}>
      <View style={styles.encouragementRule} />
      <View style={styles.encouragementScripture}>
        {scripture.lines.map((line, i) => (
          <Text key={i} style={styles.encouragementVerseLine}>
            {line}
          </Text>
        ))}
        <Text style={styles.encouragementRefLine}>— {scripture.ref}</Text>
      </View>
    </View>
  );
}

function ClosingFinaleSection({ finale }: { finale: YearsDaysEternityFinale }) {
  const { leadLines, scripture } = finale;
  return (
    <View style={styles.finale}>
      <View style={styles.finaleRule} />
      <View style={styles.finaleInner}>
        <View style={styles.finaleLead}>
          {leadLines.map((line, i) => (
            <Text key={i} style={styles.finaleLeadLine}>
              {line}
            </Text>
          ))}
        </View>
        <View style={styles.finaleScripture}>
          {scripture.lines.map((line, i) => (
            <Text key={i} style={styles.finaleVerseLine}>
              {line}
            </Text>
          ))}
          <Text style={styles.finaleRefLine}>— {scripture.ref}</Text>
        </View>
      </View>
    </View>
  );
}

export function ExploreYearsDaysEternitySection() {
  const { locale } = useLocale();
  const screenFocused = useIsFocused();
  const doc = locale === "en" ? getYearsDaysEternityEn() : resolveYearsDaysEternityDocument(locale);
  const [enScriptureBodyByRef, setEnScriptureBodyByRef] = useState<Record<string, string>>({});
  const [expandedCategoryIndex, setExpandedCategoryIndex] = useState<number | null>(null);
  const [accordionReady, setAccordionReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setAccordionReady(true));
    return () => task.cancel();
  }, []);

  const fullScriptureSections = useMemo(() => {
    if (locale !== "en") return doc.sections;
    const sourceById = new Map(getYearsDaysEternityZh().sections.map((section) => [section.id, section]));
    return doc.sections.map((section) => {
      const source = sourceById.get(section.id);
      if (!source) return section;
      return { ...section, blocks: source.blocks };
    });
  }, [doc.sections, locale]);

  const localizedRefByRaw = useMemo(() => {
    if (locale === "zh-CN") return {};
    const rows = fullScriptureSections
      .flatMap((section) => filterEternityScriptures(section.blocks))
      .map((block) => [block.ref, localizeRefLabel(block.ref, locale)] as const);
    return Object.fromEntries(rows) as Record<string, string>;
  }, [fullScriptureSections, locale]);

  useEffect(() => {
    setEnScriptureBodyByRef({});
    setExpandedCategoryIndex(null);
  }, [locale]);

  useEffect(() => {
    if (!screenFocused || locale !== "en" || expandedCategoryIndex === null) return;
    const section = fullScriptureSections[expandedCategoryIndex];
    if (!section) return;

    const refs = filterEternityScriptures(section.blocks).map((block) => block.ref);
    if (refs.length === 0) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadEternityEnScriptureBodiesForRefs(refs).then((loaded) => {
        if (cancelled || !screenFocused) return;
        setEnScriptureBodyByRef((prev) => {
          const merged = { ...prev };
          let changed = false;
          for (const [ref, text] of Object.entries(loaded)) {
            if (merged[ref] == null) {
              merged[ref] = text;
              changed = true;
            }
          }
          return changed ? merged : prev;
        });
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [expandedCategoryIndex, fullScriptureSections, locale, screenFocused]);

  const timelineCaption = getRedemptionTimelineCaption(locale);

  return (
    <View style={styles.section}>
      <View style={shared.yearDayCountRelatedDivider} />
      <Text style={styles.pageTitle}>{doc.pageTitle}</Text>
      <Text style={styles.eyebrow}>{timelineCaption}</Text>
      <View style={shared.yearDayCountRule} />

      <View style={styles.closing}>
        {filterEternityProse(doc.closing).map((lines, i) => (
          <ProseBlock key={i} lines={lines} center />
        ))}
      </View>

      <ClosingFinaleSection finale={doc.finale} />

      {accordionReady ? (
        <View style={styles.accordionList}>
          {fullScriptureSections.map((section, index) => (
            <View key={section.id} style={styles.accordionItem}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setExpandedCategoryIndex((current) => (current === index ? null : index));
                }}
                style={({ pressed }) => [styles.accordionHeader, pressed && styles.accordionHeaderPressed]}
              >
                <View style={styles.headerTextWrap}>
                  <Text style={styles.sectionIndexText}>{String(index + 1)}.</Text>
                  <Text style={styles.sectionTitle}>{stripSectionTitlePrefix(section.title)}</Text>
                </View>
                <Text style={styles.sectionChevron}>{expandedCategoryIndex === index ? "−" : "+"}</Text>
              </Pressable>
              {expandedCategoryIndex === index ? (
                <View style={styles.accordionBody}>
                  <CompactScriptureFlow
                    scriptures={filterEternityScriptures(section.blocks)}
                    bodyOverrideByRef={locale === "en" ? enScriptureBodyByRef : undefined}
                    refOverrideByRef={localizedRefByRaw}
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <EncouragementSection scripture={doc.encouragement} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
  },
  eyebrow: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "center",
  },
  pageTitle: {
    fontSize: 22,
    ...parchmentSans(600),
    letterSpacing: -0.3,
    lineHeight: 28,
    color: c.ink,
    textAlign: "center",
    marginTop: 24,
  },
  closing: {
    marginTop: 20,
    paddingTop: 2,
  },
  finale: {
    marginTop: 24,
    paddingTop: 4,
    paddingBottom: 4,
    alignItems: "center",
  },
  finaleRule: {
    marginBottom: 22,
    height: StyleSheet.hairlineWidth,
    width: 56,
    backgroundColor: c.borderStrong,
    alignSelf: "center",
  },
  finaleInner: {
    width: "100%",
    maxWidth: 360,
    paddingHorizontal: 6,
    gap: 18,
  },
  finaleLead: {
    gap: 4,
    alignItems: "center",
  },
  finaleLeadLine: {
    fontSize: 16,
    lineHeight: 26,
    ...parchmentSans(600),
    color: c.ink,
    textAlign: "center",
    letterSpacing: 0.05,
  },
  finaleScripture: {
    gap: 6,
    paddingTop: 2,
  },
  finaleVerseLine: {
    fontSize: 16,
    lineHeight: 28,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "center",
    letterSpacing: 0.02,
  },
  finaleRefLine: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "center",
    letterSpacing: 0.08,
  },
  proseBlock: {
    marginTop: 10,
    gap: 6,
  },
  proseBlockCenter: {
    alignItems: "center",
  },
  proseLine: {
    fontSize: 15,
    lineHeight: 24,
    ...parchmentSans(500),
    color: c.muted,
  },
  proseLineCenter: {
    textAlign: "center",
  },
  accordionList: {
    marginTop: 36,
    gap: 10,
  },
  accordionItem: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: c.chapterCellBorder,
    backgroundColor: c.chapterCell,
    overflow: "hidden",
  },
  accordionHeader: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  accordionHeaderPressed: {
    backgroundColor: c.hover,
  },
  headerTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  sectionIndexText: {
    fontSize: 16,
    lineHeight: 22,
    ...parchmentSans(700),
    color: c.parchmentAccent,
  },
  sectionTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 24,
    ...parchmentSans(700),
    color: c.parchmentAccent,
  },
  sectionChevron: {
    fontSize: 22,
    lineHeight: 24,
    ...parchmentSans(700),
    color: c.parchmentAccent,
    width: 18,
    textAlign: "center",
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
  },
  scriptureFlowCol: {
    gap: 12,
  },
  scripturePassage: {
    gap: 2,
  },
  scriptureFlow: {
    fontSize: 16,
    lineHeight: 24,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "left",
  },
  scriptureRefLine: {
    fontSize: 12,
    lineHeight: 17,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "right",
    letterSpacing: 0.06,
  },
  encouragement: {
    marginTop: 32,
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: "center",
  },
  encouragementRule: {
    marginBottom: 20,
    height: StyleSheet.hairlineWidth,
    width: 56,
    backgroundColor: c.borderStrong,
    alignSelf: "center",
  },
  encouragementScripture: {
    width: "100%",
    maxWidth: 360,
    paddingHorizontal: 6,
    gap: 6,
    alignItems: "center",
  },
  encouragementVerseLine: {
    fontSize: 16,
    lineHeight: 28,
    ...parchmentSans(500),
    color: c.inkSoft,
    textAlign: "center",
    letterSpacing: 0.02,
  },
  encouragementRefLine: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    ...parchmentSans(500),
    color: c.faint,
    textAlign: "center",
    letterSpacing: 0.08,
  },
});
