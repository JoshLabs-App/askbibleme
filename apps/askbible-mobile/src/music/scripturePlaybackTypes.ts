import type { Audio } from "expo-av";
import type { MutableRefObject } from "react";

export type ReadChapterPlaybackRegistration = {
  bookId: string;
  chapter: number;
  bookName: string;
  translationId: string;
  chapterAudioSrc: string | null;
  onAdvanceNextChapter: () => void;
  onAdvanceNextInBook: () => void;
};

export type ScriptureAudioRepeatMode = "off" | "chapter" | "book";

export type ShellPlaybackMode = "music" | "scripture";

export type ScriptureShellPlaybackBridge = {
  soundRef: MutableRefObject<Audio.Sound | null>;
  activeSoundIdRef: MutableRefObject<number>;
  playbackEpochRef: MutableRefObject<number>;
  playbackModeRef: MutableRefObject<ShellPlaybackMode>;
  unloadCurrent: () => Promise<void>;
  endMusicSession: () => void;
};
