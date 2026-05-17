"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CUV_CHAPTER_AUDIO_VOICES,
  effectiveVoiceForBook,
  readStoredCuvChapterAudioVoice,
  voiceSupportsBook,
  writeStoredCuvChapterAudioVoice,
  type CuvChapterAudioVoiceId,
} from "@/lib/bible/cuv-chapter-audio-voices";

type Ctx = {
  voiceId: CuvChapterAudioVoiceId;
  setVoiceId: (id: CuvChapterAudioVoiceId) => void;
  /** 当前书卷下实际会用于 resolve 的人声（旧约强制 mandarin） */
  effectiveVoiceId: (bookId: string) => CuvChapterAudioVoiceId;
  voicesForBook: (bookId: string) => typeof CUV_CHAPTER_AUDIO_VOICES;
};

const CuvChapterAudioVoiceContext = createContext<Ctx | null>(null);

export function CuvChapterAudioVoiceProvider({ children }: { children: ReactNode }) {
  const [voiceId, setVoiceIdState] = useState<CuvChapterAudioVoiceId>("mandarin");

  useEffect(() => {
    setVoiceIdState(readStoredCuvChapterAudioVoice());
  }, []);

  const setVoiceId = useCallback((id: CuvChapterAudioVoiceId) => {
    setVoiceIdState(id);
    writeStoredCuvChapterAudioVoice(id);
  }, []);

  const effectiveVoiceId = useCallback(
    (bookId: string) => effectiveVoiceForBook(voiceId, bookId),
    [voiceId],
  );

  const voicesForBook = useCallback((bookId: string) => {
    return CUV_CHAPTER_AUDIO_VOICES.filter((v) => voiceSupportsBook(v.id, bookId));
  }, []);

  const value = useMemo(
    () => ({ voiceId, setVoiceId, effectiveVoiceId, voicesForBook }),
    [voiceId, setVoiceId, effectiveVoiceId, voicesForBook],
  );

  return (
    <CuvChapterAudioVoiceContext.Provider value={value}>{children}</CuvChapterAudioVoiceContext.Provider>
  );
}

export function useCuvChapterAudioVoice(): Ctx {
  const ctx = useContext(CuvChapterAudioVoiceContext);
  if (!ctx) {
    throw new Error("useCuvChapterAudioVoice must be used within CuvChapterAudioVoiceProvider");
  }
  return ctx;
}
