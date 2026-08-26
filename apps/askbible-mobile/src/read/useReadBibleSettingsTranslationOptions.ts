import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { toZhTwText } from "../i18n/site-copy";
import type { BibleTranslationsIndex } from "../bible/translations-types";
import type { AppLocale } from "../i18n/config";
import type { ReadSettingsSelectOption } from "./ReadSettingsSelect";
import {
  buildChapterAudioPlaybackSelectOptions,
  buildContrastTranslationOptions,
  buildPrimaryTranslationOptions,
  freezeReadSettingsSelectOptions,
  resolveChapterAudioPlaybackValue,
  resolveTranslationOptionDisplays,
} from "./readBibleSettingsTranslationOptionLists";
import { useReadBibleSettingsInstallStates } from "./useReadBibleSettingsInstallStates";
import { useReadBibleSettingsTranslationHandlers } from "./useReadBibleSettingsTranslationHandlers";

export type ReadBibleSettingsOpenMenu = "primary" | "contrast" | "playback" | null;

type Args = {
  visible: boolean;
  locale: AppLocale;
  translationCatalog: BibleTranslationsIndex["translations"];
  translationCatalogReady: boolean;
  primaryTranslationId: string;
  contrastTranslationIds: string[];
  audioTranslationId: string | null;
  audioVoiceId: CuvChapterAudioVoiceId;
  chapterAudioTranslationId: string;
  chapterSegmentMode: "default" | "t1";
  setPrimaryTranslationId: (id: string) => Promise<void>;
  setContrastTranslationIds: (ids: string[]) => Promise<void>;
  setAudioTranslationId: (id: string | null) => Promise<void>;
  persistAudioVoiceId: (id: CuvChapterAudioVoiceId) => Promise<void>;
  refreshTranslationCatalog: () => Promise<void>;
  setChapterSegmentModeSafe: (mode: "default" | "t1") => void;
};

export function useReadBibleSettingsTranslationOptions(args: Args) {
  const {
    visible,
    locale,
    translationCatalog,
    translationCatalogReady,
    primaryTranslationId,
    contrastTranslationIds,
    audioTranslationId,
    audioVoiceId,
    chapterAudioTranslationId,
    chapterSegmentMode,
    setPrimaryTranslationId,
    setContrastTranslationIds,
    setAudioTranslationId,
    persistAudioVoiceId,
    refreshTranslationCatalog,
    setChapterSegmentModeSafe,
  } = args;

  const [openMenu, setOpenMenu] = useState<ReadBibleSettingsOpenMenu>(null);
  const openMenuRef = useRef<ReadBibleSettingsOpenMenu>(null);
  const openMenuOptionsSnapshotRef = useRef<
    Partial<Record<Exclude<ReadBibleSettingsOpenMenu, null>, ReadSettingsSelectOption[]>>
  >({});
  openMenuRef.current = openMenu;
  const [contrastDraftIds, setContrastDraftIds] = useState<string[]>(contrastTranslationIds);

  const localeZhText = useCallback(
    (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text),
    [locale],
  );

  const {
    optionDownloadState,
    translationStatusSuffix,
    onDownloadTranslation,
    ensureTranslationDownloaded,
  } = useReadBibleSettingsInstallStates({
    visible,
    locale,
    translationCatalog,
    translationCatalogReady,
    openMenu,
    openMenuRef,
  });

  useEffect(() => {
    if (!visible) setOpenMenu(null);
  }, [visible]);

  useEffect(() => {
    if (openMenu === null) {
      openMenuOptionsSnapshotRef.current = {};
    }
  }, [openMenu]);

  useEffect(() => {
    openMenuOptionsSnapshotRef.current = {};
  }, [translationCatalog.length]);

  useEffect(() => {
    setContrastDraftIds(contrastTranslationIds);
  }, [contrastTranslationIds]);

  // 打开设置时不要立刻 refresh（会清 AsyncStorage + 重算目录，章页整树跟着卡）。
  // 目录过稀时才在交互空闲后补拉；日常打开用已有 catalog。
  useEffect(() => {
    if (!visible) return;
    if (translationCatalogReady && translationCatalog.length > 3) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void refreshTranslationCatalog();
    });
    return () => task.cancel();
  }, [visible, translationCatalogReady, translationCatalog.length, refreshTranslationCatalog]);

  const optionDeps = useMemo(
    () => ({ locale, optionDownloadState, translationStatusSuffix }),
    [locale, optionDownloadState, translationStatusSuffix],
  );

  const primaryOptions = useMemo(
    () => buildPrimaryTranslationOptions(translationCatalog, optionDeps),
    [translationCatalog, optionDeps],
  );

  const contrastOptions = useMemo(
    () =>
      buildContrastTranslationOptions(
        translationCatalog,
        primaryTranslationId,
        contrastDraftIds,
        openMenu,
        optionDeps,
      ),
    [translationCatalog, primaryTranslationId, contrastDraftIds, openMenu, optionDeps],
  );

  const chapterAudioPlaybackOptions = useMemo(
    () => buildChapterAudioPlaybackSelectOptions(translationCatalog, locale),
    [translationCatalog, locale],
  );

  const chapterAudioPlaybackValue = useMemo(
    () => resolveChapterAudioPlaybackValue(chapterAudioTranslationId, audioVoiceId),
    [chapterAudioTranslationId, audioVoiceId],
  );

  const primarySelectOptions = useMemo(
    () => freezeReadSettingsSelectOptions("primary", openMenu, primaryOptions, openMenuOptionsSnapshotRef),
    [openMenu, primaryOptions],
  );
  const contrastSelectOptions = useMemo(
    () => freezeReadSettingsSelectOptions("contrast", openMenu, contrastOptions, openMenuOptionsSnapshotRef),
    [openMenu, contrastOptions],
  );
  const playbackSelectOptions = useMemo(
    () =>
      freezeReadSettingsSelectOptions(
        "playback",
        openMenu,
        chapterAudioPlaybackOptions,
        openMenuOptionsSnapshotRef,
      ),
    [openMenu, chapterAudioPlaybackOptions],
  );

  const { primaryDisplay, contrastDisplay, playbackDisplay } = useMemo(
    () =>
      resolveTranslationOptionDisplays({
        primaryOptions,
        primaryTranslationId,
        contrastOptions,
        contrastDraftIds,
        chapterAudioPlaybackOptions,
        chapterAudioPlaybackValue,
      }),
    [
      primaryOptions,
      primaryTranslationId,
      contrastOptions,
      contrastDraftIds,
      chapterAudioPlaybackOptions,
      chapterAudioPlaybackValue,
    ],
  );

  const handlers = useReadBibleSettingsTranslationHandlers({
    primaryTranslationId,
    audioTranslationId,
    audioVoiceId,
    chapterAudioPlaybackValue,
    chapterSegmentMode,
    translationCatalogLength: translationCatalog.length,
    setOpenMenu,
    setContrastDraftIds,
    setPrimaryTranslationId,
    setContrastTranslationIds,
    setAudioTranslationId,
    persistAudioVoiceId,
    refreshTranslationCatalog,
    ensureTranslationDownloaded,
    setChapterSegmentModeSafe,
  });

  return {
    localeZhText,
    openMenu,
    openMenuRef,
    primaryTranslationId,
    contrastDraftIds,
    translationCatalogReady,
    primarySelectOptions,
    contrastSelectOptions,
    playbackSelectOptions,
    chapterAudioPlaybackOptions,
    chapterAudioPlaybackValue,
    primaryDisplay,
    contrastDisplay,
    playbackDisplay,
    onDownloadTranslation,
    ...handlers,
  };
}
