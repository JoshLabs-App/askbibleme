import type { AudioPlayer } from "expo-audio";
import type { MutableRefObject } from "react";

export type ReadChapterPlaybackRegistration = {
  bookId: string;
  chapter: number;
  bookName: string;
  translationId: string;
  chapterAudioSrc: string | null;
  onAdvancePreviousChapter: () => void;
  onAdvanceNextChapter: () => void;
  onAdvanceNextInBook: () => void;
};

export type ScriptureAudioRepeatMode = "off" | "chapter" | "book";

/** 原生队列里一条 URI 对应的章。见 scriptureQueueChapterMap。 */
export type ChapterQueueRef = {
  bookId: string;
  chapter: number;
  translationId: string;
};

export type ShellPlaybackMode = "music" | "scripture";

export type ScriptureShellPlaybackBridge = {
  soundRef: MutableRefObject<AudioPlayer | null>;
  activeSoundIdRef: MutableRefObject<number>;
  playbackEpochRef: MutableRefObject<number>;
  unloadCurrent: () => Promise<void>;
  endMusicSession: () => void;
};
