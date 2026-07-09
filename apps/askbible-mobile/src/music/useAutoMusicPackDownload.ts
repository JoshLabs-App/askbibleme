import { useEffect, useRef } from "react";
import { InteractionManager } from "react-native";
import { AppState, type AppStateStatus } from "react-native";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import {
  ensureMusicResourcePackSync,
  hydrateMusicResourcePackState,
  readSyncedMusicCompanionStore,
} from "../media/musicResourcePackSync";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { getBundledMusicCompanionStore } from "./fetchMusicCompanion";
import { readMusicPlaybackResume } from "./music-playback-prefs";
import { hasAtLeastBundledTracks, resolveSessionDefaultTrackIndex } from "./musicStoreHelpers";
import { enrichPlaybackTracks } from "./trackArtwork";
import type { MusicCompanionStore } from "./types";

type Args = {
  enabled?: boolean;
  setStore: (store: MusicCompanionStore) => void;
  setTrackIndex: (index: number) => void;
};

/** 打开 App / 回到前台时：联网则后台拉取完整音乐包（安装包内仅 1 首 starter）。 */
export function useAutoMusicPackDownload({ enabled = true, setStore, setTrackIndex }: Args): void {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (isMobileBundledOnly()) return;

    let cancelled = false;
    const bundledStore = getBundledMusicCompanionStore();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let interactionTask: { cancel: () => void } | null = null;

    const applyPackStore = async () => {
      const packStore = await readSyncedMusicCompanionStore();
      if (cancelled || !packStore || !hasAtLeastBundledTracks(packStore, bundledStore)) return;
      setStore(packStore);
      const saved = await readMusicPlaybackResume();
      if (!saved) {
        const tracks = enrichPlaybackTracks(packStore, getAskBibleBaseUrl());
        setTrackIndex(resolveSessionDefaultTrackIndex(tracks));
      }
    };

    const syncIfNeeded = async () => {
      if (cancelled || runningRef.current) return;
      if (!(await isNetworkAvailable())) return;
      runningRef.current = true;
      try {
        await hydrateMusicResourcePackState();
        const synced = await ensureMusicResourcePackSync();
        if (synced) await applyPackStore();
      } catch {
        /* 保留 starter；下次回前台再试 */
      } finally {
        runningRef.current = false;
      }
    };

    const scheduleSync = (delayMs: number) => {
      if (timeoutId) clearTimeout(timeoutId);
      interactionTask?.cancel();
      timeoutId = setTimeout(() => {
        interactionTask = InteractionManager.runAfterInteractions(() => {
          void syncIfNeeded();
        });
      }, delayMs);
    };

    scheduleSync(2500);

    const onAppState = (next: AppStateStatus) => {
      if (next !== "active") return;
      scheduleSync(2500);
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      interactionTask?.cancel();
      sub.remove();
    };
  }, [enabled, setStore, setTrackIndex]);
}
