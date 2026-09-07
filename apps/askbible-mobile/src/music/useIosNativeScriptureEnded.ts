import { useEffect } from "react";
import { DeviceEventEmitter } from "react-native";
import type { MutableRefObject } from "react";
import type { AudioPlayer } from "expo-audio";
import { syncShellMediaSessionExplicit } from "../audio/shellMediaControls";
import { reshuffleShellMediaSceneArtwork } from "../audio/shellMediaSceneArtwork";
import { getShellScriptureWantPlaying } from "../audio/shellScriptureWantPlaying";
import { readCuvChapterAudioVoice } from "../bible/cuv-chapter-audio-voice-prefs";
import { getScriptureBookDisplayName } from "../bible/scripture-book-display-name";
import { handleScriptureDidJustFinish } from "./scripturePlaybackFinish";
import {
  buildScriptureNativeNextUris,
  peekUpcomingScriptureChapters,
} from "./buildScriptureNativeNextUris";
import { scriptureChapterPool } from "./scripture-chapter-pool";
import {
  getScripturePlayingChapter,
  setScripturePlayingChapter,
} from "./scripturePlayingChapterStore";
import {
  setBrowseReadChapterPlayback,
  setPlayingReadChapterPlayback,
} from "../read/read-chapter-playback-store";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
} from "./scripturePlaybackTypes";

type Args = {
  soundRef: MutableRefObject<AudioPlayer | null>;
  scriptureSrcRef: MutableRefObject<string | null>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  scriptureChapterHandoffRef: MutableRefObject<boolean>;
  scriptureWantPlayingRef: MutableRefObject<boolean>;
  scriptureStopAtOnEndedRef: MutableRefObject<(() => void) | null>;
  scripturePlaybackRateRef: MutableRefObject<number>;
  setPlaying: (playing: boolean) => void;
  setReadChapter: (reg: ReadChapterPlaybackRegistration | null) => void;
};

type NativeEndedPayload = {
  nativeChained?: boolean;
  assetUri?: string;
  segmentEnd?: boolean;
  skip?: boolean;
};

async function refillScriptureNativeNextQueue(args: {
  currentAssetUri: string | null;
  // src 不用：后续章的地址由 buildScriptureNativeNextUris 自己解析。
  track: { bookId: string; chapter: number; bookName: string; translationId: string };
  rate: number;
  repeatMode: ScriptureAudioRepeatMode;
}): Promise<void> {
  // 过去这里是 `if (!scriptureChapterPool.isActive()) return;`——非池播放整个补队列流程都不跑，
  // 原生手里永远只有开播时那批。改为池/非池都补，池激活时 build 内部仍以池队列为准。
  const voiceId = await readCuvChapterAudioVoice();
  const resolved = await buildScriptureNativeNextUris({
    bookId: args.track.bookId,
    chapter: args.track.chapter,
    translationId: args.track.translationId,
    repeatMode: args.repeatMode,
    voiceId,
  });
  if (!getShellScriptureWantPlaying()) return;
  const artworkUri = await reshuffleShellMediaSceneArtwork();
  syncShellMediaSessionExplicit({
    title: `${args.track.bookName} ${args.track.chapter}`,
    artist: "AskBible.me",
    album: args.track.translationId,
    assetUri: args.currentAssetUri,
    artworkUri,
    durationSec: 0,
    positionSec: 0,
    playing: true,
    kind: "scripture",
    rate: args.rate,
    nextAssetUri: resolved[0] ?? null,
    nextNextAssetUri: resolved[1] ?? null,
    nextAssetUris: resolved,
  });
}

/** iOS 原生读经章终：换章 / 复读 / 段末回调（不依赖 expo-av status）。 */
export function useIosNativeScriptureEnded(args: Args): void {
  useEffect(() => {
    const onEnded = (raw?: unknown) => {
      if (!getShellScriptureWantPlaying() && !args.scriptureWantPlayingRef.current) return;
      const payload =
        raw && typeof raw === "object" ? (raw as NativeEndedPayload) : ({} as NativeEndedPayload);
      if (payload.segmentEnd) {
        const onEnd = args.scriptureStopAtOnEndedRef.current;
        args.scriptureStopAtOnEndedRef.current = null;
        if (onEnd) {
          onEnd();
          return;
        }
      }

      // 原生已接播下一章：推进池/文案，并补下一章 URI；勿再 playAt 重启。
      // 完成标记必须以「实际音轨章」为准，勿用浏览中的 readChapterRef。
      if (payload.nativeChained) {
        const playing = getScripturePlayingChapter();
        const poolTrack = scriptureChapterPool.isActive()
          ? scriptureChapterPool.getCurrentTrack()
          : null;
        const fromBookId = playing?.bookId ?? poolTrack?.bookId;
        const fromChapter = playing?.chapter ?? poolTrack?.chapter;
        if (
          fromBookId &&
          fromChapter != null &&
          scriptureChapterPool.isActive()
        ) {
          const track = scriptureChapterPool.onNativeChained(fromBookId, fromChapter);
          if (track) {
            if (payload.assetUri) args.scriptureSrcRef.current = payload.assetUri;
            const prev = args.readChapterRef.current;
            const nextReg: ReadChapterPlaybackRegistration = {
              bookId: track.bookId,
              chapter: track.chapter,
              bookName: track.bookName,
              translationId: track.translationId,
              chapterAudioSrc: track.src,
              onAdvancePreviousChapter: prev?.onAdvancePreviousChapter ?? (() => {}),
              onAdvanceNextChapter: prev?.onAdvanceNextChapter ?? (() => {}),
              onAdvanceNextInBook: prev?.onAdvanceNextInBook ?? (() => {}),
            };
            args.readChapterRef.current = nextReg;
            args.setReadChapter(nextReg);
            args.setPlaying(true);
            setScripturePlayingChapter({
              bookId: track.bookId,
              chapter: track.chapter,
              translationId: track.translationId,
            });
            setPlayingReadChapterPlayback(nextReg);
            setBrowseReadChapterPlayback(nextReg);
            void refillScriptureNativeNextQueue({
              currentAssetUri: payload.assetUri ?? args.scriptureSrcRef.current,
              track,
              rate: args.scripturePlaybackRateRef.current,
              repeatMode: args.scriptureAudioRepeatRef.current,
            });
            return;
          }
        }
        // 池已结束或无法对齐：原生已开下一首时仍以原生为准，勿再走 JS playAt。
        if (payload.assetUri) args.scriptureSrcRef.current = payload.assetUri;
        args.setPlaying(true);
        // 非池连播：原生已经在播下一章了，但 JS 这边的"当前章"还停在上一章——
        // 章号文案不会跟着走，队列也补不上。按与原生同一套规则推算出新章再同步。
        const mode = args.scriptureAudioRepeatRef.current;
        const prevReg = args.readChapterRef.current;
        if (!scriptureChapterPool.isActive() && fromBookId && fromChapter != null && prevReg) {
          const [next] = peekUpcomingScriptureChapters({
            bookId: fromBookId,
            chapter: fromChapter,
            repeatMode: mode,
            count: 1,
          });
          if (next) {
            const nextReg: ReadChapterPlaybackRegistration = {
              ...prevReg,
              bookId: next.bookId,
              chapter: next.chapter,
              bookName: getScriptureBookDisplayName(next.bookId),
              chapterAudioSrc: payload.assetUri ?? prevReg.chapterAudioSrc,
            };
            args.readChapterRef.current = nextReg;
            args.setReadChapter(nextReg);
            setScripturePlayingChapter({
              bookId: next.bookId,
              chapter: next.chapter,
              translationId: nextReg.translationId,
            });
            setPlayingReadChapterPlayback(nextReg);
            setBrowseReadChapterPlayback(nextReg);
            void refillScriptureNativeNextQueue({
              currentAssetUri: payload.assetUri ?? args.scriptureSrcRef.current,
              track: {
                bookId: nextReg.bookId,
                chapter: nextReg.chapter,
                bookName: nextReg.bookName,
                translationId: nextReg.translationId,
              },
              rate: args.scripturePlaybackRateRef.current,
              repeatMode: mode,
            });
          }
        }
        return;
      }

      const mode = args.scriptureAudioRepeatRef.current;
      const rc = args.readChapterRef.current;
      const src = args.scriptureSrcRef.current;
      if (mode === "chapter" && rc && src) {
        void reshuffleShellMediaSceneArtwork().then((artworkUri) => {
          if (!getShellScriptureWantPlaying() && !args.scriptureWantPlayingRef.current) return;
          syncShellMediaSessionExplicit({
            title: `${rc.bookName} ${rc.chapter}`,
            artist: "AskBible.me",
            album: rc.translationId,
            assetUri: src,
            artworkUri,
            durationSec: 0,
            positionSec: 0,
            playing: true,
            kind: "scripture",
            rate: args.scripturePlaybackRateRef.current,
            userPlay: true,
          });
        });
        args.setPlaying(true);
        return;
      }

      handleScriptureDidJustFinish({
        soundRef: args.soundRef,
        scriptureSrcRef: args.scriptureSrcRef,
        scriptureAudioRepeatRef: args.scriptureAudioRepeatRef,
        readChapterRef: args.readChapterRef,
        autoPlayScriptureRef: args.autoPlayScriptureRef,
        scriptureChapterHandoffRef: args.scriptureChapterHandoffRef,
        scriptureWantPlayingRef: args.scriptureWantPlayingRef,
        setPlaying: args.setPlaying,
      });
    };
    const sub = DeviceEventEmitter.addListener("ShellMediaNativeScriptureEnded", onEnded);
    return () => sub.remove();
  }, [args]);
}
