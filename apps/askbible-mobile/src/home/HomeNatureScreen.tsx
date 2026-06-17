import { StatusBar } from "expo-status-bar";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocale } from "../i18n/LocaleProvider";
import {
  getCoverVideoPosterOnly,
  subscribeCoverVideoPosterOnly,
} from "./coverVideoPosterFallback";
import { HomeVerseOverlay } from "./HomeVerseOverlay";
import { NatureHomeSettingsPanel } from "./NatureHomeSettingsPanel";
import { useHomeOrientationUnlock } from "./useHomeOrientationUnlock";
import { useShellFullBleedFrame } from "../shell/shellLayout";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { AppLogoSplash } from "../shell/AppLogoSplash";
import { useHomeNatureVideoPowerPolicy } from "./useHomeNatureVideoPowerPolicy";
import { useHomeNatureScreenLoad } from "./useHomeNatureScreenLoad";
import { useHomeNatureVerseSpeech } from "./useHomeNatureVerseSpeech";
import { useHomeNatureSceneControl } from "./useHomeNatureSceneControl";
import { useHomeNatureImmersive } from "./useHomeNatureImmersive";
import { HomeNatureScreenVideoStage } from "./HomeNatureScreenVideoStage";
import { HomeNatureScreenBackdrops } from "./HomeNatureScreenBackdrops";
import { HomeNatureScreenTopChrome } from "./HomeNatureScreenTopChrome";
import { HomeNatureScreenBottomBand } from "./HomeNatureScreenBottomBand";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";

export function HomeNatureScreen() {
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const fullBleedFrame = useShellFullBleedFrame();
  const coverVideoPosterOnly = useSyncExternalStore(
    subscribeCoverVideoPosterOnly,
    getCoverVideoPosterOnly,
    getCoverVideoPosterOnly,
  );

  const { togglePlayMusic, setMusicGain, playing, playbackMode, scripturePreparing } = useMusicPlayback();

  useHomeOrientationUnlock();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ambientStripViewportWidth, setAmbientStripViewportWidth] = useState(0);

  const load = useHomeNatureScreenLoad();

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
    fullBleedFrame,
    hasVideoStage: scene.hasVideoStage,
    loading: load.loading,
    error: load.error,
    settingsOpen,
    setSettingsOpen,
    showSceneLoader: scene.showSceneLoader,
    playing,
    togglePlayMusic,
    sceneId: scene.sceneId,
    sceneList: scene.sceneList,
    selectScene: scene.selectScene,
    scrollSceneStripToId: scene.scrollSceneStripToId,
  });

  useEffect(() => {
    const targetMusicGain = verseSpeech.voiceActive ? 0.3 : 1;
    void setMusicGain(targetMusicGain);
  }, [setMusicGain, verseSpeech.voiceActive]);

  if (load.loading && !load.settings?.videos.length) {
    return <AppLogoSplash />;
  }

  const sceneStripBottomPad =
    immersive.showLandscapeVideo && immersive.landscapeScenePickerOpen
      ? Math.max(insets.bottom, 12)
      : immersive.bottomNavSlot;

  return (
    <View style={styles.root} onTouchStart={immersive.markHomeInteraction}>
      <StatusBar hidden={false} style="auto" translucent backgroundColor="transparent" />

      <HomeNatureScreenVideoStage
        videoBackdropStyle={immersive.videoBackdropStyle}
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

      <HomeNatureScreenBackdrops
        showAutoImmersive={immersive.showAutoImmersive}
        showLandscapeVideo={immersive.showLandscapeVideo}
        markHomeInteraction={immersive.markHomeInteraction}
        onLandscapeBackdropPress={immersive.onLandscapeBackdropPress}
        onPortraitBackdropPress={immersive.onPortraitBackdropPress}
      />

      <HomeVerseOverlay
        prefsVersion={load.prefsVersion}
        layout={immersive.showLandscapeVideo ? "homeLandscape" : "home"}
        pauseRotation={verseSpeech.voicePreparing || verseSpeech.voiceSpeaking || !load.homeFocused}
        onDisplayedVerseChange={verseSpeech.onDisplayedVerseChange}
        onAdvanceControllerReady={verseSpeech.onAdvanceControllerReady}
      />

      {!immersive.showAutoImmersive ? (
        <HomeNatureScreenTopChrome
          insets={insets}
          homeTtsExperimentEnabled={verseSpeech.homeTtsExperimentEnabled}
          voicePreparing={verseSpeech.voicePreparing}
          voiceSpeaking={verseSpeech.voiceSpeaking}
          onPlayDisplayedVerseVoice={verseSpeech.onPlayDisplayedVerseVoice}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : null}

      {immersive.showSceneStrip && !immersive.showAutoImmersive ? (
        <HomeNatureScreenBottomBand
          locale={locale}
          baseUrl={load.baseUrl}
          sceneStripBottomPad={sceneStripBottomPad}
          landscapeScenePickerOpen={immersive.landscapeScenePickerOpen}
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
          showLandscapeVideo={immersive.showLandscapeVideo}
          onLandscapeSceneSelect={immersive.onLandscapeSceneSelect}
        />
      ) : null}

      {!immersive.showAutoImmersive ? (
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
