import type { MutableRefObject } from "react";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureShellPlaybackBridge,
} from "./scripturePlaybackTypes";

export type PlayScriptureChapterFn = (
  args: {
    bookId: string;
    chapter: number;
    bookName: string;
    translationId: string;
    chapterAudioSrc?: string | null;
  },
  opts?: { startAtSec?: number; endAtSec?: number; onSegmentEnd?: () => void },
) => Promise<boolean>;

export type ChapterPlaybackCtx = ScriptureShellPlaybackBridge & {
  readChapter: ReadChapterPlaybackRegistration | null;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  scripturePlayInFlightRef: MutableRefObject<Promise<void> | null>;
  scriptureSrcRef: MutableRefObject<string | null>;
  scriptureStopAtSecRef: MutableRefObject<number | null>;
  scriptureStopAtOnEndedRef: MutableRefObject<(() => void) | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  scriptureWantPlayingRef: MutableRefObject<boolean>;
  scriptureChapterHandoffRef: MutableRefObject<boolean>;
  lastScriptureProgressSecRef: MutableRefObject<number>;
  setReadChapter: (reg: ReadChapterPlaybackRegistration | null) => void;
  setPlaying: (playing: boolean) => void;
  patchReadChapterSrc: (src: string) => void;
  tryPlayScriptureWithFallback: (
    reg: ReadChapterPlaybackRegistration,
    preferredSrc: string,
    playingReg?: ReadChapterPlaybackRegistration | null,
  ) => Promise<void>;
  playScripture: (src: string) => Promise<void>;
  isStarted: () => boolean;
  stopScripturePlayback: () => Promise<void>;
  setScriptureCurrentSec: (sec: number) => void;
};
