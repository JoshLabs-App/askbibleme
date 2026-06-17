import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import { configureShellAudioMode } from "../audio/shellAudioMode";
import { ensureNatureResourcePackSync } from "../media/natureResourcePackSync";
import { useNatureResourcePackSync } from "../media/useNatureResourcePackSync";
import {
  ensureNatureSettingsLocallyPlayable,
  fetchNatureSettings,
  getBundledNatureSettings,
} from "../api/fetchNatureSettings";
import { isMobileBundledOnly, isMobileOfflineFirst } from "../config/mobileBundledOnly";
import { getNatureRemoteAssetBaseUrl } from "../bible/chapter-audio-url";
import {
  readNatureActiveSceneId,
  readNatureLoopAllScenesEnabled,
  writeNatureLoopAllScenesEnabled,
} from "../nature/natureActiveScenePrefs";
import {
  readNatureAmbientSceneSlotId,
  writeNatureAmbientSceneSlotId,
} from "../nature/natureAmbientScenePrefs";
import { NATURE_AMBIENT_SCENE_SLOTS, type NatureAmbientSceneSlotId } from "../nature/ambientSceneSlots";
import { BUNDLED_AMBIENT_SCENE_AUDIO } from "../nature/bundledAmbientSceneAudio";
import {
  readNatureSceneUsageMap,
  type NatureSceneUsageMap,
} from "../nature/natureSceneUsage";
import type { NatureSettingsV2 } from "../types/nature";
import {
  DEFAULT_SOFT_FOCUS,
  readNatureSoftFocusPrefs,
  type NatureSoftFocusPrefs,
} from "./natureHomePrefs";
import { bootWithBundled, bundledOnBoot } from "./homeNatureScreenConstants";

export function useHomeNatureScreenLoad() {
  const baseUrl = getNatureRemoteAssetBaseUrl();

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
  const [softFocus, setSoftFocus] = useState<NatureSoftFocusPrefs>(DEFAULT_SOFT_FOCUS);
  const [prefsVersion, setPrefsVersion] = useState(0);
  const [activeAmbientSlotId, setActiveAmbientSlotId] = useState<NatureAmbientSceneSlotId | "">("");
  const [sceneUsageMap, setSceneUsageMap] = useState<NatureSceneUsageMap>({});

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
    },
    [baseUrl],
  );

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
      homeFocusedRef.current = true;
      setHomeFocused(true);
      void configureShellAudioMode();
      return () => {
        homeFocusedRef.current = false;
        setHomeFocused(false);
      };
    }, []),
  );

  useEffect(() => {
    if (!homeFocused) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void ensureNatureResourcePackSync();
    });
    return () => task.cancel();
  }, [homeFocused]);

  useEffect(() => {
    if (videoStageMountedOnceRef.current) {
      setVideoStageMounted(true);
      return;
    }
    if (!homeFocused) return;
    const timer = setTimeout(() => {
      videoStageMountedOnceRef.current = true;
      setVideoStageMounted(true);
    }, 320);
    return () => clearTimeout(timer);
  }, [homeFocused]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        void readNatureSoftFocusPrefs().then(setSoftFocus);
      });
      return () => task.cancel();
    }, []),
  );

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

  const toggleAmbientSlot = useCallback((slotId: NatureAmbientSceneSlotId) => {
    setActiveAmbientSlotId((prev) => {
      const next = prev === slotId ? "" : slotId;
      void writeNatureAmbientSceneSlotId(next);
      return next;
    });
  }, []);

  const enableLoopAllScenes = useCallback(() => {
    setLoopAllScenesEnabled(true);
    void writeNatureLoopAllScenesEnabled(true);
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
    softFocus,
    prefsVersion,
    onPrefsChanged,
    sceneUsageMap,
    setSceneUsageMap,
    activeAmbientSlotId,
    setActiveAmbientSlotId,
    toggleAmbientSlot,
    enableLoopAllScenes,
    naturePackRev,
  };
}

export { NATURE_AMBIENT_SCENE_SLOTS };
