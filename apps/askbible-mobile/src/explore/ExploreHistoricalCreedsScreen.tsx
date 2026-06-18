import { Pressable, Text, View } from "react-native";
import { t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { ExploreHistoricalCreedsTimelineList } from "./ExploreHistoricalCreedsTimelineList";
import { historicalCreedsScreenStyles as styles } from "./ExploreHistoricalCreedsScreenStyles";
import { exploreStyles as shared } from "./exploreParchmentStyles";
import { useExploreHistoricalCreedsScreen } from "./useExploreHistoricalCreedsScreen";

export function ExploreHistoricalCreedsScreen() {
  const {
    router,
    scrollContentStyle,
    expandedCreedId,
    fullTextCreedId,
    creedRows,
    locale,
    onToggleExpand,
    onToggleFullText,
  } = useExploreHistoricalCreedsScreen();

  return (
    <View style={shared.root}>
      <ParchmentBottomFadeScrollView
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <Pressable
          onPress={() => router.back()}
          style={[shared.backLink, styles.backLink]}
          accessibilityRole="button"
        >
          <Text style={shared.backLinkText}>{t("pages.explore.historicalCreedsBack")}</Text>
        </Pressable>

        <Text style={styles.pageTitle}>{t("pages.explore.historicalCreedsTitle")}</Text>
        <Text style={styles.lead}>{t("pages.explore.historicalCreedsLead")}</Text>

        <ExploreHistoricalCreedsTimelineList
          rows={creedRows}
          expandedCreedId={expandedCreedId}
          fullTextCreedId={fullTextCreedId}
          collapseToId=""
          locale={locale}
          onToggleExpand={onToggleExpand}
          onToggleFullText={onToggleFullText}
        />
      </ParchmentBottomFadeScrollView>
    </View>
  );
}
