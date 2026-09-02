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

export type ShellPlaybackMode = "music" | "scripture";

export type ScriptureShellPlaybackBridge = {
  soundRef: MutableRefObject<AudioPlayer | null>;
  activeSoundIdRef: MutableRefObject<number>;
  playbackEpochRef: MutableRefObject<number>;
  playbackModeRef: MutableRefObject<ShellPlaybackMode>;
  unloadCurrent: () => Promise<void>;
  endMusicSession: () => void;
};
