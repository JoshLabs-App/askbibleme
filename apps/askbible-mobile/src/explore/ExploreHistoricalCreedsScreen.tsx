import { ExploreText as Text } from "./ExploreText";
import { t } from "../i18n/site-copy";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { SHELL_TAB_SCROLL_FADE_PRESET } from "../read/readParchmentScrollMask";
import { ExploreHistoricalCreedsTimelineList } from "./ExploreHistoricalCreedsTimelineList";
import { historicalCreedsScreenStyles as styles } from "./ExploreHistoricalCreedsScreenStyles";
import { ShellSystemBackButton } from "../shell/ShellSystemBackButton";
import { ExploreParchmentPage} from "./exploreParchmentStyles";
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
    <ExploreParchmentPage>
      <ParchmentBottomFadeScrollView
        fadePreset={SHELL_TAB_SCROLL_FADE_PRESET}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <ShellSystemBackButton onPress={() => router.back()} />

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
    </ExploreParchmentPage>
  );
}
