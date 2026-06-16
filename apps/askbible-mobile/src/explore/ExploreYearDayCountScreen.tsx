import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager, Modal, Pressable, Text, View } from "react-native";
import { ParchmentBottomFadeScrollView } from "../read/ParchmentBottomFadeScrollView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n/site-copy";
import { READ_PARCHMENT_PAGE_BOTTOM } from "../read/ReadParchmentPageScroll";
import { ReadParchmentBackground } from "../read/ReadParchmentBackground";
import { ExploreCenturyTimeline } from "./ExploreCenturyTimeline";
import { ExploreBiblicalLifespanChart } from "./ExploreBiblicalLifespanChart";
import { ExploreBirthYearSettingsScreen } from "./ExploreBirthYearSettingsScreen";
import { ExploreYearDayCountLifeExpectancyIntro } from "./ExploreYearDayCountLifeExpectancyIntro";
import { ExploreYearDayCountScriptureList } from "./ExploreYearDayCountScriptureList";
import { ExploreYearsDaysEternitySection } from "./ExploreYearsDaysEternitySection";
import {
  isExploreYearDayProfileComplete,
  readExploreYearDayProfile,
  type ExploreYearDayProfile,
} from "./explore-birth-year-prefs";
import {
  canAutoPromptRequiredYearDayBirthProfile,
  resetRequiredYearDayBirthProfilePromptDismissal,
} from "./explore-year-day-birth-prompt-session";
import { pushExploreReadChapter, useExploreReadReturnPath, EXPLORE_YEAR_DAY_COUNT_PATH } from "./explore-read-chapter-nav";
import { getYearDayCountLifeDayReadTarget } from "./year-day-count-scriptures";
import { exploreStyles as s, useExploreScrollContentStyle } from "./exploreParchmentStyles";

export function ExploreYearDayCountScreen() {
  const router = useRouter();
  const exploreReturn = useExploreReadReturnPath() ?? EXPLORE_YEAR_DAY_COUNT_PATH;
  const insets = useSafeAreaInsets();
  const scrollContentStyle = useExploreScrollContentStyle({
    paddingTop: 8 + insets.top,
    paddingBottom: READ_PARCHMENT_PAGE_BOTTOM + insets.bottom,
  });
  const [birthRefreshKey, setBirthRefreshKey] = useState(0);
  const [profile, setProfile] = useState<ExploreYearDayProfile | null>(null);
  const [heavySectionsReady, setHeavySectionsReady] = useState(false);
  const [scriptureReady, setScriptureReady] = useState(false);
  const [tailSectionsReady, setTailSectionsReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsRequired, setSettingsRequired] = useState(false);
  const profileLoadSeqRef = useRef(0);
  const didOfferRequiredSettingsRef = useRef(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setHeavySectionsReady(true));
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (!heavySectionsReady) {
      setScriptureReady(false);
      setTailSectionsReady(false);
      return;
    }
    const scriptureTask = InteractionManager.runAfterInteractions(() => setScriptureReady(true));
    const tailTask = InteractionManager.runAfterInteractions(() => {
      InteractionManager.runAfterInteractions(() => setTailSectionsReady(true));
    });
    return () => {
      scriptureTask.cancel();
      tailTask.cancel();
    };
  }, [heavySectionsReady]);

  const loadProfile = useCallback(() => {
    const loadSeq = ++profileLoadSeqRef.current;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readExploreYearDayProfile().then(async (next) => {
        if (cancelled || loadSeq !== profileLoadSeqRef.current) return;
        setProfile(next);
        setBirthRefreshKey((k) => k + 1);
        if (isExploreYearDayProfileComplete(next)) {
          resetRequiredYearDayBirthProfilePromptDismissal();
          return;
        }
        if (didOfferRequiredSettingsRef.current) return;
        const canPrompt = await canAutoPromptRequiredYearDayBirthProfile();
        if (cancelled || loadSeq !== profileLoadSeqRef.current || !canPrompt) return;
        didOfferRequiredSettingsRef.current = true;
        setSettingsRequired(true);
        setSettingsOpen(true);
      });
    });
    return () => {
      cancelled = true;
      if (loadSeq === profileLoadSeqRef.current) {
        profileLoadSeqRef.current += 1;
      }
      task.cancel();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!settingsOpen) {
        return loadProfile();
      }
      return undefined;
    }, [loadProfile, settingsOpen]),
  );

  const openBirthSettings = useCallback(() => {
    setSettingsRequired(false);
    setSettingsOpen(true);
  }, []);

  const closeBirthSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsRequired(false);
  }, []);

  const handleBirthSettingsSaved = useCallback(() => {
    setSettingsOpen(false);
    setSettingsRequired(false);
    loadProfile();
  }, [loadProfile]);

  const openLifeDayInBible = useCallback(() => {
    const target = getYearDayCountLifeDayReadTarget();
    pushExploreReadChapter(
      router,
      {
        bookId: target.bookId,
        chapter: target.chapter,
        verse: target.verseStart,
      },
      exploreReturn,
    );
  }, [exploreReturn, router]);

  return (
    <View style={s.root}>
      <ParchmentBottomFadeScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <Pressable onPress={() => router.back()} style={s.yearDayCountBackLink} accessibilityRole="button">
          <Text style={s.backLinkText}>{t("pages.explore.yearDayCountBack")}</Text>
        </Pressable>

        <Text style={s.yearDayCountTitle}>{t("pages.explore.yearDayCountTitle")}</Text>
        <View style={s.yearDayCountRule} />

        {heavySectionsReady ? (
          <>
            <View style={s.yearDayCountTimelineSection}>
              <ExploreCenturyTimeline
                birthDate={profile?.birthDate ?? null}
                onOpenSettings={openBirthSettings}
                onOpenLifeDay={openLifeDayInBible}
                refreshKey={birthRefreshKey}
              />
            </View>

            {scriptureReady ? <ExploreYearDayCountScriptureList exploreReturn={exploreReturn} /> : null}

            {tailSectionsReady ? (
              <>
                <ExploreBiblicalLifespanChart
                  profile={profile}
                  profileRefreshKey={birthRefreshKey}
                  onOpenProfileSettings={openBirthSettings}
                  exploreReturn={exploreReturn}
                />

                <ExploreYearDayCountLifeExpectancyIntro />

                <ExploreYearsDaysEternitySection />
              </>
            ) : null}
          </>
        ) : null}
      </ParchmentBottomFadeScrollView>

      <Modal
        visible={settingsOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeBirthSettings}
      >
        <ReadParchmentBackground>
          <ExploreBirthYearSettingsScreen
            embedded
            required={settingsRequired}
            onClose={closeBirthSettings}
            onSaved={handleBirthSettingsSaved}
          />
        </ReadParchmentBackground>
      </Modal>
    </View>
  );
}
