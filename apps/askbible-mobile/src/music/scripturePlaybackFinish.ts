import type { MutableRefObject } from "react";
import type { Audio } from "expo-av";
import { getNextScriptureChapterInBook } from "../bible/next-scripture-chapter";
import { logShellSoundError, safePlaySound } from "../audio/safeShellSound";
import type {
  ReadChapterPlaybackRegistration,
  ScriptureAudioRepeatMode,
} from "./scripturePlaybackTypes";

type Args = {
  soundRef: MutableRefObject<Audio.Sound | null>;
  scriptureAudioRepeatRef: MutableRefObject<ScriptureAudioRepeatMode>;
  readChapterRef: MutableRefObject<ReadChapterPlaybackRegistration | null>;
  autoPlayScriptureRef: MutableRefObject<boolean>;
  setPlaying: (playing: boolean) => void;
};

export function handleScriptureDidJustFinish({
  soundRef,
  scriptureAudioRepeatRef,
  readChapterRef,
  autoPlayScriptureRef,
  setPlaying,
}: Args): void {
  const mode = scriptureAudioRepeatRef.current;
  const rc = readChapterRef.current;
  if (!rc) {
    setPlaying(false);
    return;
  }
  if (mode === "chapter") {
    const active = soundRef.current;
    if (active) {
      void active
        .setPositionAsync(0)
        .then(() => safePlaySound(active))
        .catch((err) => logShellSoundError("scripture-repeat", err));
    }
    setPlaying(true);
    return;
  }
  if (mode === "book") {
    const next = getNextScriptureChapterInBook(rc.bookId, rc.chapter);
    if (next) {
      autoPlayScriptureRef.current = true;
      rc.onAdvanceNextInBook();
      return;
    }
  }
  setPlaying(false);
  autoPlayScriptureRef.current = true;
  rc.onAdvanceNextChapter();
}
