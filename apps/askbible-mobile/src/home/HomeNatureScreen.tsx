import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseVerseKey } from "@/lib/bible/parse-verse-key";
import type { AppLocale } from "../i18n/config";
import { useLocale } from "../i18n/LocaleProvider";
import { isShellMusicChromeActive } from "../audio/shellMusicNativePlaying";
import { useShellMusicSignals } from "../music/useShellMusicSignals";
import {
  getShellScriptureWantPlaying,
  subscribeShellScriptureWantPlaying,
} from "../audio/shellScriptureWantPlaying";
import { setShellVerseWantPlaying } from "../audio/shellVerseWantPlaying";
import { ensureAndroidVersePlaybackBatteryPermission } from "./androidVersePlaybackBatteryPrompt";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import type { NatureAmbientSceneSlotId } from "../nature/ambientSceneSlots";
import {
  setHomeGoldenVerseSessionActive,
  shouldYieldMusicWhenOpeningAmbient,
  yieldAmbientIfMusicAndAmbientOpen,
} from "./homeGoldenVerseTwoSourceMutex";
import { AppLogoSplash } from "../shell/AppLogoSplash";
import { useShellNavMenu } from "../shell/ShellNavMenuContext";
import { shellFullBleedBackdropStyle, useShellFullBleedFrame } from "../shell/shellLayout";
import {
  clearCoverVideoSessionPosterOnly,
  getCoverVideoPosterOnly,
  subscribeCoverVideoPosterOnly,
} from "./coverVideoPosterFallback";
import { HomeNatureScreenBottomBand } from "./HomeNatureScreenBottomBand";
import { HomeNatureScreenInteractionLayer } from "./HomeNatureScreenInteractionLayer";
import { HomeNatureScreenTopChrome } from "./HomeNatureScreenTopChrome";
import { HomeNatureScreenVideoStage } from "./HomeNatureScreenVideoStage";
import { HomeVerseOverlay } from "./HomeVerseOverlay";
import { homeNatureScreenStyles as styles } from "./homeNatureScreenStyles";
import { HOME_SCENE_TOOLS_AUTO_CLOSE_MS } from "./homeNatureScreenConstants";
import { useHomeNatureImmersive } from "./useHomeNatureImmersive";
import { useHomeNatureSceneControl } from "./useHomeNatureSceneControl";
import { useHomeNatureScreenLoad } from "./useHomeNatureScreenLoad";
import { useHomeNatureTodayScriptureShellPlayback } from "./useHomeNatureTodayScriptureShellPlayback";
import { useHomeNatureVerseSpeech } from "./useHomeNatureVerseSpeech";
import { useHomeNatureVerseAudioPlayback } from "./useHomeNatureVerseAudioPlayback";
import { useHomeNatureVideoPowerPolicy } from "./useHomeNatureVideoPowerPolicy";
import { useHomeOrientationUnlock } from "./useHomeOrientationUnlock";
import { logStartupTiming } from "../debug/startupTiming";
import { writeNatureLiveVideoEnabled } from "./natureHomeLiveVideoPrefs";
import {
  consumeQueuedWidgetVerseKey,
  setWidgetVersePlaying,
  subscribeWidgetVersePlayRequest,
  subscribeWidgetVerseStopRequest,
} from "../widget/widgetPlaybackRequest";
import { syncWidgetDisplayedVerseFollow } from "../widget/syncWidgetDisplayedVerseFollow";

export function HomeNatureScreen() {
  const router = useRouter();
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const fullBleedFrame = useShellFullBleedFrame();
  const coverVideoPosterOnly = useSyncExternalStore(
    subscribeCoverVideoPosterOnly,
    getCoverVideoPosterOnly,
    getCoverVideoPosterOnly,
  );

  const musicSignals = useShellMusicSignals();
  const {
    setMusicGain,
    setMusicRepeatMode,
    playing,
    playbackMode,
    tracks,
    trackIndex,
    playTrackAt,
    scripturePreparing,
    togglePlayScripture,
    pauseShellPlayback,
  } = useMusicPlayback();
  const { open: navMenuOpen } = useShellNavMenu();

  const [ambientStripViewportWidth, setAmbientStripViewportWidth] = useState(0);
  const [sceneToolsOpen, setSceneToolsOpen] = useState(false);
  const [sceneToolsIdleEpoch, setSceneToolsIdleEpoch] = useState(0);
  const bumpSceneToolsIdle = useCallback(() => {
    setSceneToolsIdleEpoch((n) => n + 1);
  }, []);
  const [displayedVerseKey, setDisplayedVerseKey] = useState<string | null>(null);
  const [forceVerseKey, setForceVerseKey] = useState<string | null>(null);
  const [homeVerseAudioActive, setHomeVerseAudioActive] = useState(false);
  const homeVerseAdvanceRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const homeVersePeekNextRef = useRef<() => string | null>(() => null);
  const homeVersePeekNextTwoRef = useRef<() => [string | null, string | null]>(() => [null, null]);
  const homeVersePeekNextKeysRef = useRef<(count: number) => string[]>(() => []);
  const homeVersePinNextRef = useRef<(key: string | null) => void>(() => undefined);
  const homeVerseAudioActiveRef = useRef(false);
  const homeVerseStopFullyRef = useRef<() => Promise<void>>(async () => {});
  const displayedVerseKeyRef = useRef<string | null>(null);
  const forceVerseKeyRef = useRef<string | null>(null);
  const [startupReady, setStartupReady] = useState(Platform.OS !== "android");
  const firstRenderLoggedRef = useRef(false);
  const settingsLoggedRef = useRef(false);
  const videoMountedLoggedRef = useRef(false);

  useEffect(() => {
    if (firstRenderLoggedRef.current) return;
    firstRenderLoggedRef.current = true;
    logStartupTiming("home", "first_render");
  }, []);

  useEffect(() => {
    if (startupReady) return;
    const timer = setTimeout(() => setStartupReady(true), 0);
    return () => clearTimeout(timer);
  }, [startupReady]);

  useHomeOrientationUnlock(startupReady);

  const load = useHomeNatureScreenLoad();
  useHomeNatureTodayScriptureShellPlayback(load.homeFocused, startupReady);

  const stopGoldenVerse = useCallback(() => {
    setHomeVerseAudioActive(false);
    setForceVerseKey(null);
    void homeVerseStopFullyRef.current();
  }, []);

  const scriptureModeActive = playbackMode === "scripture" && (playing || scripturePreparing);
  const scriptureWantPlaying = useSyncExternalStore(
    subscribeShellScriptureWantPlaying,
    getShellScriptureWantPlaying,
    () => false,
  );
  const scriptureAudioLocksVideo = scriptureModeActive || scriptureWantPlaying;
  const verseSpeech = useHomeNatureVerseSpeech({
    prefsVersion: load.prefsVersion,
    scriptureModeActive,
    enabled: startupReady,
  });
  const handleAdvanceControllerReady = useCallback(
    (advanceNow: () => Promise<void>) => {
      homeVerseAdvanceRef.current = advanceNow;
      verseSpeech.onAdvanceControllerReady(advanceNow);
    },
    [verseSpeech.onAdvanceControllerReady],
  );
  const handleVerseQueueControllerReady = useCallback(
    (ctrl: {
      peekNextVerseKey: () => string | null;
      peekNextTwoVerseKeys: () => [string | null, string | null];
      peekNextVerseKeys: (count: number) => string[];
      pinNextVerseKey: (key: string | null) => void;
    }) => {
      homeVersePeekNextRef.current = ctrl.peekNextVerseKey;
      homeVersePeekNextTwoRef.current = ctrl.peekNextTwoVerseKeys;
      homeVersePeekNextKeysRef.current = ctrl.peekNextVerseKeys;
      homeVersePinNextRef.current = ctrl.pinNextVerseKey;
    },
    [],
  );
  const audioVerseKey = forceVerseKey ?? displayedVerseKey;
  const homeVerseAudio = useHomeNatureVerseAudioPlayback({
    baseUrl: load.baseUrl,
    verseKey: audioVerseKey,
    active: homeVerseAudioActive && startupReady,
    // 挂件强制句只锁开播第一句；续播必须清掉 force，否则 advance 只换显示、音频停住。
    advanceNow: async () => {
      if (forceVerseKeyRef.current) {
        forceVerseKeyRef.current = null;
        setForceVerseKey(null);
      }
      await homeVerseAdvanceRef.current();
    },
    peekNextVerseKey: () => homeVersePeekNextRef.current(),
    peekNextTwoVerseKeys: () => homeVersePeekNextTwoRef.current(),
    peekNextVerseKeys: (count) => homeVersePeekNextKeysRef.current(count),
    pinNextVerseKey: (key) => homeVersePinNextRef.current(key),
    onActiveChange: setHomeVerseAudioActive,
  });
  homeVerseStopFullyRef.current = homeVerseAudio.stopFully;

  const toggleGoldenVerse = useCallback(() => {
    bumpSceneToolsIdle();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (homeVerseAudioActive) {
      stopGoldenVerse();
      return;
    }
    yieldAmbientIfMusicAndAmbientOpen();
    void togglePlayScripture({ forcePause: true });
    setShellVerseWantPlaying(true);
    setHomeVerseAudioActive(true);
    void ensureAndroidVersePlaybackBatteryPermission(locale);
  }, [
    bumpSceneToolsIdle,
    homeVerseAudioActive,
    locale,
    stopGoldenVerse,
    togglePlayScripture,
  ]);

  useEffect(() => {
    homeVerseAudioActiveRef.current = homeVerseAudioActive;
    setHomeGoldenVerseSessionActive(homeVerseAudioActive);
    return () => setHomeGoldenVerseSessionActive(false);
  }, [homeVerseAudioActive]);
  useEffect(() => {
    displayedVerseKeyRef.current = displayedVerseKey;
  }, [displayedVerseKey]);
  useEffect(() => {
    forceVerseKeyRef.current = forceVerseKey;
  }, [forceVerseKey]);

  useEffect(() => {
    setWidgetVersePlaying(
      homeVerseAudioActive && (homeVerseAudio.playing || homeVerseAudio.preparing),
    );
    return () => setWidgetVersePlaying(false);
  }, [homeVerseAudio.playing, homeVerseAudio.preparing, homeVerseAudioActive]);

  // 金句朗读时：挂件钉住 App 当前句并停墙钟轮换；停播后解冻。
  useEffect(() => {
    const key = (forceVerseKey || displayedVerseKey || "").trim() || null;
    syncWidgetDisplayedVerseFollow({
      verseKey: key,
      frozen: homeVerseAudioActive,
    });
  }, [displayedVerseKey, forceVerseKey, homeVerseAudioActive]);

  // 读经计划开播时停金句（续播 / 壳层播放也会走到这里）。
  useEffect(() => {
    if (!(playbackMode === "scripture" && playing)) return;
    if (!homeVerseAudioActiveRef.current) return;
    stopGoldenVerse();
  }, [playbackMode, playing, stopGoldenVerse]);

  useEffect(() => {
    const applyVersePlay = (key: string) => {
      const normalized = key.trim().toUpperCase();
      if (!normalized) return;
      const current =
        (forceVerseKeyRef.current || displayedVerseKeyRef.current || "").trim().toUpperCase();
      if (homeVerseAudioActiveRef.current && (!current || current === normalized)) {
        stopGoldenVerse();
        return;
      }
      void (async () => {
        await togglePlayScripture({ forcePause: true });
        setForceVerseKey(normalized);
        yieldAmbientIfMusicAndAmbientOpen();
        setShellVerseWantPlaying(true);
        setHomeVerseAudioActive(true);
      })();
    };
    const unsubPlay = subscribeWidgetVersePlayRequest(applyVersePlay);
    const unsubStop = subscribeWidgetVerseStopRequest(() => {
      stopGoldenVerse();
    });
    const queued = consumeQueuedWidgetVerseKey();
    if (queued) applyVersePlay(queued);
    return () => {
      unsubPlay();
      unsubStop();
    };
  }, [stopGoldenVerse, togglePlayScripture]);

  const liveVideoEnabled = load.liveVideoEnabled;
  /** 关模糊 = 开循环视频；尊重用户开关。 */
  const showLiveVideo = liveVideoEnabled;
  const preferSoftPoster = !showLiveVideo;
  const videoPowerPolicy = useHomeNatureVideoPowerPolicy({
    liveVideoEnabled,
  });
  // wantPlaying / 原生实播：UI playing 抖 false 时仍算音乐在播（混音 + 图标）。
  const musicModeActive = isShellMusicChromeActive({
    playbackMode,
    playing,
    wantPlaying: musicSignals.wantPlaying,
    nativePlaying: musicSignals.nativePlaying,
  });
  // 金句可与静音封面同在；读经需卸视频，否则安卓会抢会话把朗读掐掉。
  // 音乐不再强制静帧：只暂停封面解码，避免切海报抖动。
  const forcePosterStage =
    coverVideoPosterOnly || videoPowerPolicy.preferPosterStage || scriptureAudioLocksVideo;

  const toggleSceneTools = useCallback(() => {
    bumpSceneToolsIdle();
    setSceneToolsOpen((open) => !open);
  }, [bumpSceneToolsIdle]);

  useEffect(() => {
    if (!sceneToolsOpen) return;
    const id = setTimeout(() => setSceneToolsOpen(false), HOME_SCENE_TOOLS_AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [sceneToolsOpen, sceneToolsIdleEpoch]);

  const toggleAmbientSlotWithCap = useCallback(
    (slotId: NatureAmbientSceneSlotId) => {
      bumpSceneToolsIdle();
      const turningOn = load.activeAmbientSlotId !== slotId;
      // 人声（金句/读经）+ 音乐已占两路：再开环境音时停音乐。toggle 在读经模式下不会停音乐。
      if (turningOn && shouldYieldMusicWhenOpeningAmbient()) {
        void pauseShellPlayback();
      }
      load.toggleAmbientSlot(slotId);
    },
    [bumpSceneToolsIdle, load, pauseShellPlayback],
  );

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
    preferSoftPoster,
    videoPowerPolicy,
    musicModeActive,
    scriptureModeActive,
    // 金句文件朗读也算「人声」：环境音 duck 到 30%；与音乐同开时音乐亦 30%。
    voiceActive: verseSpeech.voiceActive || homeVerseAudioActive,
    enabled: startupReady,
  });

  const immersive = useHomeNatureImmersive({
    insets,
    hasVideoStage: scene.hasVideoStage,
    loading: load.loading,
    error: load.error,
    settingsOpen: navMenuOpen,
    showSceneLoader: scene.showSceneLoader,
    sceneId: scene.sceneId,
    sceneList: scene.sceneList,
    selectScene: scene.selectScene,
    enabled: startupReady,
    idleEpoch: sceneToolsIdleEpoch,
  });

  useEffect(() => {
    void setMusicGain(verseSpeech.voiceActive || homeVerseAudioActive ? 0.3 : 1);
  }, [homeVerseAudioActive, setMusicGain, verseSpeech.voiceActive]);

  // 点专辑会把 gain 拉回专辑默认；金句仍在时再压回去，保证叠播而不是全音量盖住人声。
  useEffect(() => {
    if (!(verseSpeech.voiceActive || homeVerseAudioActive)) return;
    void setMusicGain(0.3);
  }, [homeVerseAudioActive, musicSignals, setMusicGain, trackIndex, verseSpeech.voiceActive]);

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

  useEffect(() => {
    if (settingsLoggedRef.current || !load.settings?.videos.length) return;
    settingsLoggedRef.current = true;
    logStartupTiming("home", "settings_ready", `videos=${load.settings.videos.length}`);
  }, [load.settings]);

  useEffect(() => {
    if (videoMountedLoggedRef.current || !load.videoStageMounted) return;
    videoMountedLoggedRef.current = true;
    logStartupTiming("home", "video_stage_mounted");
  }, [load.videoStageMounted]);

  const hideLandscapePlayBar = immersive.showLandscapeVideo && immersive.showAutoImmersive;
  useEffect(() => {
    if (!hideLandscapePlayBar) return;
    setSceneToolsOpen(false);
  }, [hideLandscapePlayBar]);

  if (load.loading && !load.settings?.videos.length) {
    return <AppLogoSplash />;
  }

  const videoBackdropStyle =
    Platform.OS === "android"
      ? {
          ...shellFullBleedBackdropStyle(fullBleedFrame),
          bottom: -Math.max(insets.bottom, 0),
        }
      : styles.fullBleedBackdropFill;

  return (
    <View style={styles.root}>
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
        verseAudioActive={homeVerseAudioActive || verseSpeech.voiceActive}
        scriptureAudioActive={scriptureAudioLocksVideo}
        handleSceneVideoReady={scene.handleSceneVideoReady}
        videoPowerPolicy={videoPowerPolicy}
        showSceneLoader={scene.showSceneLoader}
      />

      <HomeNatureScreenInteractionLayer
        autoImmersive={immersive.showAutoImmersive}
        enabled={!navMenuOpen}
        onInteraction={immersive.toggleHomeChrome}
      />

      <HomeVerseOverlay
        prefsVersion={load.prefsVersion}
        layout={immersive.showLandscapeVideo ? "homeLandscape" : "home"}
        elevateAboveImmersiveTap={immersive.showAutoImmersive}
        forceVerseKey={forceVerseKey}
        pauseRotation={
          // 金句朗读中只走「播完 → 间隔 → 下一句」，禁止停留时间轮换中途掐断。
          homeVerseAudioActive ||
          verseSpeech.voicePreparing ||
          verseSpeech.voiceSpeaking ||
          (!load.homeFocused && !homeVerseAudioActive)
        }
        onVerseBodyPress={openDisplayedVerseInBible}
        onDisplayedVerseChange={handleDisplayedVerseChange}
        onAdvanceControllerReady={handleAdvanceControllerReady}
        onVerseQueueControllerReady={handleVerseQueueControllerReady}
      />

      <HomeNatureScreenTopChrome
        insets={insets}
        locale={locale}
        hidden={hideLandscapePlayBar}
        sceneToolsOpen={sceneToolsOpen}
        ambientActive={!!load.activeAmbientSlotId}
        onToggleSceneTools={toggleSceneTools}
        onUserActivity={bumpSceneToolsIdle}
        homeTtsExperimentEnabled={verseSpeech.homeTtsExperimentEnabled}
        voicePreparing={verseSpeech.voicePreparing}
        voiceSpeaking={verseSpeech.voiceSpeaking}
        onPlayDisplayedVerseVoice={verseSpeech.onPlayDisplayedVerseVoice}
      />

      <HomeNatureScreenBottomBand
        locale={locale}
        baseUrl={load.baseUrl}
        landscapeLayout={immersive.showLandscapeVideo}
        hidden={hideLandscapePlayBar}
        sceneStripBottomPad={immersive.bottomNavSlot}
        sceneToolsOpen={sceneToolsOpen}
        onToggleSceneTools={toggleSceneTools}
        activeAmbientSlotId={load.activeAmbientSlotId}
        toggleAmbientSlot={toggleAmbientSlotWithCap}
        ambientStripViewportWidth={ambientStripViewportWidth}
        onAmbientStripLayout={setAmbientStripViewportWidth}
        sceneScrollRef={scene.sceneScrollRef}
        sceneList={scene.sceneList}
        sceneStripViewportWidth={scene.sceneStripViewportWidth}
        onSceneStripLayout={scene.onSceneStripLayout}
        loopAllScenesEnabled={load.loopAllScenesEnabled}
        sceneId={scene.sceneId}
        selectScene={(id, opts) => {
          bumpSceneToolsIdle();
          scene.selectScene(id, opts);
        }}
        goldenVerseOn={homeVerseAudioActive}
        goldenVersePreparing={homeVerseAudio.preparing}
        onToggleGoldenVerse={toggleGoldenVerse}
        onUserActivity={bumpSceneToolsIdle}
        liveVideoActive={liveVideoEnabled}
        onToggleLiveVideo={() => {
          bumpSceneToolsIdle();
          const next = !liveVideoEnabled;
          // 乐观更新：芯片立刻动；低电量时仍可能只出静帧，但开关不再「卡住」。
          load.setLiveVideoEnabled(next);
          if (next) clearCoverVideoSessionPosterOnly();
          void writeNatureLiveVideoEnabled(next).then(load.onPrefsChanged);
        }}
        prefsVersion={load.prefsVersion}
        onPrefsChanged={() => {
          bumpSceneToolsIdle();
          load.onPrefsChanged();
        }}
      />
    </View>
  );
}
