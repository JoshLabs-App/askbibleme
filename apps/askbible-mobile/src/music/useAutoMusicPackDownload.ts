import { useEffect, useRef } from "react";
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
  setStore: (store: MusicCompanionStore) => void;
  setTrackIndex: (index: number) => void;
};

/** 打开 App / 回到前台时：联网则后台拉取完整音乐包（安装包内仅 1 首 starter）。 */
export function useAutoMusicPackDownload({ setStore, setTrackIndex }: Args): void {
  const runningRef = useRef(false);

  useEffect(() => {
    if (isMobileBundledOnly()) return;

    let cancelled = false;
    const bundledStore = getBundledMusicCompanionStore();

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

    void syncIfNeeded();

    const onAppState = (next: AppStateStatus) => {
      if (next === "active") void syncIfNeeded();
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [setStore, setTrackIndex]);
}
