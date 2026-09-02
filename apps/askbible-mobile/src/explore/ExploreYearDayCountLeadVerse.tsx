import { useEffect, useMemo, useState } from "react";
import { InteractionManager, Pressable } from "react-native";
import { ExploreText as Text } from "./ExploreText";
import { t } from "../i18n/site-copy";
import {
  formatYearDayCountRef,
  getYearDayCountLeadRef,
  loadYearDayCountScriptureText,
} from "./year-day-count-scriptures";
import { splitYearDayCountLeadVerseLines } from "@/lib/explore/year-day-count-lead-verse";
import { exploreStyles as s } from "./exploreParchmentStyles";

type Props = {
  onOpen?: () => void;
};

export function ExploreYearDayCountLeadVerse({ onOpen }: Props) {
  const [text, setText] = useState<string | null>(null);
  const leadRef = getYearDayCountLeadRef();
  const refLabel = formatYearDayCountRef(leadRef);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadYearDayCountScriptureText(leadRef).then((verse) => {
        if (!cancelled) setText(verse);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [leadRef.bookId, leadRef.chapter, leadRef.verseStart, leadRef.verseEnd]);

  const lines = useMemo(() => {
    const body = text?.trim();
    if (!body) return [t("pages.explore.yearDayCountScripturePending")];
    return splitYearDayCountLeadVerseLines(body);
  }, [text]);

  const a11y = `${lines.join(" ")} ${refLabel}`;
  const lastIndex = lines.length - 1;

  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      style={({ pressed }) => [s.yearDayCountLeadBlock, pressed && onOpen && s.yearDayCountLeadPressed]}
      accessibilityRole={onOpen ? "link" : "text"}
      accessibilityLabel={a11y}
    >
      <Text style={s.yearDayCountLeadVerse}>
        {lines.map((line, index) => (
          <Text key={`${index}-${line}`}>
            {index > 0 ? "\n" : null}
            <Text style={s.yearDayCountLeadLine}>{line}</Text>
            {index === lastIndex ? (
              <>
                <Text> </Text>
                <Text style={s.yearDayCountLeadRef}>{refLabel}</Text>
              </>
            ) : null}
          </Text>
        ))}
      </Text>
    </Pressable>
  );
}
