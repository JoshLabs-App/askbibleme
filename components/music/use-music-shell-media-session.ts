import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { ASKBIBLE_PRODUCT_NAME } from "@/lib/askbible-product-name";
import {
  isCuvChapterAudioEffectiveSrc,
  tryParseCuvChapterAudioEffectiveSrc,
} from "@/lib/bible/parse-cuv-chapter-audio-src";
import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { AppLocale } from "@/lib/i18n/config";
import { resolveLocalized } from "@/lib/i18n/localized-text";
import type { MusicAlbumRepeatMode } from "@/lib/music/album-playback";
import {
  pickRandomShellAudioTrackSrcInAlbum,
  resolveShellMusicEndedAction,
} from "@/lib/music/shell-music-advance";
import {
  clearShellMediaSessionWeb,
  setShellMediaSessionWebBridge,
  syncShellMediaSessionWeb,
  teardownShellMediaSessionWeb,
} from "@/lib/music/shell-media-session-web";
import { getShellDefaultAudioSrc } from "@/lib/music-companion/shell-default-audio-src";
import { shellPlaybackUrlsEqual } from "@/lib/music-companion/shell-playback-storage";
import type { MusicCompanionStore } from "@/lib/music-companion/types";
import type { DevicePlaybackCell } from "./music-shell-playback-types";

export function useMusicShellMediaSession({
  audioRef,
  attemptShellPlay,
  pausePlayback,
  skipScriptureNext,
  setPlaybackSrc,
  seekRatio,
  effectiveSrcRef,
  storeRef,
  musicAlbumRepeatModeOverrideRef,
  playAfterNextBindRef,
  currentSec,
  devicePlayback,
  durationSec,
  effectiveSrc,
  locale,
  playing,
  scripturePlaybackRate,
  store,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  attemptShellPlay: (a: HTMLAudioElement) => void;
  pausePlayback: () => void;
  skipScriptureNext: () => Promise<void>;
  setPlaybackSrc: (src: string | null, opts?: { autoPlay?: boolean }) => void;
  seekRatio: (ratio: number) => void;
  effectiveSrcRef: MutableRefObject<string>;
  storeRef: MutableRefObject<MusicCompanionStore | null>;
  musicAlbumRepeatModeOverrideRef: MutableRefObject<MusicAlbumRepeatMode | null>;
  playAfterNextBindRef: MutableRefObject<boolean>;
  currentSec: number;
  devicePlayback: DevicePlaybackCell | null;
  durationSec: number;
  effectiveSrc: string;
  locale: AppLocale;
  playing: boolean;
  scripturePlaybackRate: number;
  store: MusicCompanionStore | null;
}) {
  const mediaSessionBridgeRef = useRef({
    attemptShellPlay,
    pausePlayback,
    skipScriptureNext,
    setPlaybackSrc,
    seekRatio,
  });
  mediaSessionBridgeRef.current = {
    attemptShellPlay,
    pausePlayback,
    skipScriptureNext,
    setPlaybackSrc,
    seekRatio,
  };

  useEffect(() => {
    setShellMediaSessionWebBridge({
      onPlay: () => {
        const a = audioRef.current;
        if (a?.paused) void mediaSessionBridgeRef.current.attemptShellPlay(a);
      },
      onPause: () => {
        mediaSessionBridgeRef.current.pausePlayback();
      },
      onNext: () => {
        const cur = effectiveSrcRef.current.trim();
        if (cur && isCuvChapterAudioEffectiveSrc(cur)) {
          void mediaSessionBridgeRef.current.skipScriptureNext();
          return;
        }
        const st = storeRef.current;
        if (!st || !cur) return;
        const ended = resolveShellMusicEndedAction({
          store: st,
          currentSrc: cur,
          repeatModeOverride: musicAlbumRepeatModeOverrideRef.current,
        });
        if (ended.kind === "advance") {
          playAfterNextBindRef.current = true;
          mediaSessionBridgeRef.current.setPlaybackSrc(ended.src);
          return;
        }
        if (ended.kind === "loop_same") {
          const a = audioRef.current;
          if (a) {
            a.currentTime = 0;
            void mediaSessionBridgeRef.current.attemptShellPlay(a);
          }
        }
      },
      onPrevious: () => {
        const a = audioRef.current;
        if (!a) return;
        const cur = effectiveSrcRef.current.trim();
        if (a.currentTime > 3) {
          a.currentTime = 0;
          return;
        }
        if (cur && isCuvChapterAudioEffectiveSrc(cur)) {
          a.currentTime = 0;
          return;
        }
        const st = storeRef.current;
        if (!st || !cur) {
          a.currentTime = 0;
          return;
        }
        const prev = pickRandomShellAudioTrackSrcInAlbum(st, cur);
        if (prev && !shellPlaybackUrlsEqual(prev, cur)) {
          playAfterNextBindRef.current = true;
          const def = getShellDefaultAudioSrc(st)?.trim() ?? "";
          if (def && shellPlaybackUrlsEqual(prev, def)) {
            mediaSessionBridgeRef.current.setPlaybackSrc(null);
          } else {
            mediaSessionBridgeRef.current.setPlaybackSrc(prev);
          }
          return;
        }
        a.currentTime = 0;
      },
    });
    return () => {
      teardownShellMediaSessionWeb();
    };
  }, [audioRef, effectiveSrcRef, musicAlbumRepeatModeOverrideRef, playAfterNextBindRef, storeRef]);

  useEffect(() => {
    const src = effectiveSrc.trim();
    if (!src) {
      clearShellMediaSessionWeb();
      return;
    }

    const parsed = tryParseCuvChapterAudioEffectiveSrc(src);
    let title: string = ASKBIBLE_PRODUCT_NAME;
    let artist: string = ASKBIBLE_PRODUCT_NAME;
    let album: string | undefined;
    let kind: "music" | "scripture" = "music";
    let playbackRate = 1;

    if (parsed) {
      kind = "scripture";
      playbackRate = scripturePlaybackRate;
      const meta = scriptureBooks.find((b) => b.bookId === parsed.bookId);
      title = meta ? `${meta.bookName} ${parsed.chapter}` : `${parsed.bookId} ${parsed.chapter}`;
      album = parsed.audioTranslationId ?? undefined;
    } else if (store) {
      const tracks = store.audioTracks.filter((track) => Boolean(track.src?.trim()));
      const idx = tracks.findIndex((track) =>
        shellPlaybackUrlsEqual((track.src ?? "").trim(), src),
      );
      const track = idx >= 0 ? tracks[idx] : null;
      if (track) {
        title = resolveLocalized(track.title, locale) || title;
        const trackArtist = resolveLocalized(track.artist, locale);
        if (trackArtist) artist = trackArtist;
        const remark = resolveLocalized(track.remark, locale);
        if (remark) album = remark;
      }
    } else if (devicePlayback) {
      title = devicePlayback.trackId;
    }

    syncShellMediaSessionWeb({
      title,
      artist,
      album,
      playing,
      positionSec: currentSec,
      durationSec,
      playbackRate,
      kind,
    });
  }, [
    currentSec,
    devicePlayback,
    durationSec,
    effectiveSrc,
    locale,
    playing,
    scripturePlaybackRate,
    store,
  ]);
}
