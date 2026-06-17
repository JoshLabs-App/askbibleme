import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { getAskBibleBaseUrl } from "../config/askbibleBaseUrl";
import { subscribeMusicResourcePackChange } from "../media/musicResourcePackSync";
import { enrichPlaybackTracks } from "./trackArtwork";
import type { MusicCompanionStore } from "./types";

export function useMusicPlaybackTracks(store: MusicCompanionStore | null) {
  const [musicPackRevision, setMusicPackRevision] = useState(0);
  const baseUrl = useMemo(() => getAskBibleBaseUrl(), []);
  const tracks = useMemo(
    () => (store ? enrichPlaybackTracks(store, baseUrl) : []),
    [store, baseUrl, musicPackRevision],
  );

  useEffect(() => subscribeMusicResourcePackChange(() => setMusicPackRevision((n) => n + 1)), []);

  return { tracks, setMusicPackRevision };
}

export function useMusicStoreRefSync(
  storeRef: MutableRefObject<MusicCompanionStore | null>,
  store: MusicCompanionStore | null,
) {
  storeRef.current = store;
}
