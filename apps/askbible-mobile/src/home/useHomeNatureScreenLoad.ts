import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { configureShellAudioMode } from "../audio/shellAudioMode";
import { isShellNativeAudioTakeover } from "../audio/shellNativeAudioTakeover";
import { getShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import { ensureNatureResourcePackSync } from "../media/natureResourcePackSync";
import { useNatureResourcePackSync } from "../media/useNatureResourcePackSync";
import {
  ensureNatureSettingsLocallyPlayable,
  fetchNatureSettings,
  getBundledNatureSettings,
} from "../api/fetchNatureSettings";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { getNatureRemoteAssetBaseUrl } from "../bible/chapter-audio-url";
import {
  readNatureActiveSceneId,
  readNatureLoopAllScenesEnabled,
} from "../nature/natureActiveScenePrefs";
import {
  registerNatureAmbientSlotClear,
  registerNatureAmbientSlotControl,
} from "../nature/natureAmbientExclusiveStop";
import {
  readNatureAmbientSceneSlotId,
  writeNatureAmbientSceneSlotId,
} from "../nature/natureAmbientScenePrefs";
import {
  NATURE_AMBIENT_SCENE_SLOTS,
  resolveColdStartAmbientSlot,
  type NatureAmbientSceneSlotId,
} from "../nature/ambientSceneSlots";
import {
  readNatureSceneUsageMap,
  type NatureSceneUsageMap,
} from "../nature/natureSceneUsage";
import type { NatureSettingsV2 } from "../types/nature";
import {
  DEFAULT_NATURE_LIVE_VIDEO,
  readNatureLiveVideoEnabled,
} from "./natureHomeLiveVideoPrefs";
import { bootWithBundled, bundledOnBoot } from "./homeNatureScreenConstants";
import {
  ensureNatureSceneVideoReady,
  ensurePrimaryNatureLakeVideoReady,
  PRIMARY_NATURE_LAKE_SCENE_ID,
} from "../media/natureSceneReadiness";
import { peekWidgetPlaybackBoot } from "../widget/widgetPlaybackColdStart";

export function useHomeNatureScreenLoad() {
  const baseUrl = getNatureRemoteAssetBaseUrl();
  const widgetPlaybackBoot = Platform.OS === "android" && peekWidgetPlaybackBoot();

  const [homeFocused, setHomeFocused] = useState(true);
  const homeFocusedRef = useRef(true);
  const naturePackRev = useNatureResourcePackSync(homeFocused);
  const [videoStageMounted, setVideoStageMounted] = useState(false);
  const videoStageMountedOnceRef = useRef(false);

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
  const [liveVideoEnabled, setLiveVideoEnabled] = useState(DEFAULT_NATURE_LIVE_VIDEO);
  const [prefsVersion, setPrefsVersion] = useState(0);
  const [activeAmbientSlotId, setActiveAmbientSlotId] = useState<NatureAmbientSceneSlotId | "">("");
  const activeAmbientSlotIdRef = useRef(activeAmbientSlotId);
  activeAmbientSlotIdRef.current = activeAmbientSlotId;
  const [sceneUsageMap, setSceneUsageMap] = useState<NatureSceneUsageMap>({});
  const ambientColdStartedRef = useRef(false);

  const applySettings = useCallback(
    (data: NatureSettingsV2, stored: string | null) => {
      const playable = ensureNatureSettingsLocallyPlayable(data, baseUrl);
      setSettings(playable);
      const id =
        (stored?.trim() && playable.videos.some((v) => v.id === stored.trim()) ? stored.trim() : "") ||
        playable.activeVideoId?.trim() ||
        playable.videos[0]?.id ||
        "";
      setLocalActiveId(id);
      return id;
    },
    [baseUrl],
  );

  const applyColdStartAmbient = useCallback(async (sceneId: string) => {
    if (ambientColdStartedRef.current) return;
    ambientColdStartedRef.current = true;
    const storedAmbient = await readNatureAmbientSceneSlotId();
    const ambient = resolveColdStartAmbientSlot(sceneId, storedAmbient);
    setActiveAmbientSlotId(ambient);
    if (ambient) void writeNatureAmbientSceneSlotId(ambient);
  }, []);

  const hydrateNatureHomePrefs = useCallback(
    async (data: NatureSettingsV2) => {
      const [stored, loopAllScenes, usage, liveVideo] = await Promise.all([
        readNatureActiveSceneId(),
        readNatureLoopAllScenesEnabled(),
        readNatureSceneUsageMap(),
        readNatureLiveVideoEnabled(),
      ]);
      const sceneId = applySettings(data, stored);
      setLoopAllScenesEnabled(loopAllScenes);
      setLiveVideoEnabled(liveVideo);
      setSceneUsageMap(usage);
      // 打开 App 不自动带环境音；点选场景后再跟场景默认。
      await applyColdStartAmbient(sceneId);
    },
    [applyColdStartAmbient, applySettings],
  );

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const [data, stored, loopAllScenes, usage, liveVideo] = await Promise.all([
          fetchNatureSettings(),
          readNatureActiveSceneId(),
          readNatureLoopAllScenesEnabled(),
          readNatureSceneUsageMap(),
          readNatureLiveVideoEnabled(),
        ]);
        const sceneId = applySettings(data, stored);
        setLoopAllScenesEnabled(loopAllScenes);
        setLiveVideoEnabled(liveVideo);
        setSceneUsageMap(usage);
        // 仅冷启动开环境音；silent 刷新勿覆盖会话内点关。
        if (!opts?.silent) await applyColdStartAmbient(sceneId);
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
    [applyColdStartAmbient, applySettings],
  );

  const refreshLiveVideoPrefs = useCallback(() => {
    void readNatureLiveVideoEnabled().then(setLiveVideoEnabled);
  }, []);

  const onPrefsChanged = useCallback(() => {
    setPrefsVersion((n) => n + 1);
    refreshLiveVideoPrefs();
  }, [refreshLiveVideoPrefs]);

  const bundledScenesReady = bootWithBundled && bundledOnBoot.videos.length > 0;

  useFocusEffect(
    useCallback(() => {
      homeFocusedRef.current = true;
      setHomeFocused(true);
      // 读经进行中勿改 AudioMode：会抢会话把章朗读掐掉。
      if (!getShellScriptureWantPlaying() && !isShellNativeAudioTakeover()) {
        void configureShellAudioMode();
      }
      return () => {
        homeFocusedRef.current = false;
        setHomeFocused(false);
      };
    }, []),
  );

  useEffect(() => {
    if (!homeFocused) return;
    const delayMs = bundledScenesReady ? (Platform.OS === "android" ? 450 : 2500) : 1200;
    const timer = setTimeout(() => {
      void ensureNatureResourcePackSync();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [bundledScenesReady, homeFocused]);

  // 湖景优先解压：不绑 focus / widget / live video；相邻场景等湖景就绪后再暖。
  useEffect(() => {
    void ensurePrimaryNatureLakeVideoReady();
  }, []);

  useEffect(() => {
    // 解压与挂载解耦：widget 冷启也先暖湖景，勿等用户开 live video。
    const bootSceneId =
      localActiveId.trim() ||
      settings?.activeVideoId?.trim() ||
      settings?.videos[0]?.id?.trim() ||
      bundledOnBoot.activeVideoId?.trim() ||
      bundledOnBoot.videos[0]?.id?.trim() ||
      PRIMARY_NATURE_LAKE_SCENE_ID;
    const ensureBootVideo = () => {
      const lake = ensurePrimaryNatureLakeVideoReady();
      const next = bootSceneId.trim();
      if (next && next !== PRIMARY_NATURE_LAKE_SCENE_ID) {
        return lake.then(() => ensureNatureSceneVideoReady(next));
      }
      return lake;
    };
    void ensureBootVideo();

    if (videoStageMountedOnceRef.current) {
      setVideoStageMounted(true);
      return;
    }
    if (widgetPlaybackBoot) return;
    if (!homeFocused) return;

    const mountVideoStage = () => {
      videoStageMountedOnceRef.current = true;
      setVideoStageMounted(true);
    };

    if (bootSceneId) {
      let cancelled = false;
      const delayMs = Platform.OS === "android" ? 240 : 480;
      const timer = setTimeout(() => {
        if (!cancelled) mountVideoStage();
      }, delayMs);
      void ensureBootVideo().finally(() => {
        if (cancelled) return;
        clearTimeout(timer);
        mountVideoStage();
      });
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    const timer = setTimeout(mountVideoStage, 320);
    return () => clearTimeout(timer);
  }, [homeFocused, localActiveId, settings, widgetPlaybackBoot]);

  useEffect(() => {
    if (!homeFocused) return;
    if (widgetPlaybackBoot) return;
    const bundled = getBundledNatureSettings();
    if (bundledScenesReady) {
      setSettings((prev) => {
        if (prev?.videos.length) return prev;
        return ensureNatureSettingsLocallyPlayable(bundled, baseUrl);
      });
      setLoading(false);
      void hydrateNatureHomePrefs(bundled);
    }
    if (isMobileBundledOnly()) {
      return;
    }
    const silent = bundledScenesReady;
    const runLoad = () => void load({ silent });
    const loadDelayMs = bundledScenesReady ? (Platform.OS === "android" ? 120 : 900) : 0;
    const timer = setTimeout(() => {
      runLoad();
    }, loadDelayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [baseUrl, bundledScenesReady, homeFocused, hydrateNatureHomePrefs, load, widgetPlaybackBoot]);

  useEffect(() => {
    if (!homeFocused || naturePackRev <= 0) return;
    void load({ silent: true });
  }, [homeFocused, naturePackRev, load]);

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
    }, Platform.OS === "android" ? 2000 : 4500);
    return () => clearTimeout(timer);
  }, [baseUrl]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      void load({ silent: true });
    }, Platform.OS === "android" ? 1200 : 2500);
    return () => clearTimeout(timer);
  }, [error, load]);

  const clearAmbientSlot = useCallback(() => {
    setActiveAmbientSlotId("");
    void writeNatureAmbientSceneSlotId("");
  }, []);

  useEffect(() => {
    registerNatureAmbientSlotClear(clearAmbientSlot);
    registerNatureAmbientSlotControl({
      getActiveId: () => activeAmbientSlotIdRef.current,
      restore: (id) => {
        const next = NATURE_AMBIENT_SCENE_SLOTS.some((slot) => slot.id === id)
          ? (id as NatureAmbientSceneSlotId)
          : "";
        if (!next) return;
        setActiveAmbientSlotId(next);
        void writeNatureAmbientSceneSlotId(next);
      },
    });
    return () => {
      registerNatureAmbientSlotClear(null);
      registerNatureAmbientSlotControl(null);
    };
  }, [clearAmbientSlot]);

  const toggleAmbientSlot = useCallback((slotId: NatureAmbientSceneSlotId) => {
    setActiveAmbientSlotId((prev) => {
      const next = prev === slotId ? "" : slotId;
      void writeNatureAmbientSceneSlotId(next);
      return next;
    });
  }, []);

  return {
    baseUrl,
    homeFocused,
    homeFocusedRef,
    videoStageMounted,
    loading,
    error,
    settings,
    localActiveId,
    setLocalActiveId,
    loopAllScenesEnabled,
    setLoopAllScenesEnabled,
    liveVideoEnabled,
    setLiveVideoEnabled,
    prefsVersion,
    onPrefsChanged,
    sceneUsageMap,
    setSceneUsageMap,
    activeAmbientSlotId,
    setActiveAmbientSlotId,
    clearAmbientSlot,
    toggleAmbientSlot,
    naturePackRev,
  };
}

export { NATURE_AMBIENT_SCENE_SLOTS };
