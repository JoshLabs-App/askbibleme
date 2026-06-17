import { Pressable, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { exploreStyles as shared } from "./exploreParchmentStyles";
import { ExploreBiblicalFeastsTimelineList } from "./ExploreBiblicalFeastsTimelineList";
import { biblicalFeastsScreenStyles as styles } from "./ExploreBiblicalFeastsScreenStyles";
import { useExploreBiblicalFeastsScreen } from "./useExploreBiblicalFeastsScreen";

export function ExploreBiblicalFeastsScreen() {
  const {
    router,
    locale,
    scrollContentStyle,
    expandedFeastId,
    feastRows,
    churchFeastRows,
    openRead,
    onToggleExpand,
  } = useExploreBiblicalFeastsScreen();

  return (
    <View style={shared.root}>
      <ParchmentBottomFadeScrollView
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <Pressable onPress={() => router.back()} style={shared.yearDayCountBackLink} accessibilityRole="button">
          <Text style={shared.backLinkText}>{t("pages.explore.biblicalFeastsBack")}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{t("pages.explore.biblicalFeastsTitle")}</Text>
        <Text style={styles.subtitle}>{t("pages.explore.biblicalFeastsSubtitle")}</Text>
        <Text style={styles.lead}>{t("pages.explore.biblicalFeastsLead")}</Text>

        <View style={styles.timelineHeader}>
          <Text style={styles.timelineHeading}>{t("pages.explore.biblicalFeastsChurchYearTitle")}</Text>
          <Text style={styles.timelineSubLead}>{t("pages.explore.biblicalFeastsChurchYearLead")}</Text>
        </View>

        <ExploreBiblicalFeastsTimelineList
          rows={churchFeastRows}
          expandedFeastId={expandedFeastId}
          collapseToId="advent"
          locale={locale}
          onToggleExpand={onToggleExpand}
          onOpenRead={openRead}
        />

        <View style={styles.timelineHeaderSecondary}>
          <Text style={styles.timelineHeading}>{t("pages.explore.biblicalFeastsYearLineTitle")}</Text>
        </View>

        <ExploreBiblicalFeastsTimelineList
          rows={feastRows}
          expandedFeastId={expandedFeastId}
          collapseToId="passover"
          locale={locale}
          showSeasonLabels
          onToggleExpand={onToggleExpand}
          onOpenRead={openRead}
        />
      </ParchmentBottomFadeScrollView>
    </View>
  );
}
