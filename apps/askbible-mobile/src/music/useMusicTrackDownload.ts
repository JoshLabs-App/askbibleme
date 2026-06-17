import { InteractionManager } from "react-native";
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { downloadMusicTrackAssets } from "../media/musicResourcePackSync";
import type { MusicCompanionStore, PlaybackTrack } from "./types";

type Args = {
  tracks: PlaybackTrack[];
  storeRef: MutableRefObject<MusicCompanionStore | null>;
  setDownloadingTrackId: Dispatch<SetStateAction<string | null>>;
  setMusicPackRevision: (updater: (n: number) => number) => void;
};

export function useMusicTrackDownload({
  tracks,
  storeRef,
  setDownloadingTrackId,
  setMusicPackRevision,
}: Args) {
  const cacheMusicTrackInBackground = useCallback(
    (trackId: string) => {
      if (isMobileBundledOnly()) return;
      InteractionManager.runAfterInteractions(() => {
        void (async () => {
          if (!(await isNetworkAvailable())) return;
          const storeTrack = storeRef.current?.audioTracks.find((t) => t.id === trackId);
          if (!storeTrack) return;
          setDownloadingTrackId(trackId);
          try {
            const ok = await downloadMusicTrackAssets({
              src: storeTrack.src,
              analysisSrc: storeTrack.analysisSrc,
            });
            if (ok) setMusicPackRevision((n) => n + 1);
          } finally {
            setDownloadingTrackId((current) => (current === trackId ? null : current));
          }
        })();
      });
    },
    [setDownloadingTrackId, setMusicPackRevision, storeRef],
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
        const ok = await downloadMusicTrackAssets({
          src: storeTrack.src,
          analysisSrc: storeTrack.analysisSrc,
        });
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
