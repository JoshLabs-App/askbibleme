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
  scriptureWantPlayingRef: MutableRefObject<boolean>;
  scriptureStopAtOnEndedRef: MutableRefObject<(() => void) | null>;
  scripturePlaybackRateRef: MutableRefObject<number>;
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

      /*
       * 原生已接播下一章时，界面同步与队列补货交给 useScriptureFollowNativeChapter：
       * 它按「建队列时记下的 URI→章」查表，而这里原先是照着原生同一套规则再算一遍下一章，
       * 两处独立推演同一件事，不一致时界面章号会和音轨错开。
       */
      if (payload.nativeChained) return;

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
        return;
      }

      handleScriptureDidJustFinish({
        soundRef: args.soundRef,
        scriptureSrcRef: args.scriptureSrcRef,
        scriptureAudioRepeatRef: args.scriptureAudioRepeatRef,
        readChapterRef: args.readChapterRef,
        autoPlayScriptureRef: args.autoPlayScriptureRef,
        scriptureWantPlayingRef: args.scriptureWantPlayingRef,
      });
    };
    const sub = DeviceEventEmitter.addListener("ShellMediaNativeScriptureEnded", onEnded);
    return () => sub.remove();
  }, [args]);
}
