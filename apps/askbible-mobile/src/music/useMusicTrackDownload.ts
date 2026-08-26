import { InteractionManager } from "react-native";
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { musicTrackHasRemoteR2Fallback } from "../media/bundledMusicMedia";
import { downloadMusicAudioToR2Cache } from "../media/musicR2StreamCache";
import { downloadMusicTrackAssets } from "../media/musicResourcePackSync";
import type { MusicCompanionStore, PlaybackTrack } from "./types";

type Args = {
  tracks: PlaybackTrack[];
  storeRef: MutableRefObject<MusicCompanionStore | null>;
  setDownloadingTrackId: Dispatch<SetStateAction<string | null>>;
  setMusicPackRevision: (updater: (n: number) => number) => void;
};

async function downloadOneTrack(storeTrack: { src: string; analysisSrc?: string }): Promise<boolean> {
  if (musicTrackHasRemoteR2Fallback(storeTrack.src)) {
    const uri = await downloadMusicAudioToR2Cache(storeTrack.src);
    return Boolean(uri);
  }
  if (isMobileBundledOnly()) return false;
  return downloadMusicTrackAssets({
    src: storeTrack.src,
    analysisSrc: storeTrack.analysisSrc,
  });
}

export function useMusicTrackDownload({
  tracks,
  storeRef,
  setDownloadingTrackId,
  setMusicPackRevision,
}: Args) {
  const cacheMusicTrackInBackground = useCallback(
    (trackId: string) => {
      InteractionManager.runAfterInteractions(() => {
        void (async () => {
          if (!(await isNetworkAvailable())) return;
          const storeTrack = storeRef.current?.audioTracks.find((t) => t.id === trackId);
          if (!storeTrack) return;
          if (!musicTrackHasRemoteR2Fallback(storeTrack.src) && isMobileBundledOnly()) return;
          try {
            const ok = await downloadOneTrack(storeTrack);
            if (ok) setMusicPackRevision((n) => n + 1);
          } catch {
            /* 后台缓存失败不影响当前点播 */
          }
        })();
      });
    },
    [setMusicPackRevision, storeRef],
  );

  const downloadMusicTrackAt = useCallback(
    async (index: number): Promise<boolean> => {
      if (tracks.length === 0) return false;
      const i = ((index % tracks.length) + tracks.length) % tracks.length;
      const track = tracks[i];
      if (!track || track.localReady) return true;
      const storeTrack = storeRef.current?.audioTracks.find((t) => t.id === track.id);
      if (!storeTrack) return false;
      setDownloadingTrackId(track.id);
      try {
        const ok = await downloadOneTrack(storeTrack);
        if (ok) setMusicPackRevision((n) => n + 1);
        return ok;
      } finally {
        setDownloadingTrackId((current) => (current === track.id ? null : current));
      }
    },
    [setDownloadingTrackId, setMusicPackRevision, storeRef, tracks],
  );

  return { cacheMusicTrackInBackground, downloadMusicTrackAt };
}
