import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { InteractionManager, StyleSheet, View } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { t } from "../i18n/site-copy";
import { useLocale } from "../i18n/LocaleProvider";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { ExploreScriptureFadeScroll } from "./ExploreScriptureFadeScroll";
import { pushExploreReadChapter, EXPLORE_YEAR_DAY_COUNT_PATH } from "./explore-read-chapter-nav";
import { exploreStyles as exploreS } from "./exploreParchmentStyles";
import {
  formatYearDayCountRef,
  loadYearDayCountScriptureTextsProgressive,
  getYearDayCountScriptures,
  type YearDayCountScriptureRef,
} from "./year-day-count-scriptures";
import { useExploreModulesBundle } from "./useExploreModules";

/** 约 3～4 行经文可视高度；勿用 tabbar 大渐隐，否则有效可视区会被吃掉。 */
const BOX_MAX_HEIGHT = 96;

type Props = {
  maxHeight?: number;
  enabled?: boolean;
  exploreReturn?: string | null;
};

function ScriptureRows({
  refs,
  textById,
  keyPrefix,
  onOpen,
}: {
  refs: YearDayCountScriptureRef[];
  textById: Record<string, string>;
  keyPrefix: string;
  onOpen: (ref: YearDayCountScriptureRef) => void;
}) {
  return refs.map((ref, index) => {
    const text = textById[ref.id]?.trim();
    const refLabel = formatYearDayCountRef(ref);
    return (
      <View
        key={`${keyPrefix}-${ref.id}`}
        style={[
          styles.row,
          index === 0 && keyPrefix === "a" && styles.rowFirst,
          (index > 0 || keyPrefix === "b") && styles.rowBorder,
        ]}
      >
        <Text style={styles.verseBlock}>
          {text ? (
            <Text style={styles.verseText}>{text}</Text>
          ) : (
            <Text style={styles.versePending}>{t("pages.explore.yearDayCountScripturePending")}</Text>
          )}
          <Text> </Text>
          <Text
            style={styles.refLabel}
            onPress={() => onOpen(ref)}
            accessibilityRole="link"
            accessibilityLabel={refLabel}
          >
            {refLabel}
          </Text>
        </Text>
      </View>
    );
  });
}

export function ExploreYearDayCountScriptureList({
  maxHeight = BOX_MAX_HEIGHT,
  enabled = true,
  exploreReturn: exploreReturnProp,
}: Props) {
  const router = useRouter();
  const exploreReturn = exploreReturnProp ?? EXPLORE_YEAR_DAY_COUNT_PATH;
  const { locale } = useLocale();
  const screenFocused = useIsFocused();
  const loadEnabled = enabled && screenFocused;
  const [textById, setTextById] = useState<Record<string, string>>({});
  const [loopSegmentHeight, setLoopSegmentHeight] = useState(0);
  const modules = useExploreModulesBundle();
  const orderedRefs = useMemo(
    () => [...getYearDayCountScriptures()].reverse(),
    [modules.contentVersion],
  );

  useEffect(() => {
    if (!loadEnabled) return;
    setTextById({});
    let cancelled = false;
    let cancelProgressive: (() => void) | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      const progressive = loadYearDayCountScriptureTextsProgressive(
        orderedRefs,
        (partial) => {
          if (cancelled) return;
          setTextById((prev) => ({ ...prev, ...partial }));
        },
        { batchSize: 6 },
      );
      cancelProgressive = progressive.cancel;
      void progressive.promise.then((final) => {
        if (cancelled) return;
        setTextById(final);
      });
    });
    return () => {
      cancelled = true;
      cancelProgressive?.();
      task.cancel();
    };
  }, [loadEnabled, locale, orderedRefs]);

  const openInBible = (ref: YearDayCountScriptureRef) => {
    pushExploreReadChapter(
      router,
      {
        bookId: ref.bookId,
        chapter: ref.chapter,
        verse: ref.verseStart,
      },
      exploreReturn,
    );
  };

  return (
    <View style={[styles.wrap, exploreS.yearDayCountScriptureWrap]}>
      <ExploreScriptureFadeScroll
        height={maxHeight}
        fadePreset="default"
        autoScroll
        loopSegmentHeight={loopSegmentHeight}
      >
        <View
          collapsable={false}
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height);
            if (h > 0) setLoopSegmentHeight(h);
          }}
        >
          <ScriptureRows refs={orderedRefs} textById={textById} keyPrefix="a" onOpen={openInBible} />
        </View>
        <ScriptureRows refs={orderedRefs} textById={textById} keyPrefix="b" onOpen={openInBible} />
      </ExploreScriptureFadeScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  row: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rowFirst: {
    paddingTop: 6,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  verseBlock: {
    width: "100%",
    fontSize: 16,
    lineHeight: 24,
    ...parchmentSans(500),
    color: c.inkSoft,
  },
  verseText: {
    fontSize: 16,
    lineHeight: 24,
    ...parchmentSans(500),
    color: c.inkSoft,
  },
  versePending: {
    fontSize: 16,
    lineHeight: 24,
    ...parchmentSans(500),
    color: c.faint,
    fontStyle: "italic",
  },
  refLabel: {
    fontSize: 12,
    lineHeight: 20,
    ...parchmentSans(600),
    color: c.muted,
  },
});
