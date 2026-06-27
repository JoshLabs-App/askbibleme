import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Platform, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseVerseKey } from "../bible/parse-verse-key";
import type { AppLocale } from "../i18n/config";
import { useLocale } from "../i18n/LocaleProvider";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { AppLogoSplash } from "../shell/AppLogoSplash";
import { shellFullBleedBackdropStyle, useShellFullBleedFrame } from "../shell/shellLayout";
import {
  getCoverVideoPosterOnly,
  subscribeCoverVideoPosterOnly,
} from "./coverVideoPosterFallback";
import { HomeNatureScreenBottomBand } from "./HomeNatureScreenBottomBand";
import { HomeNatureScreenInteractionLayer } from "./HomeNatureScreenInteractionLayer";
import { HomeNatureScreenTopChrome } from "./HomeNatureScreenTopChrome";
import { HomeNatureScreenVideoStage } from "./HomeNatureScreenVideoStage";
import { HomeVerseOverlay } from "./HomeVerseOverlay";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";
import { NatureHomeSettingsPanel } from "./NatureHomeSettingsPanel";
import { useHomeNatureImmersive } from "./useHomeNatureImmersive";
import { useHomeNatureSceneControl } from "./useHomeNatureSceneControl";
import { useHomeNatureScreenLoad } from "./useHomeNatureScreenLoad";
import { useHomeNatureTodayScriptureShellPlayback } from "./useHomeNatureTodayScriptureShellPlayback";
import { useHomeNatureVerseSpeech } from "./useHomeNatureVerseSpeech";
import { useHomeNatureVideoPowerPolicy } from "./useHomeNatureVideoPowerPolicy";
import { useHomeOrientationUnlock } from "./useHomeOrientationUnlock";

export function HomeNatureScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const fullBleedFrame = useShellFullBleedFrame();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const coverVideoPosterOnly = useSyncExternalStore(
    subscribeCoverVideoPosterOnly,
    getCoverVideoPosterOnly,
    getCoverVideoPosterOnly,
  );

  const { setMusicGain, playing, playbackMode, scripturePreparing } = useMusicPlayback();

  useHomeOrientationUnlock();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ambientStripViewportWidth, setAmbientStripViewportWidth] = useState(0);
  const [displayedVerseKey, setDisplayedVerseKey] = useState<string | null>(null);

  const load = useHomeNatureScreenLoad();
  useHomeNatureTodayScriptureShellPlayback(load.homeFocused);

  const scriptureModeActive = playbackMode === "scripture" && (playing || scripturePreparing);
  const verseSpeech = useHomeNatureVerseSpeech({
    prefsVersion: load.prefsVersion,
    scriptureModeActive,
  });

  const videoPowerPolicy = useHomeNatureVideoPowerPolicy({ softFocus: load.softFocus });
  const forcePosterStage = coverVideoPosterOnly || videoPowerPolicy.preferPosterStage;
  const musicModeActive = playbackMode === "music" && playing;

  const scene = useHomeNatureSceneControl({
    baseUrl: load.baseUrl,
    homeFocused: load.homeFocused,
    homeFocusedRef: load.homeFocusedRef,
    naturePackRev: load.naturePackRev,
    loading: load.loading,
    error: load.error,
    settings: load.settings,
    localActiveId: load.localActiveId,
    setLocalActiveId: load.setLocalActiveId,
    loopAllScenesEnabled: load.loopAllScenesEnabled,
    setLoopAllScenesEnabled: load.setLoopAllScenesEnabled,
    sceneUsageMap: load.sceneUsageMap,
    setSceneUsageMap: load.setSceneUsageMap,
    activeAmbientSlotId: load.activeAmbientSlotId,
    setActiveAmbientSlotId: load.setActiveAmbientSlotId,
    coverVideoPosterOnly,
    forcePosterStage,
    videoPowerPolicy,
    musicModeActive,
    scriptureModeActive,
    voiceActive: verseSpeech.voiceActive,
  });

  const immersive = useHomeNatureImmersive({
    insets,
    hasVideoStage: scene.hasVideoStage,
    loading: load.loading,
    error: load.error,
    settingsOpen,
    showSceneLoader: scene.showSceneLoader,
    sceneId: scene.sceneId,
    sceneList: scene.sceneList,
    selectScene: scene.selectScene,
  });

  useEffect(() => {
    void setMusicGain(verseSpeech.voiceActive ? 0.3 : 1);
  }, [setMusicGain, verseSpeech.voiceActive]);

  const handleDisplayedVerseChange = useCallback(
    (payload: {
      verseKey: string | null;
      primaryTranslationId: string;
      speechMain: string;
      speechReference: string;
      speechLocale: AppLocale;
    }) => {
      setDisplayedVerseKey(payload.verseKey);
      verseSpeech.onDisplayedVerseChange(payload);
    },
    [verseSpeech.onDisplayedVerseChange],
  );

  const openDisplayedVerseInBible = useCallback(() => {
    if (!displayedVerseKey) return;
    const readTarget = parseVerseKey(displayedVerseKey);
    if (!readTarget) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/(tabs)/read/[bookId]/[chapter]",
      params: {
        bookId: readTarget.bookId,
        chapter: String(readTarget.chapter),
        verse: String(readTarget.verse),
      },
    });
  }, [displayedVerseKey, router]);

  if (load.loading && !load.settings?.videos.length) {
    return <AppLogoSplash />;
  }

  const chromeVisible = !immersive.showAutoImmersive;
  const videoBackdropStyle =
    Platform.OS === "android"
      ? {
          ...shellFullBleedBackdropStyle(fullBleedFrame),
          bottom: -Math.max(insets.bottom, 0),
        }
      : styles.fullBleedBackdropFill;

  return (
    <View style={styles.root} onTouchStart={immersive.markHomeInteraction}>
      <StatusBar hidden={false} style="auto" translucent backgroundColor="transparent" />

      <HomeNatureScreenVideoStage
        videoBackdropStyle={videoBackdropStyle}
        videoStageMounted={load.videoStageMounted}
        sceneId={scene.sceneId}
        resolveScenePlayback={scene.resolveScenePlayback}
        posterUri={scene.posterUri}
        posterModule={scene.posterModule}
        forcePosterStage={forcePosterStage}
        clampedRate={scene.clampedRate}
        showLandscapeVideo={immersive.showLandscapeVideo}
        homeFocused={load.homeFocused}
        handleSceneVideoReady={scene.handleSceneVideoReady}
        videoPowerPolicy={videoPowerPolicy}
        hasVideoStage={scene.hasVideoStage}
        settingsOpen={settingsOpen}
        softFocus={load.softFocus}
        showSceneLoader={scene.showSceneLoader}
      />

      <HomeNatureScreenInteractionLayer
        autoImmersive={immersive.showAutoImmersive}
        enabled={!settingsOpen}
        onInteraction={immersive.markHomeInteraction}
      />

      <HomeVerseOverlay
        prefsVersion={load.prefsVersion}
        layout={immersive.showLandscapeVideo ? "homeLandscape" : "home"}
        pauseRotation={verseSpeech.voicePreparing || verseSpeech.voiceSpeaking || !load.homeFocused}
        onVerseBodyPress={openDisplayedVerseInBible}
        onDisplayedVerseChange={handleDisplayedVerseChange}
        onAdvanceControllerReady={verseSpeech.onAdvanceControllerReady}
      />

      {chromeVisible ? (
        <>
          <HomeNatureScreenTopChrome
            insets={insets}
            homeTtsExperimentEnabled={verseSpeech.homeTtsExperimentEnabled}
            voicePreparing={verseSpeech.voicePreparing}
            voiceSpeaking={verseSpeech.voiceSpeaking}
            onPlayDisplayedVerseVoice={verseSpeech.onPlayDisplayedVerseVoice}
            onOpenSettings={() => setSettingsOpen(true)}
          />

          <HomeNatureScreenBottomBand
            locale={locale}
            baseUrl={load.baseUrl}
            landscapeLayout={immersive.showLandscapeVideo}
            sceneStripBottomPad={immersive.bottomNavSlot}
            activeAmbientSlotId={load.activeAmbientSlotId}
            toggleAmbientSlot={load.toggleAmbientSlot}
            ambientStripViewportWidth={ambientStripViewportWidth}
            onAmbientStripLayout={setAmbientStripViewportWidth}
            sceneScrollRef={scene.sceneScrollRef}
            sceneList={scene.sceneList}
            sceneStripViewportWidth={scene.sceneStripViewportWidth}
            onSceneStripLayout={scene.onSceneStripLayout}
            loopAllScenesEnabled={load.loopAllScenesEnabled}
            sceneId={scene.sceneId}
            enableLoopAllScenes={load.enableLoopAllScenes}
            selectScene={scene.selectScene}
          />
        </>
      ) : null}

      {chromeVisible ? (
        <NatureHomeSettingsPanel
          visible={settingsOpen}
          presentation={isLandscape ? "overlay" : "modal"}
          posterUri={scene.posterUri || undefined}
          showTtsControls={false}
          onClose={() => setSettingsOpen(false)}
          onPrefsChanged={load.onPrefsChanged}
        />
      ) : null}
    </View>
  );
}
