import { useCallback } from "react";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { translationSupportsCuvChapterAudio } from "../bible/cuv-chapter-audio";
import { getMusicPlaybackControlSnapshot } from "../music/MusicPlaybackContext";
import { decodeChapterAudioPlaybackOptionId } from "./readBibleSettingsTranslationOptionLists";
import type { ReadBibleSettingsOpenMenu } from "./useReadBibleSettingsTranslationOptions";

type Args = {
  primaryTranslationId: string;
  audioTranslationId: string | null;
  audioVoiceId: CuvChapterAudioVoiceId;
  chapterAudioPlaybackValue: string;
  chapterSegmentMode: "default" | "t1";
  translationCatalogLength: number;
  setOpenMenu: (menu: ReadBibleSettingsOpenMenu) => void;
  setContrastDraftIds: React.Dispatch<React.SetStateAction<string[]>>;
  setPrimaryTranslationId: (id: string) => Promise<void>;
  setContrastTranslationIds: (ids: string[]) => Promise<void>;
  setAudioTranslationId: (id: string | null) => Promise<void>;
  persistAudioVoiceId: (id: CuvChapterAudioVoiceId) => Promise<void>;
  refreshTranslationCatalog: () => Promise<void>;
  ensureTranslationDownloaded: (id: string) => Promise<void>;
  setChapterSegmentModeSafe: (mode: "default" | "t1") => void;
};

export function useReadBibleSettingsTranslationHandlers({
  primaryTranslationId,
  audioTranslationId,
  audioVoiceId,
  chapterAudioPlaybackValue,
  chapterSegmentMode,
  translationCatalogLength,
  setOpenMenu,
  setContrastDraftIds,
  setPrimaryTranslationId,
  setContrastTranslationIds,
  setAudioTranslationId,
  persistAudioVoiceId,
  refreshTranslationCatalog,
  ensureTranslationDownloaded,
  setChapterSegmentModeSafe,
}: Args) {
  const restartScriptureIfPlaying = useCallback(async () => {
    const { playing, playbackMode, togglePlayScripture } = getMusicPlaybackControlSnapshot();
    if (playing && playbackMode === "scripture") {
      await togglePlayScripture();
    }
  }, []);

  const onPrimarySelect = useCallback(
    (id: string) => {
      if (id === primaryTranslationId) {
        setOpenMenu(null);
        return;
      }
      void (async () => {
        try {
          await ensureTranslationDownloaded(id);
          await setPrimaryTranslationId(id);
          setOpenMenu(null);
        } catch {
          /* download state surfaced via translationDownloadState */
        }
      })();
    },
    [primaryTranslationId, setPrimaryTranslationId, ensureTranslationDownloaded, setOpenMenu],
  );

  const onContrastToggleSelect = useCallback(
    (id: string) => {
      const tid = id.trim();
      if (!tid) return;
      setContrastDraftIds((prev) => {
        const exists = prev.includes(tid);
        if (exists) {
          const next = prev.filter((item) => item !== tid);
          void setContrastTranslationIds(next);
          return next;
        }
        void (async () => {
          try {
            await ensureTranslationDownloaded(tid);
            setContrastDraftIds((current) => {
              if (current.includes(tid)) return current;
              const next = [...current, tid];
              void setContrastTranslationIds(next);
              return next;
            });
          } catch {
            /* ignore */
          }
        })();
        return prev;
      });
    },
    [setContrastTranslationIds, ensureTranslationDownloaded, setContrastDraftIds],
  );

  const onPrimaryOpenChange = useCallback(
    (open: boolean) => {
      if (open && translationCatalogLength <= 3) void refreshTranslationCatalog();
      setOpenMenu(open ? "primary" : null);
    },
    [translationCatalogLength, refreshTranslationCatalog, setOpenMenu],
  );

  const onContrastOpenChange = useCallback(
    (open: boolean) => {
      if (open && translationCatalogLength <= 3) void refreshTranslationCatalog();
      setOpenMenu(open ? "contrast" : null);
    },
    [translationCatalogLength, refreshTranslationCatalog, setOpenMenu],
  );

  const onPlaybackOpenChange = useCallback(
    (open: boolean) => {
      setOpenMenu(open ? "playback" : null);
    },
    [setOpenMenu],
  );

  const onChapterAudioPlaybackSelect = useCallback(
    (optionId: string) => {
      if (optionId === chapterAudioPlaybackValue) {
        setOpenMenu(null);
        return;
      }
      const { audioTranslationId: nextAudio, voiceId: nextVoice } =
        decodeChapterAudioPlaybackOptionId(optionId);
      void (async () => {
        const nextResolvedAudioId =
          nextAudio ??
          (translationSupportsCuvChapterAudio(primaryTranslationId) ? primaryTranslationId : "cuv-simp");
        const audioChanged = nextResolvedAudioId !== (audioTranslationId ?? null);
        const voiceChanged = nextVoice !== audioVoiceId;
        if (audioChanged) await setAudioTranslationId(nextResolvedAudioId);
        if (voiceChanged) await persistAudioVoiceId(nextVoice);
        setOpenMenu(null);
        if (audioChanged || voiceChanged) await restartScriptureIfPlaying();
      })();
    },
    [
      chapterAudioPlaybackValue,
      audioTranslationId,
      audioVoiceId,
      primaryTranslationId,
      setAudioTranslationId,
      persistAudioVoiceId,
      restartScriptureIfPlaying,
      setOpenMenu,
    ],
  );

  const onToggleChapterSegmentMode = useCallback(() => {
    if (chapterSegmentMode === "default") {
      setChapterSegmentModeSafe("t1");
      return;
    }
    setChapterSegmentModeSafe("default");
  }, [chapterSegmentMode, setChapterSegmentModeSafe]);

  return {
    onPrimarySelect,
    onContrastToggleSelect,
    onPrimaryOpenChange,
    onContrastOpenChange,
    onPlaybackOpenChange,
    onChapterAudioPlaybackSelect,
    onToggleChapterSegmentMode,
  };
}
