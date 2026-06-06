import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { READ_PARCHMENT_PAGE_BOTTOM } from "../read/ReadParchmentPageScroll";
import { ExploreBirthYearSettingsModal } from "./ExploreBirthYearSettingsModal";
import { ExploreCenturyTimeline } from "./ExploreCenturyTimeline";
import { ExploreBiblicalLifespanChart } from "./ExploreBiblicalLifespanChart";
import { ExploreYearDayCountScriptureList } from "./ExploreYearDayCountScriptureList";
import { isExploreYearDayProfileComplete, readExploreYearDayProfile } from "./explore-birth-year-prefs";
import { YEAR_DAY_COUNT_LIFE_DAY_READ_TARGET } from "./year-day-count-scriptures";
import { exploreStyles as s } from "./exploreParchmentStyles";

const YEAR_DAY_COUNT_BOTTOM_CONTEXT = {
  en: {
    prose: [
      "Global life expectancy is still brief.",
      "Our days pass quickly, but they are precious before God.",
    ],
    scripture: [
      "The days of our years are threescore years and ten;",
      "and if by reason of strength they be fourscore years...",
    ],
    ref: "Psalm 90:10",
  },
  "zh-CN": {
    prose: ["据 Our World in Data 数据，2023年全球平均预期寿命约为73岁。"],
    scripture: ["圣经《诗篇》90篇说：“我们一生的年日是七十岁，若是强壮可到八十岁；", "但其中所矜夸的，不过是劳苦愁烦，转眼成空，我们便如飞而去。”"],
    ref: "诗篇 90:10",
  },
  "zh-TW": {
    prose: ["據 Our World in Data 資料，2023 年全球平均預期壽命約為 73 歲。"],
    scripture: ["聖經《詩篇》90 篇說：「我們一生的年日是七十歲，若是強壯可到八十歲；", "但其中所矜誇的，不過是勞苦愁煩，轉眼成空，我們便如飛而去。」"],
    ref: "詩篇 90:10",
  },
} as const;

export function ExploreYearDayCountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const [birthSettingsOpen, setBirthSettingsOpen] = useState(false);
  const [birthRefreshKey, setBirthRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void readExploreYearDayProfile().then((profile) => {
      if (cancelled) return;
      if (!isExploreYearDayProfileComplete(profile)) {
        setBirthSettingsOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openBirthSettings = useCallback(() => {
    setBirthSettingsOpen(true);
  }, []);

  const closeBirthSettings = useCallback(() => {
    setBirthSettingsOpen(false);
  }, []);

  const onBirthSaved = useCallback(() => {
    setBirthRefreshKey((k) => k + 1);
  }, []);

  const openLifeDayInBible = useCallback(() => {
    const target = YEAR_DAY_COUNT_LIFE_DAY_READ_TARGET;
    router.push({
      pathname: "/read/[bookId]/[chapter]",
      params: {
        bookId: target.bookId,
        chapter: String(target.chapter),
        verse: String(target.verseStart),
      },
    });
  }, [router]);

  return (
    <View style={s.root}>
      <ParchmentBottomFadeScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.scroll,
          {
            paddingTop: 8 + insets.top,
            paddingBottom: READ_PARCHMENT_PAGE_BOTTOM + insets.bottom,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={s.yearDayCountBackLink} accessibilityRole="button">
          <Text style={s.backLinkText}>{t("pages.explore.yearDayCountBack")}</Text>
        </Pressable>

        <Text style={s.yearDayCountTitle}>{t("pages.explore.yearDayCountTitle")}</Text>
        <View style={s.yearDayCountRule} />

        <View style={s.yearDayCountTimelineSection}>
          <ExploreCenturyTimeline
            onOpenSettings={openBirthSettings}
            onOpenLifeDay={openLifeDayInBible}
            refreshKey={birthRefreshKey}
          />
        </View>

        <ExploreYearDayCountScriptureList />

        <ExploreBiblicalLifespanChart
          profileRefreshKey={birthRefreshKey}
          onOpenProfileSettings={openBirthSettings}
        />

        <View style={s.yearDayCountBottomContext}>
          <Text style={s.yearDayCountBottomParagraph}>
            {YEAR_DAY_COUNT_BOTTOM_CONTEXT[locale].prose.join(locale === "en" ? " " : "")}
          </Text>
          <Text style={s.yearDayCountBottomParagraph}>
            {YEAR_DAY_COUNT_BOTTOM_CONTEXT[locale].scripture.join(locale === "en" ? " " : "")}
          </Text>
          <Text style={s.yearDayCountBottomRefLine}>{YEAR_DAY_COUNT_BOTTOM_CONTEXT[locale].ref}</Text>
        </View>
      </ParchmentBottomFadeScrollView>

      <ExploreBirthYearSettingsModal
        visible={birthSettingsOpen}
        onClose={closeBirthSettings}
        onSaved={onBirthSaved}
      />
    </View>
  );
}
