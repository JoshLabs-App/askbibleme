import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "../read/readParchmentTheme";
import { ExploreScriptureFadeScroll } from "./ExploreScriptureFadeScroll";
import { exploreStyles as exploreS } from "./exploreParchmentStyles";
import {
  formatYearDayCountRef,
  loadAllYearDayCountScriptureTexts,
  YEAR_DAY_COUNT_SCRIPTURES,
  type YearDayCountScriptureRef,
} from "./year-day-count-scriptures";

const BOX_MAX_HEIGHT = 140;

type Props = {
  maxHeight?: number;
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

export function ExploreYearDayCountScriptureList({ maxHeight = BOX_MAX_HEIGHT }: Props) {
  const router = useRouter();
  const [textById, setTextById] = useState<Record<string, string> | null>(null);
  const [loopSegmentHeight, setLoopSegmentHeight] = useState(0);
  const orderedRefs = useMemo(() => [...YEAR_DAY_COUNT_SCRIPTURES].reverse(), []);

  useEffect(() => {
    let cancelled = false;
    void loadAllYearDayCountScriptureTexts().then((map) => {
      if (!cancelled) setTextById(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openInBible = (ref: YearDayCountScriptureRef) => {
    router.push({
      pathname: "/read/[bookId]/[chapter]",
      params: {
        bookId: ref.bookId,
        chapter: String(ref.chapter),
        verse: String(ref.verseStart),
      },
    });
  };

  return (
    <View style={[styles.wrap, exploreS.yearDayCountScriptureWrap]}>
      {textById == null ? (
        <View style={[styles.loading, { height: maxHeight }]}>
          <ActivityIndicator color={c.muted} />
        </View>
      ) : (
        <ExploreScriptureFadeScroll
          height={maxHeight}
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
      )}
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
  loading: {
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  rowFirst: {
    paddingTop: 4,
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
