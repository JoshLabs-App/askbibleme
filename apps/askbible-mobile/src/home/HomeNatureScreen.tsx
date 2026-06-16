import { ShellMaterialIcon } from "../shell/ShellMaterialIcon";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import * as Speech from "expo-speech";
import { configureShellAudioMode } from "../audio/shellAudioMode";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Image,
  InteractionManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { EdgeFadeHorizontalScrollView } from "../ui/EdgeFadeHorizontalScrollView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ensureNatureSettingsLocallyPlayable,
  fetchNatureSettings,
  getBundledNatureSettings,
} from "../api/fetchNatureSettings";
import { isMobileBundledOnly, isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { parchmentSans } from "../fonts/parchmentType";
import { getNatureRemoteAssetBaseUrl } from "../bible/chapter-audio-url";
import { ensureNatureResourcePackSync } from "../media/natureResourcePackSync";
import { toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { resolveLocalizedField, resolveUiText, t, toZhTwText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import { useLocale } from "../i18n/LocaleProvider";
import { readParchmentTheme as parchment } from "../read/readParchmentTheme";
import {
  readNatureActiveSceneId,
  readNatureLoopAllScenesEnabled,
  writeNatureActiveSceneId,
  writeNatureLoopAllScenesEnabled,
} from "../nature/natureActiveScenePrefs";
import {
  readNatureAmbientSceneSlotId,
  writeNatureAmbientSceneSlotId,
} from "../nature/natureAmbientScenePrefs";
import { useShellSwipeAction } from "../shell/useShellSwipeAction";
import { resolveNaturePlayback } from "../nature/resolveNaturePlayback";
import type { NatureSettingsV2, NatureVideoEntry } from "../types/nature";
import {
  getCoverVideoPosterOnly,
  subscribeCoverVideoPosterOnly,
} from "./coverVideoPosterFallback";
import { FullBleedCoverVideo } from "./FullBleedCoverVideo";
import { isNatureCoverPlaybackPlayable } from "./natureCoverPlayback";
import { NatureHomeSoftFocusLayer } from "./NatureHomeSoftFocusLayer";
import {
  ShellSwipeExclude,
  useShellSwipeExcludeHandlers,
} from "../shell/ShellSwipeExclude";
import { HomeVerseOverlay } from "./HomeVerseOverlay";
import {
  HOME_SCENE_THUMB_GAP,
  homeSceneStripContentWidth,
  homeSceneStripScrollX,
  HomeSceneThumb,
} from "./HomeSceneThumb";
import { NatureHomeSettingsPanel } from "./NatureHomeSettingsPanel";
import {
  DEFAULT_SOFT_FOCUS,
  readNatureSoftFocusPrefs,
  type NatureSoftFocusPrefs,
} from "./natureHomePrefs";
import { setHomeAutoHideChrome, setHomeLandscapeImmersive } from "./homeLandscapeImmersive";
import { useHomeOrientationUnlock } from "./useHomeOrientationUnlock";
import {
  SHELL_TAB_BAR_CLEARANCE,
  shellFullBleedBackdropStyle,
  useShellFullBleedFrame,
} from "../shell/shellLayout";
import { useLandscapeNarrow } from "./useLandscapeNarrow";
import type { NatureCoverPlayback } from "./natureCoverPlayback";
import {
  preloadAdjacentNatureSceneVideos,
  resolveNatureCoverPlayback,
  resolveNaturePosterPlaybackModule,
  resolveNaturePosterPlaybackUri,
} from "../media/bundledNatureMedia";
import {
  ensureNatureSceneVideoReady,
  isNatureSceneVideoReady,
  markNatureSceneVideoReady,
} from "../media/natureSceneReadiness";
import { useNatureResourcePackSync } from "../media/useNatureResourcePackSync";
import { trackTelemetry } from "../telemetry/client";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { AppLogoSplash } from "../shell/AppLogoSplash";
import { useNatureAmbientMix } from "../nature/useNatureAmbientMix";
import {
  NATURE_AMBIENT_SCENE_SLOTS,
  type NatureAmbientSceneSlotId,
} from "../nature/ambientSceneSlots";
import { BUNDLED_AMBIENT_SCENE_AUDIO } from "../nature/bundledAmbientSceneAudio";
import {
  bumpNatureSceneUsage,
  readNatureSceneUsageMap,
  sortNatureScenesByUsage,
  type NatureSceneUsageMap,
} from "../nature/natureSceneUsage";
import { parseVerseKey } from "../bible/parse-verse-key";
import {
  DEFAULT_NATURE_HOME_TTS_PREFS,
  getNatureHomeTtsPrefsVersion,
  readNatureHomeTtsPrefs,
  subscribeNatureHomeTtsPrefs,
  ttsPitchFromLevel,
  ttsRateFromLevel,
  type NatureHomeTtsPrefs,
} from "./natureHomePrefs";
import { filterNonFemaleTtsVoices, resolveMaleTtsVoiceId, type NatureHomeTtsDeviceVoice } from "./natureHomeTtsVoices";
import {
  getHomeTtsExperimentEnabled,
  subscribeHomeTtsExperiment,
} from "./homeExperimentalFeatures";

const bundledOnBoot = getBundledNatureSettings();
/** Release 安装包内已有场景时秒开，避免 TestFlight 首启等网络卡在占位屏。 */
const bootWithBundled =
  isMobileBundledOnly() || (!__DEV__ && bundledOnBoot.videos.length > 0);
const AUTO_IMMERSIVE_DELAY_MS = 60_000;
const HOME_VOICE_NEXT_DELAY_MS = 5000;
const HOME_VOICE_REFERENCE_DELAY_MS = 1000;
const HOME_VOICE_TEXT_APPEAR_DELAY_MS = 2000;

/** 与 `EdgeFadeHorizontalScrollView` 缘渐隐宽度一致，保证最后一项可滚出渐隐区 */
const HOME_SCENE_STRIP_EDGE_PAD = 22;
const AMBIENT_ICON_SIZE = 28;
const AMBIENT_ICON_GAP = 10;
const SCENE_LOOP_ALL_ID = "__askbible_all_scene_loop__";
const SCENE_LOOP_SWITCH_MS = 30 * 60 * 1000;

function ambientStripContentWidth(count: number): number {
  if (count <= 0) return HOME_SCENE_STRIP_EDGE_PAD * 2;
  return (
    count * AMBIENT_ICON_SIZE +
    Math.max(0, count - 1) * AMBIENT_ICON_GAP +
    HOME_SCENE_STRIP_EDGE_PAD * 2
  );
}

function displayTitle(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && raw !== null && ("zh-CN" in (raw as object) || "en" in (raw as object))) {
    return resolveLocalizedField(raw as { "zh-CN"?: string; en?: string });
  }
  return "";
}

function ambientIconColor(selected: boolean, enabled: boolean): string {
  if (!enabled) return "rgba(255,255,255,0.15)";
  return selected ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.3)";
}

export function HomeNatureScreen() {
  const { locale } = useLocale();
  const [homeFocused, setHomeFocused] = useState(true);
  const homeFocusedRef = useRef(true);
  const naturePackRev = useNatureResourcePackSync(homeFocused);
  const insets = useSafeAreaInsets();
  const sceneStripSwipeExclude = useShellSwipeExcludeHandlers();
  const baseUrl = getNatureRemoteAssetBaseUrl();
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const landscapeNarrow = useLandscapeNarrow();
  const fullBleedFrame = useShellFullBleedFrame();
  const { togglePlayMusic, setMusicGain, playing, playbackMode, tracks, scripturePreparing } =
    useMusicPlayback();
  const homeTtsExperimentEnabled = useSyncExternalStore(
    subscribeHomeTtsExperiment,
    getHomeTtsExperimentEnabled,
    getHomeTtsExperimentEnabled,
  );
  const coverVideoPosterOnly = useSyncExternalStore(
    subscribeCoverVideoPosterOnly,
    getCoverVideoPosterOnly,
    getCoverVideoPosterOnly,
  );
  const ttsPrefsVersion = useSyncExternalStore(
    subscribeNatureHomeTtsPrefs,
    getNatureHomeTtsPrefsVersion,
    getNatureHomeTtsPrefsVersion,
  );
  const [landscapeScenePickerOpen, setLandscapeScenePickerOpen] = useState(false);

  useHomeOrientationUnlock();

  useEffect(() => {
    if (!homeFocused) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void ensureNatureResourcePackSync();
    });
    return () => task.cancel();
  }, [homeFocused]);

  const [loading, setLoading] = useState(() => !bootWithBundled || bundledOnBoot.videos.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<NatureSettingsV2 | null>(() =>
    bootWithBundled && bundledOnBoot.videos.length > 0 ? bundledOnBoot : null,
  );
  const [localActiveId, setLocalActiveId] = useState(() => {
    const id =
      bootWithBundled && bundledOnBoot.videos.length > 0
        ? bundledOnBoot.activeVideoId?.trim() || bundledOnBoot.videos[0]?.id || ""
        : "";
    return id;
  });
  const [loopAllScenesEnabled, setLoopAllScenesEnabled] = useState(false);
  const [softFocus, setSoftFocus] = useState<NatureSoftFocusPrefs>(DEFAULT_SOFT_FOCUS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefsVersion, setPrefsVersion] = useState(0);
  /** 正在等待首帧的场景；本机已就绪则不设置 */
  const [waitingSceneId, setWaitingSceneId] = useState<string | null>(null);
  const [showSceneLoader, setShowSceneLoader] = useState(false);
  const [autoImmersiveActive, setAutoImmersiveActive] = useState(false);
  const [hasHomeInteraction, setHasHomeInteraction] = useState(false);
  const [activeAmbientSlotId, setActiveAmbientSlotId] = useState<NatureAmbientSceneSlotId | "">("");
  const [ambientStripViewportWidth, setAmbientStripViewportWidth] = useState(0);
  const [displayedVerseAudioTarget, setDisplayedVerseAudioTarget] = useState<{
    verseKey: string;
    translationId: string;
    speechMain: string;
    speechReference: string;
    speechLocale: AppLocale;
  } | null>(null);
  const [voicePreparing, setVoicePreparing] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const [sceneUsageMap, setSceneUsageMap] = useState<NatureSceneUsageMap>({});
  /** 首帧后再挂视频层，避免与启动音频会话 / 导航切换抢 native 资源导致闪退。 */
  const [videoStageMounted, setVideoStageMounted] = useState(false);
  const videoStageMountedOnceRef = useRef(false);
  const [ttsPrefs, setTtsPrefs] = useState<NatureHomeTtsPrefs>(DEFAULT_NATURE_HOME_TTS_PREFS);
  const homeVoiceSessionIdRef = useRef(0);
  const ttsPrefsRef = useRef<NatureHomeTtsPrefs>(DEFAULT_NATURE_HOME_TTS_PREFS);
  const ttsVoiceCatalogRef = useRef<NatureHomeTtsDeviceVoice[]>([]);
  const displayedVerseAudioTargetRef = useRef<{
    verseKey: string;
    translationId: string;
    speechMain: string;
    speechReference: string;
    speechLocale: AppLocale;
  } | null>(null);
  const advanceVerseRef = useRef<(() => Promise<void>) | null>(null);
  const sceneScrollRef = useRef<ScrollView>(null);
  const sceneStripViewportW = useRef(0);
  const [sceneStripViewportWidth, setSceneStripViewportWidth] = useState(0);
  const autoImmersiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySettings = useCallback((data: NatureSettingsV2, stored: string | null) => {
    const playable = ensureNatureSettingsLocallyPlayable(data, baseUrl);
    setSettings(playable);
    const id =
      (stored?.trim() && playable.videos.some((v) => v.id === stored.trim()) ? stored.trim() : "") ||
      playable.activeVideoId?.trim() ||
      playable.videos[0]?.id ||
      "";
    setLocalActiveId(id);
  }, [baseUrl]);

  const hydrateNatureHomePrefs = useCallback(
    async (data: NatureSettingsV2) => {
      const [stored, sf, storedAmbient, loopAllScenes, usage] = await Promise.all([
        readNatureActiveSceneId(),
        readNatureSoftFocusPrefs(),
        readNatureAmbientSceneSlotId(),
        readNatureLoopAllScenesEnabled(),
        readNatureSceneUsageMap(),
      ]);
      applySettings(data, stored);
      setLoopAllScenesEnabled(loopAllScenes);
      setSoftFocus(sf);
      setSceneUsageMap(usage);
      if (
        storedAmbient &&
        (typeof BUNDLED_AMBIENT_SCENE_AUDIO[storedAmbient as NatureAmbientSceneSlotId] === "number" ||
          data.ambientClips.some((clip) => clip.id === storedAmbient))
      ) {
        setActiveAmbientSlotId(storedAmbient as NatureAmbientSceneSlotId);
      } else {
        setActiveAmbientSlotId("");
      }
    },
    [applySettings],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const [data, stored, sf, storedAmbient, loopAllScenes, usage] = await Promise.all([
          fetchNatureSettings(),
          readNatureActiveSceneId(),
          readNatureSoftFocusPrefs(),
          readNatureAmbientSceneSlotId(),
          readNatureLoopAllScenesEnabled(),
          readNatureSceneUsageMap(),
        ]);
        applySettings(data, stored);
        setLoopAllScenesEnabled(loopAllScenes);
        setSoftFocus(sf);
        setSceneUsageMap(usage);
        if (
          storedAmbient &&
          (typeof BUNDLED_AMBIENT_SCENE_AUDIO[storedAmbient as NatureAmbientSceneSlotId] === "number" ||
            data.ambientClips.some((clip) => clip.id === storedAmbient))
        ) {
          setActiveAmbientSlotId(storedAmbient as NatureAmbientSceneSlotId);
        } else {
          setActiveAmbientSlotId("");
        }
        setError(null);
      } catch (e) {
        if (!opts?.silent) {
          setError(e instanceof Error ? e.message : String(e));
          setSettings(null);
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [applySettings],
  );

  const refreshSoftFocusPrefs = useCallback(() => {
    void readNatureSoftFocusPrefs().then(setSoftFocus);
  }, []);

  const onPrefsChanged = useCallback(() => {
    setPrefsVersion((n) => n + 1);
    refreshSoftFocusPrefs();
  }, [refreshSoftFocusPrefs]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void readNatureSoftFocusPrefs().then(setSoftFocus);
      });
      return () => task.cancel();
    }, []),
  );

  useEffect(() => {
    if (!homeFocused) {
      setVideoStageMounted(false);
      return;
    }
    if (videoStageMountedOnceRef.current) {
      setVideoStageMounted(true);
      return;
    }
    const timer = setTimeout(() => {
      videoStageMountedOnceRef.current = true;
      setVideoStageMounted(true);
    }, 320);
    return () => clearTimeout(timer);
  }, [homeFocused]);

  useEffect(() => {
    if (!homeFocused) return;
    const bundled = getBundledNatureSettings();
    let prefsTask: { cancel: () => void } | null = null;
    if (bootWithBundled && bundled.videos.length > 0) {
      setSettings((prev) => {
        if (prev?.videos.length) return prev;
        return ensureNatureSettingsLocallyPlayable(bundled, baseUrl);
      });
      setLoading(false);
      prefsTask = InteractionManager.runAfterInteractions(() => {
        void hydrateNatureHomePrefs(bundled);
      });
    }
    if (isMobileBundledOnly()) {
      return () => prefsTask?.cancel();
    }
    const silent = bootWithBundled && bundled.videos.length > 0;
    const runLoad = () => void load({ silent });
    if (isMobileOfflineFirst()) {
      runLoad();
      return () => prefsTask?.cancel();
    }
    const loadTask = InteractionManager.runAfterInteractions(runLoad);
    return () => {
      prefsTask?.cancel();
      loadTask.cancel();
    };
  }, [baseUrl, homeFocused, hydrateNatureHomePrefs, load]);

  useEffect(() => {
    if (!homeFocused || naturePackRev <= 0) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void load({ silent: true });
    });
    return () => task.cancel();
  }, [homeFocused, naturePackRev, load]);

  const rawSceneId = (localActiveId || settings?.activeVideoId || "").trim();
  const sceneId = useMemo(() => {
    if (!settings?.videos.length) return rawSceneId;
    if (rawSceneId && settings.videos.some((v) => v.id === rawSceneId)) return rawSceneId;
    return settings.videos[0]?.id ?? "";
  }, [rawSceneId, settings]);

  useEffect(() => {
    if (!settings?.videos.length) return;
    if (!sceneId || localActiveId === sceneId) return;
    setLocalActiveId(sceneId);
    void writeNatureActiveSceneId(sceneId);
  }, [sceneId, localActiveId, settings]);
  const currentRow = useMemo(() => {
    if (!settings?.videos.length) return null;
    return settings.videos.find((v) => v.id === sceneId) ?? settings.videos[0] ?? null;
  }, [settings, sceneId]);

  const playback = useMemo(() => {
    if (!settings) return null;
    return resolveNaturePlayback({
      ...settings,
      activeVideoId: sceneId,
    });
  }, [settings, sceneId]);

  const resolveScenePlayback = useCallback(
    (id: string): NatureCoverPlayback | null => {
      void naturePackRev;
      if (!settings?.videos.length) return null;
      const row = settings.videos.find((v) => v.id === id) ?? null;
      if (!row) return null;
      const pb = resolveNaturePlayback({ ...settings, activeVideoId: id });
      const remote = pb?.videoSrc ? toAbsoluteUrl(baseUrl, pb.videoSrc) : "";
      const resolved = resolveNatureCoverPlayback(id, remote);
      if (resolved.bundledModule != null || resolved.uri.trim()) return resolved;
      if (!pb?.videoSrc) return null;
      return resolved;
    },
    [settings, baseUrl, naturePackRev],
  );

  const currentPlayback = useMemo(
    () => (sceneId ? resolveScenePlayback(sceneId) : null),
    [sceneId, resolveScenePlayback],
  );

  // 首启兜底：弱网 / 旧包配置异常时，最多 4.5s 后强制用安装包内场景进首页。
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setSettings((prev) => {
        if (prev?.videos.length) return ensureNatureSettingsLocallyPlayable(prev, baseUrl);
        const bundled = getBundledNatureSettings();
        return bundled.videos.length > 0 ? bundled : prev;
      });
      setLocalActiveId((prev) => {
        if (prev.trim()) return prev;
        const bundled = getBundledNatureSettings();
        return bundled.activeVideoId?.trim() || bundled.videos[0]?.id || prev;
      });
    }, 4500);
    return () => clearTimeout(timer);
  }, [baseUrl]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      void load({ silent: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [error, load]);

  const posterUri = useMemo(() => {
    void naturePackRev;
    if (!sceneId.trim()) return "";
    const remote = playback?.posterSrc?.trim()
      ? toAbsoluteUrl(baseUrl, playback.posterSrc.trim())
      : "";
    return resolveNaturePosterPlaybackUri(sceneId.trim(), remote) || remote;
  }, [sceneId, playback?.posterSrc, baseUrl, naturePackRev]);
  const posterModule = useMemo(
    () => (sceneId.trim() ? resolveNaturePosterPlaybackModule(sceneId.trim()) : null),
    [sceneId, naturePackRev],
  );
  const clampedRate = Math.min(2, Math.max(0.5, settings?.playbackRate ?? 1));

  const sceneList = useMemo(() => {
    const videos = settings?.videos ?? [];
    return sortNatureScenesByUsage(videos, sceneUsageMap);
  }, [settings, sceneUsageMap]);

  const ambientClipById = useMemo(
    () => new Map((settings?.ambientClips ?? []).map((clip) => [clip.id, clip])),
    [settings?.ambientClips],
  );

  useEffect(() => {
    if (!activeAmbientSlotId) return;
    const hasBundled = typeof BUNDLED_AMBIENT_SCENE_AUDIO[activeAmbientSlotId] === "number";
    if (hasBundled || ambientClipById.has(activeAmbientSlotId)) return;
    setActiveAmbientSlotId("");
  }, [activeAmbientSlotId, ambientClipById]);

  const musicModeActive = playbackMode === "music" && playing;
  const scriptureModeActive = playbackMode === "scripture" && (playing || scripturePreparing);
  const voiceActive = voicePreparing || voiceSpeaking;
  const activeAmbientLayer = useMemo(() => {
    if (!activeAmbientSlotId) return [];
    const assetModule = BUNDLED_AMBIENT_SCENE_AUDIO[activeAmbientSlotId];
    if (typeof assetModule !== "number") return [];
    const gain = scriptureModeActive
      ? 0
      : voiceActive
        ? 0.03
        : musicModeActive
          ? 0.2
          : 1;
    return [
      {
        layerId: activeAmbientSlotId,
        src: `bundled://${activeAmbientSlotId}`,
        volume: gain,
        assetModule,
      },
    ];
  }, [activeAmbientSlotId, musicModeActive, scriptureModeActive, voiceActive]);

  useEffect(() => {
    const targetMusicGain = voiceActive ? 0.3 : 1;
    void setMusicGain(targetMusicGain);
  }, [setMusicGain, voiceActive]);

  const ambientLayersKey = useMemo(
    () => activeAmbientLayer.map((layer) => `${layer.layerId}:${layer.src}`).join("|"),
    [activeAmbientLayer],
  );

  useNatureAmbientMix(
    "",
    activeAmbientLayer,
    ambientLayersKey,
    clampedRate,
    homeFocused && activeAmbientLayer.length > 0,
  );

  const sceneIdList = useMemo(() => sceneList.map((v) => v.id), [sceneList]);

  useEffect(() => {
    if (!homeFocused || !sceneId || loading || !sceneIdList.length) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void ensureNatureSceneVideoReady(sceneId);
      void preloadAdjacentNatureSceneVideos(sceneIdList, sceneId);
    });
    return () => task.cancel();
  }, [homeFocused, sceneId, sceneIdList, loading]);

  useEffect(() => {
    if (coverVideoPosterOnly) {
      setWaitingSceneId(null);
      setShowSceneLoader(false);
    }
  }, [coverVideoPosterOnly]);

  useEffect(() => {
    if (!waitingSceneId) {
      setShowSceneLoader(false);
      return;
    }
    if (coverVideoPosterOnly) {
      setWaitingSceneId(null);
      setShowSceneLoader(false);
      return;
    }
    if (Platform.OS === "android" && softFocus.blurPx > 0.02) {
      setWaitingSceneId(null);
      setShowSceneLoader(false);
      return;
    }
    if (isNatureSceneVideoReady(waitingSceneId)) {
      setWaitingSceneId(null);
      return;
    }
    const timer = setTimeout(() => setShowSceneLoader(true), 220);
    return () => clearTimeout(timer);
  }, [coverVideoPosterOnly, waitingSceneId, softFocus.blurPx]);

  useEffect(() => {
    if (!homeFocused) return;
    if (Platform.OS !== "android") return;
    if (coverVideoPosterOnly) return;
    if (softFocus.blurPx > 0.02) return;
    const current = sceneId.trim();
    if (!current) return;
    if (isNatureSceneVideoReady(current)) {
      setWaitingSceneId(null);
      return;
    }
    setWaitingSceneId(current);
    const task = InteractionManager.runAfterInteractions(() => {
      void ensureNatureSceneVideoReady(current);
    });
    return () => task.cancel();
  }, [coverVideoPosterOnly, homeFocused, sceneId, softFocus.blurPx]);

  const handleSceneVideoReady = useCallback((id: string) => {
    markNatureSceneVideoReady(id);
    setWaitingSceneId((pending) => (pending === id ? null : pending));
  }, []);

  const scrollSceneStripToId = useCallback(
    (id: string, animated = true) => {
      if (!id || sceneList.length < 2) return;
      const idx = sceneList.findIndex((v) => v.id === id);
      if (idx < 0) return;
      const vw = sceneStripViewportW.current;
      if (vw < 1) return;
      const target = homeSceneStripScrollX(idx + 1, vw, sceneList.length + 2, HOME_SCENE_STRIP_EDGE_PAD);
      sceneScrollRef.current?.scrollTo({ x: target, animated });
    },
    [sceneList],
  );

  const preloadAdjacentWhenFocused = useCallback(
    (list: readonly string[], activeId: string) => {
      if (!homeFocusedRef.current) return;
      InteractionManager.runAfterInteractions(() => {
        void preloadAdjacentNatureSceneVideos(list, activeId);
      });
    },
    [],
  );

  const selectScene = useCallback(
    (id: string, opts?: { keepLoopMode?: boolean; source?: "user" | "auto" }) => {
      const next = id.trim();
      if (!next) return;
      if (!opts?.keepLoopMode) {
        setLoopAllScenesEnabled(false);
        void writeNatureLoopAllScenesEnabled(false);
      }
      if (next === sceneId) return;
      if (opts?.source !== "auto") {
        void bumpNatureSceneUsage(next).then(setSceneUsageMap);
      }
      scrollSceneStripToId(next);
      void writeNatureActiveSceneId(next);

      if (coverVideoPosterOnly || (Platform.OS === "android" && softFocus.blurPx > 0.02)) {
        setWaitingSceneId(null);
        setShowSceneLoader(false);
        setLocalActiveId(next);
        void preloadAdjacentWhenFocused(sceneIdList, next);
        return;
      }

      if (isNatureSceneVideoReady(next)) {
        setWaitingSceneId(null);
        setShowSceneLoader(false);
        setLocalActiveId(next);
        void preloadAdjacentWhenFocused(sceneIdList, next);
        return;
      }

      setWaitingSceneId(next);
      setLocalActiveId(next);
      void ensureNatureSceneVideoReady(next);
      void preloadAdjacentWhenFocused(sceneIdList, next);
    },
    [coverVideoPosterOnly, preloadAdjacentWhenFocused, sceneId, sceneIdList, scrollSceneStripToId, softFocus.blurPx],
  );

  const toggleAmbientSlot = useCallback((slotId: NatureAmbientSceneSlotId) => {
    setActiveAmbientSlotId((prev) => {
      const next = prev === slotId ? "" : slotId;
      void writeNatureAmbientSceneSlotId(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!sceneId || loading) return;
    const task = InteractionManager.runAfterInteractions(() => {
      scrollSceneStripToId(sceneId);
    });
    return () => task.cancel();
  }, [loading, sceneId, scrollSceneStripToId]);

  const prevSceneRef = useRef<string | null>(null);
  const sceneSessionStartRef = useRef(0);

  useEffect(() => {
    if (!sceneId || loading) return;
    const task = InteractionManager.runAfterInteractions(() => {
      const prev = prevSceneRef.current;
      if (prev && prev !== sceneId) {
        trackTelemetry("scene_session", {
          scene_id: prev,
          duration_ms: Date.now() - sceneSessionStartRef.current,
        });
      }
      if (prev !== sceneId) {
        trackTelemetry("scene_view", { scene_id: sceneId });
        prevSceneRef.current = sceneId;
        sceneSessionStartRef.current = Date.now();
      }
    });
    return () => task.cancel();
  }, [sceneId, loading]);

  useEffect(() => {
    return () => {
      const prev = prevSceneRef.current;
      if (!prev) return;
      trackTelemetry("scene_session", {
        scene_id: prev,
        duration_ms: Date.now() - sceneSessionStartRef.current,
      });
      prevSceneRef.current = null;
    };
  }, []);

  const landscapeImmersive = landscapeNarrow;
  const hasVideoStage =
    !loading &&
    !error &&
    Boolean(settings && playback && isNatureCoverPlaybackPlayable(currentPlayback));
  const showLandscapeVideo = landscapeImmersive && hasVideoStage;
  const canArmAutoImmersive =
    hasVideoStage &&
    !loading &&
    !error &&
    !settingsOpen &&
    !landscapeScenePickerOpen &&
    !showSceneLoader;
  const showAutoImmersive = autoImmersiveActive && canArmAutoImmersive;
  const showFullscreenVideo = showLandscapeVideo;
  const androidBlurUsesPosterStage =
    Platform.OS === "android" && (softFocus.blurPx > 0.02 || coverVideoPosterOnly);
  const videoBackdropStyle = useMemo(
    () => (showFullscreenVideo ? styles.fullBleedBackdropFill : shellFullBleedBackdropStyle(fullBleedFrame)),
    [fullBleedFrame, showFullscreenVideo],
  );

  const onSceneSwipe = useCallback(
    (direction: "left" | "right") => {
      if (sceneList.length < 2) return;
      const idx = sceneList.findIndex((v) => v.id === sceneId);
      if (idx < 0) return;
      const nextIdx = idx + (direction === "left" ? -1 : 1);
      if (nextIdx < 0 || nextIdx >= sceneList.length) return;
      selectScene(sceneList[nextIdx]!.id);
    },
    [sceneList, sceneId, selectScene],
  );

  useShellSwipeAction(
    !showAutoImmersive &&
      !loading &&
      !error &&
      sceneList.length > 1 &&
      (!showLandscapeVideo || !landscapeScenePickerOpen),
    onSceneSwipe,
  );

  useEffect(() => {
    if (!loopAllScenesEnabled) return;
    if (sceneList.length < 2) return;
    const timer = setInterval(() => {
      const idx = sceneList.findIndex((v) => v.id === sceneId);
      const nextIdx = idx >= 0 ? (idx + 1) % sceneList.length : 0;
      const nextId = sceneList[nextIdx]?.id;
      if (!nextId) return;
      selectScene(nextId, { keepLoopMode: true, source: "auto" });
    }, SCENE_LOOP_SWITCH_MS);
    return () => clearInterval(timer);
  }, [loopAllScenesEnabled, sceneId, sceneList, selectScene]);

  const bottomNavSlot = SHELL_TAB_BAR_CLEARANCE + insets.bottom;

  useEffect(() => {
    setHomeLandscapeImmersive(landscapeImmersive);
    return () => setHomeLandscapeImmersive(false);
  }, [landscapeImmersive]);

  useEffect(() => {
    setHomeAutoHideChrome(showAutoImmersive);
    return () => setHomeAutoHideChrome(false);
  }, [showAutoImmersive]);

  useEffect(() => {
    if (!showLandscapeVideo) setLandscapeScenePickerOpen(false);
  }, [showLandscapeVideo]);

  const clearAutoImmersiveTimer = useCallback(() => {
    if (!autoImmersiveTimerRef.current) return;
    clearTimeout(autoImmersiveTimerRef.current);
    autoImmersiveTimerRef.current = null;
  }, []);

  const armAutoImmersiveTimer = useCallback(() => {
    clearAutoImmersiveTimer();
    if (!canArmAutoImmersive) return;
    autoImmersiveTimerRef.current = setTimeout(() => {
      setAutoImmersiveActive(true);
    }, AUTO_IMMERSIVE_DELAY_MS);
  }, [canArmAutoImmersive, clearAutoImmersiveTimer]);

  const markHomeInteraction = useCallback(() => {
    if (!hasHomeInteraction) setHasHomeInteraction(true);
    if (autoImmersiveActive) setAutoImmersiveActive(false);
    armAutoImmersiveTimer();
  }, [hasHomeInteraction, autoImmersiveActive, armAutoImmersiveTimer]);

  useEffect(() => {
    if (!hasHomeInteraction) {
      clearAutoImmersiveTimer();
      if (autoImmersiveActive) setAutoImmersiveActive(false);
      return;
    }
    if (showAutoImmersive) {
      clearAutoImmersiveTimer();
      return;
    }
    armAutoImmersiveTimer();
    return clearAutoImmersiveTimer;
  }, [hasHomeInteraction, autoImmersiveActive, showAutoImmersive, armAutoImmersiveTimer, clearAutoImmersiveTimer]);

  useEffect(() => {
    if (!voiceHint) return;
    const timer = setTimeout(() => setVoiceHint(null), 2200);
    return () => clearTimeout(timer);
  }, [voiceHint]);

  useEffect(() => {
    displayedVerseAudioTargetRef.current = displayedVerseAudioTarget;
  }, [displayedVerseAudioTarget]);

  useEffect(() => {
    ttsPrefsRef.current = ttsPrefs;
  }, [ttsPrefs]);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void readNatureHomeTtsPrefs().then((prefs) => {
        if (!cancelled) setTtsPrefs(prefs);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [prefsVersion, ttsPrefsVersion]);

  useFocusEffect(
    useCallback(() => {
      homeFocusedRef.current = true;
      setHomeFocused(true);
      void configureShellAudioMode();
      let cancelled = false;
      let voiceTask: { cancel: () => void } | null = null;
      if (homeTtsExperimentEnabled) {
        voiceTask = InteractionManager.runAfterInteractions(() => {
          void Speech.getAvailableVoicesAsync()
            .then((voices) => {
              if (cancelled) return;
              const catalog = filterNonFemaleTtsVoices(
                voices
                  .map((voice) => ({
                    identifier: String(voice.identifier || "").trim(),
                    name: typeof voice.name === "string" ? voice.name : undefined,
                    language: typeof voice.language === "string" ? voice.language : undefined,
                  }))
                  .filter((voice) => voice.identifier.length > 0),
              );
              ttsVoiceCatalogRef.current = catalog;
            })
            .catch(() => {
              if (!cancelled) {
                ttsVoiceCatalogRef.current = [];
              }
            });
        });
      }
      return () => {
        cancelled = true;
        voiceTask?.cancel();
        homeFocusedRef.current = false;
        setHomeFocused(false);
        homeVoiceSessionIdRef.current += 1;
        void Speech.stop();
        setVoicePreparing(false);
        setVoiceSpeaking(false);
      };
    }, [homeTtsExperimentEnabled]),
  );

  useEffect(() => {
    return () => {
      homeVoiceSessionIdRef.current += 1;
      void Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (!landscapeScenePickerOpen || !sceneId) return;
    scrollSceneStripToId(sceneId);
  }, [landscapeScenePickerOpen, sceneId, scrollSceneStripToId]);

  const onLandscapeSceneSelect = useCallback(
    (id: string) => {
      if (id.trim() !== sceneId) selectScene(id);
      setLandscapeScenePickerOpen(false);
    },
    [sceneId, selectScene],
  );

  const onLandscapeBackdropPress = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    if (landscapeScenePickerOpen) {
      setLandscapeScenePickerOpen(false);
      return;
    }
    if (playing) void togglePlayMusic();
    setLandscapeScenePickerOpen(true);
  }, [settingsOpen, landscapeScenePickerOpen, playing, togglePlayMusic]);

  const onPortraitBackdropPress = useCallback(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    if (showAutoImmersive) {
      markHomeInteraction();
      return;
    }
    setAutoImmersiveActive(true);
  }, [settingsOpen, showAutoImmersive, markHomeInteraction]);

  const onDisplayedVerseChange = useCallback(
    (payload: {
      verseKey: string | null;
      primaryTranslationId: string;
      speechMain: string;
      speechReference: string;
      speechLocale: AppLocale;
    }) => {
      const verseKey = payload.verseKey?.trim() || "";
      if (!verseKey || !parseVerseKey(verseKey)) {
        setDisplayedVerseAudioTarget(null);
        return;
      }
      setDisplayedVerseAudioTarget({
        verseKey,
        translationId: payload.primaryTranslationId || "cuv-simp",
        speechMain: payload.speechMain?.trim() || "",
        speechReference: payload.speechReference?.trim() || "",
        speechLocale: payload.speechLocale,
      });
    },
    [],
  );

  const onAdvanceControllerReady = useCallback((advanceNow: () => Promise<void>) => {
    advanceVerseRef.current = advanceNow;
  }, []);

  const stopHomeVerseSpeech = useCallback(async () => {
    homeVoiceSessionIdRef.current += 1;
    try {
      await Speech.stop();
    } catch {
      // ignore stop errors
    }
    setVoicePreparing(false);
    setVoiceSpeaking(false);
  }, []);

  useEffect(() => {
    if (homeTtsExperimentEnabled) return;
    setVoiceHint(null);
    void stopHomeVerseSpeech();
  }, [homeTtsExperimentEnabled, stopHomeVerseSpeech]);

  useEffect(() => {
    if (!scriptureModeActive) return;
    void stopHomeVerseSpeech();
  }, [scriptureModeActive, stopHomeVerseSpeech]);

  const speakHomeVerseTarget = useCallback(
    (
      target: {
        verseKey: string;
        translationId: string;
        speechMain: string;
        speechReference: string;
        speechLocale: AppLocale;
      },
      sessionId: number,
    ) => {
      if (sessionId !== homeVoiceSessionIdRef.current) return;
      const mainText = target.speechMain.trim();
      if (!mainText) {
        setVoiceSpeaking(false);
        setVoiceHint(t("nature.homeVoice.noVerse"));
        return;
      }
      const language =
        target.speechLocale === "en" ? "en-US" : target.speechLocale === "zh-TW" ? "zh-TW" : "zh-CN";
      const activeTtsPrefs = ttsPrefsRef.current;
      const selectedVoiceId = String(activeTtsPrefs.voiceId || "").trim();
      const expectedPrefix = target.speechLocale === "en" ? "en" : "zh";
      const safeVoice = resolveMaleTtsVoiceId(ttsVoiceCatalogRef.current, {
        preferredId: selectedVoiceId,
        langPrefix: expectedPrefix,
      });
      const proceedToNextVerse = () => {
        if (sessionId !== homeVoiceSessionIdRef.current) return;
        const advanceNow = advanceVerseRef.current;
        if (!advanceNow) {
          setVoiceSpeaking(false);
          return;
        }
        const prevVerseKey = target.verseKey;
        setTimeout(() => {
          if (sessionId !== homeVoiceSessionIdRef.current) return;
          void advanceNow()
            .then(() => {
              const waitStart = Date.now();
              const waitForNext = () => {
                if (sessionId !== homeVoiceSessionIdRef.current) return;
                const next = displayedVerseAudioTargetRef.current;
                if (next && next.verseKey !== prevVerseKey) {
                  speakHomeVerseTarget(next, sessionId);
                  return;
                }
                if (Date.now() - waitStart > 5200) {
                  setVoiceSpeaking(false);
                  return;
                }
                setTimeout(waitForNext, 180);
              };
              setTimeout(waitForNext, 180);
            })
            .catch(() => {
              setVoiceSpeaking(false);
            });
        }, HOME_VOICE_NEXT_DELAY_MS);
      };

      const speakReferenceThenContinue = () => {
        const refText = target.speechReference.trim();
        if (!refText) {
          proceedToNextVerse();
          return;
        }
        setTimeout(() => {
          if (sessionId !== homeVoiceSessionIdRef.current) return;
          Speech.speak(refText, {
            language,
            rate: ttsRateFromLevel(activeTtsPrefs.rateLevel),
            pitch: ttsPitchFromLevel(activeTtsPrefs.pitchLevel),
            voice: safeVoice,
            onDone: () => {
              proceedToNextVerse();
            },
            onStopped: () => {
              if (sessionId !== homeVoiceSessionIdRef.current) return;
              setVoiceSpeaking(false);
            },
            onError: () => {
              if (sessionId !== homeVoiceSessionIdRef.current) return;
              setVoiceSpeaking(false);
              setVoiceHint(t("nature.homeVoice.audioUnavailable"));
            },
          });
        }, HOME_VOICE_REFERENCE_DELAY_MS);
      };

      setTimeout(() => {
        if (sessionId !== homeVoiceSessionIdRef.current) return;
        Speech.speak(mainText, {
          language,
          rate: ttsRateFromLevel(activeTtsPrefs.rateLevel),
          pitch: ttsPitchFromLevel(activeTtsPrefs.pitchLevel),
          voice: safeVoice,
          onDone: () => {
            speakReferenceThenContinue();
          },
          onStopped: () => {
            if (sessionId !== homeVoiceSessionIdRef.current) return;
            setVoiceSpeaking(false);
          },
          onError: () => {
            if (sessionId !== homeVoiceSessionIdRef.current) return;
            setVoiceSpeaking(false);
            setVoiceHint(t("nature.homeVoice.audioUnavailable"));
          },
        });
      }, HOME_VOICE_TEXT_APPEAR_DELAY_MS);
    },
    [],
  );

  const onPlayDisplayedVerseVoice = useCallback(async () => {
    if (!homeTtsExperimentEnabled) return;
    if (scriptureModeActive) return;
    if (voicePreparing) return;
    if (voiceSpeaking) {
      await stopHomeVerseSpeech();
      setVoiceHint(t("nature.homeVoice.stopped"));
      return;
    }
    if (!displayedVerseAudioTarget) {
      setVoiceHint(t("nature.homeVoice.noVerse"));
      return;
    }
    const text = displayedVerseAudioTarget.speechMain.trim();
    if (!text) {
      setVoiceHint(t("nature.homeVoice.noVerse"));
      return;
    }
    setVoicePreparing(true);
    homeVoiceSessionIdRef.current += 1;
    const sessionId = homeVoiceSessionIdRef.current;
    try {
      await Speech.stop();
    } catch {
      // ignore stop errors
    } finally {
      setVoicePreparing(false);
    }
    setVoiceSpeaking(true);
    setVoiceHint(t("nature.homeVoice.playingNow"));
    speakHomeVerseTarget(displayedVerseAudioTarget, sessionId);
  }, [
    displayedVerseAudioTarget,
    homeTtsExperimentEnabled,
    scriptureModeActive,
    speakHomeVerseTarget,
    stopHomeVerseSpeech,
    voicePreparing,
    voiceSpeaking,
  ]);

  if (loading && !settings?.videos.length) {
    return <AppLogoSplash />;
  }

  const showSceneStrip = !showLandscapeVideo || landscapeScenePickerOpen;
  const sceneStripBottomPad =
    showLandscapeVideo && landscapeScenePickerOpen ? Math.max(insets.bottom, 12) : bottomNavSlot;
  const trimmedPosterFallback = posterUri.trim();
  const hasPosterFallback = posterModule != null || trimmedPosterFallback.length > 0;

  const renderSceneThumb = (item: NatureVideoEntry) => {
    const selected = !loopAllScenesEnabled && item.id === sceneId;
    const thumbModule = resolveNaturePosterPlaybackModule(item.id);
    const posterRel = (item.previewFrameSrc || item.thumbSrc)?.trim() ?? "";
    const thumbRemote = posterRel ? toAbsoluteUrl(baseUrl, posterRel) : "";
    const thumbUri = resolveNaturePosterPlaybackUri(item.id, thumbRemote) || thumbRemote;
    const onPick = () =>
      showLandscapeVideo && landscapeScenePickerOpen
        ? onLandscapeSceneSelect(item.id)
        : selectScene(item.id);
    return (
      <HomeSceneThumb
        key={item.id}
        selected={selected}
        thumbModule={thumbModule}
        thumbUri={thumbUri}
        fallbackLabel={displayTitle(item.title)}
        onPress={onPick}
      />
    );
  };

  return (
    <View style={styles.root} onTouchStart={markHomeInteraction}>
      <StatusBar
        hidden={false}
        style="auto"
        translucent
        backgroundColor="transparent"
      />
      <View
        pointerEvents="none"
        style={videoBackdropStyle}
        collapsable={false}
      >
        {videoStageMounted ? (
          <FullBleedCoverVideo
            sceneId={sceneId}
            resolveScenePlayback={resolveScenePlayback}
            posterUri={posterUri || undefined}
            posterModule={posterModule}
            forcePosterMode={androidBlurUsesPosterStage}
            rate={clampedRate}
            layoutMode={showLandscapeVideo ? "landscape-cover" : "portrait-cover"}
            nativeFullCover={Platform.OS === "android"}
            onSceneVideoReady={handleSceneVideoReady}
            playbackActive={homeFocused}
          />
        ) : hasPosterFallback ? (
          <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {posterModule != null ? (
              <Image
                source={posterModule}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={{ uri: trimmedPosterFallback }}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            )}
          </View>
        ) : null}
        {hasVideoStage &&
        (settingsOpen || softFocus.blurPx > 0.02 || softFocus.overlayOpacity > 0.02) ? (
          <NatureHomeSoftFocusLayer prefs={softFocus} posterUri={posterUri || undefined} />
        ) : null}
        {showSceneLoader ? (
          <View style={styles.sceneLoadOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="rgba(255,255,255,0.88)" />
            <Text style={styles.sceneLoadText}>{t("pages.homeNature.sceneLoading")}</Text>
          </View>
        ) : null}
      </View>

      {showAutoImmersive ? (
        <>
          <Pressable
            style={styles.autoImmersiveBackdrop}
            onPress={markHomeInteraction}
            accessibilityRole="button"
            accessibilityLabel={t("nature.homeBackdropTapAria")}
          />
        </>
      ) : null}

      {showLandscapeVideo && !showAutoImmersive ? (
        <Pressable
          style={styles.landscapeBackdrop}
          onPress={onLandscapeBackdropPress}
          accessibilityRole="button"
          accessibilityLabel={t("nature.homeBackdropTapAria")}
        />
      ) : null}

      {!showLandscapeVideo && !showAutoImmersive ? (
        <Pressable
          style={styles.portraitBackdrop}
          onPress={onPortraitBackdropPress}
          accessibilityRole="button"
          accessibilityLabel={t("nature.homeBackdropTapAria")}
        />
      ) : null}

      <HomeVerseOverlay
        prefsVersion={prefsVersion}
        layout={showLandscapeVideo ? "homeLandscape" : "home"}
        pauseRotation={voicePreparing || voiceSpeaking || !homeFocused}
        onDisplayedVerseChange={onDisplayedVerseChange}
        onAdvanceControllerReady={onAdvanceControllerReady}
      />

      {!showAutoImmersive ? (
        <View
          style={[
            styles.topChrome,
            {
              top: insets.top + 4,
              right: Math.max(insets.right, 10),
            },
          ]}
          pointerEvents="box-none"
        >
          {homeTtsExperimentEnabled ? (
            <Pressable
              onPress={() => {
                void onPlayDisplayedVerseVoice();
              }}
              style={({ pressed }) => [
                styles.settingsBtn,
                styles.voiceBtn,
                { opacity: pressed ? 0.72 : voicePreparing || voiceSpeaking ? 1 : 0.5 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={voiceSpeaking ? t("nature.homeVoice.stopAria") : t("nature.homeVoice.playAria")}
              accessibilityState={{ busy: voicePreparing, selected: voiceSpeaking }}
            >
              {voicePreparing ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.92)" />
              ) : (
                <ShellMaterialIcon name="record-voice-over" size={22} color="#FFFFFF" />
              )}
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setSettingsOpen(true)}
            style={({ pressed }) => [styles.settingsBtn, { opacity: pressed ? 0.72 : 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel={t("nature.homeSettings.openAria")}
          >
            <ShellMaterialIcon name="settings" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}

      {showSceneStrip && !showAutoImmersive ? (
        <View
          style={[styles.bottomBand, { paddingBottom: sceneStripBottomPad, zIndex: landscapeScenePickerOpen ? 25 : 10 }]}
          pointerEvents="box-none"
        >
          <ShellSwipeExclude style={styles.ambientScrollWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              alwaysBounceHorizontal
              directionalLockEnabled
              nestedScrollEnabled
              contentContainerStyle={[
                styles.ambientRow,
                {
                  minWidth: Math.max(
                    ambientStripContentWidth(NATURE_AMBIENT_SCENE_SLOTS.length),
                    ambientStripViewportWidth,
                  ),
                },
              ]}
              style={styles.ambientScroll}
              onLayout={(e) => {
                const w = Math.round(e.nativeEvent.layout.width);
                if (w > 0) setAmbientStripViewportWidth(w);
              }}
            >
              {NATURE_AMBIENT_SCENE_SLOTS.map((slot) => {
                const enabled = typeof BUNDLED_AMBIENT_SCENE_AUDIO[slot.id] === "number";
                const selected = activeAmbientSlotId === slot.id;
                const label = locale === "en" ? slot.labelEn : locale === "zh-TW" ? toZhTwText(slot.label) : slot.label;
                return (
                  <Pressable
                    key={slot.id}
                    onPress={() => {
                      if (!enabled) return;
                      toggleAmbientSlot(slot.id);
                    }}
                    style={({ pressed }) => [
                      styles.ambientChip,
                      selected && styles.ambientChipSelected,
                      !enabled && styles.ambientChipDisabled,
                      pressed && enabled ? styles.ambientChipPressed : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: !enabled }}
                    accessibilityLabel={
                      enabled
                        ? `${label}${selected ? resolveUiText(locale, "（已选中）", " (selected)") : ""}`
                        : `${label}${resolveUiText(locale, "（未上传）", " (not uploaded)")}`
                    }
                  >
                    <MaterialCommunityIcons
                      name={slot.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={22}
                      color={ambientIconColor(selected, enabled)}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </ShellSwipeExclude>
          <ShellSwipeExclude style={styles.sceneList}>
            <EdgeFadeHorizontalScrollView
              ref={sceneScrollRef}
              showsHorizontalScrollIndicator={false}
              alwaysBounceHorizontal
              directionalLockEnabled
              nestedScrollEnabled
              fadeLeftPx={22}
              fadeRightPx={22}
              fallbackScrimColor="rgba(0,0,0,0.5)"
              onTouchStart={sceneStripSwipeExclude.onTouchStart}
              onScrollBeginDrag={sceneStripSwipeExclude.onScrollBeginDrag}
              contentContainerStyle={[
                styles.sceneRow,
                sceneList.length > 0
                  ? {
                      minWidth:
                        Math.max(
                          homeSceneStripContentWidth(sceneList.length + 2) +
                            HOME_SCENE_STRIP_EDGE_PAD * 2,
                          sceneStripViewportWidth,
                        ),
                    }
                  : null,
              ]}
              style={styles.sceneListScroll}
              onLayout={(e) => {
                const w = Math.round(e.nativeEvent.layout.width);
                if (w > 0) {
                  sceneStripViewportW.current = w;
                  setSceneStripViewportWidth(w);
                }
              }}
            >
              <HomeSceneThumb
                key={SCENE_LOOP_ALL_ID}
                selected={loopAllScenesEnabled}
                thumbModule={null}
                fallbackLabel="∞"
                onPress={() => {
                  setLoopAllScenesEnabled(true);
                  void writeNatureLoopAllScenesEnabled(true);
                  if (!sceneId && sceneList.length > 0) {
                    const firstId = sceneList[0]?.id;
                    if (firstId) selectScene(firstId, { keepLoopMode: true });
                  }
                }}
              />
              {sceneList.map(renderSceneThumb)}
            </EdgeFadeHorizontalScrollView>
          </ShellSwipeExclude>
        </View>
      ) : null}

      {!showAutoImmersive ? (
        <NatureHomeSettingsPanel
          visible={settingsOpen}
          presentation={isLandscape ? "overlay" : "modal"}
          posterUri={posterUri || undefined}
          showTtsControls={false}
          onClose={() => setSettingsOpen(false)}
          onPrefsChanged={onPrefsChanged}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  fullBleedBackdropFill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: parchment.canvas,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: parchment.muted,
  },
  sceneLoadOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,8,6,0.28)",
  },
  sceneLoadText: {
    marginTop: 10,
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    letterSpacing: 0.2,
  },
  errorTitle: {
    fontSize: 15,
    color: parchment.ink,
    textAlign: "center",
    lineHeight: 22,
  },
  errorDetail: {
    marginTop: 8,
    fontSize: 12,
    color: parchment.faint,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 17,
    ...parchmentSans(600),
    color: parchment.ink,
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 22,
    color: parchment.muted,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: parchment.surfaceSolid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: parchment.border,
  },
  retryText: {
    fontSize: 14,
    ...parchmentSans(600),
    color: parchment.ink,
  },
  landscapeBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
  portraitBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
  },
  autoImmersiveBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  topChrome: {
    position: "absolute",
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBtn: {
    borderRadius: 999,
  },
  voiceHint: {
    position: "absolute",
    top: 92,
    right: 2,
    fontSize: 11,
    color: "rgba(255,255,255,0.88)",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  bottomBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingLeft: 14,
    paddingRight: 14,
    zIndex: 10,
    alignItems: "center",
  },
  ambientScrollWrap: {
    alignSelf: "stretch",
    marginBottom: 4,
    zIndex: 30,
    elevation: 20,
  },
  ambientScroll: {
    width: "100%",
  },
  ambientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: AMBIENT_ICON_GAP,
    paddingLeft: HOME_SCENE_STRIP_EDGE_PAD,
    paddingRight: HOME_SCENE_STRIP_EDGE_PAD,
    paddingVertical: 2,
  },
  ambientChip: {
    width: AMBIENT_ICON_SIZE,
    height: AMBIENT_ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ambientChipSelected: {
    transform: [{ scale: 1.12 }],
  },
  ambientChipDisabled: {
    opacity: 0.55,
  },
  ambientChipPressed: {
    opacity: 0.62,
  },
  sceneList: {
    alignSelf: "stretch",
    flexGrow: 0,
  },
  sceneListScroll: {
    width: "100%",
    direction: "ltr",
  },
  sceneRow: {
    flexDirection: "row",
    direction: "ltr",
    alignItems: "center",
    justifyContent: "center",
    gap: HOME_SCENE_THUMB_GAP,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: HOME_SCENE_STRIP_EDGE_PAD,
    paddingRight: HOME_SCENE_STRIP_EDGE_PAD,
  },
});
