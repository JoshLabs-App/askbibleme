import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import type { BibleTranslationsIndex } from "../bible/translations-types";
import type { AppLocale } from "../i18n/config";
import { useReadBibleSettingsAudioDownload } from "./useReadBibleSettingsAudioDownload";
import {
  useReadBibleSettingsTranslationOptions,
  type ReadBibleSettingsOpenMenu,
} from "./useReadBibleSettingsTranslationOptions";

export type { AudioDownloadPackageItem } from "./useReadBibleSettingsAudioDownload";
export type { ReadBibleSettingsOpenMenu };

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

export function useReadBibleSettingsPanelModel(args: Args) {
  const translation = useReadBibleSettingsTranslationOptions(args);
  const audioDownload = useReadBibleSettingsAudioDownload({
    locale: args.locale,
    localeZhText: translation.localeZhText,
    openMenuRef: translation.openMenuRef,
    chapterAudioPlaybackValue: translation.chapterAudioPlaybackValue,
    playbackDisplay: translation.playbackDisplay,
  });

  return {
    localeZhText: translation.localeZhText,
    openMenu: translation.openMenu,
    primaryTranslationId: translation.primaryTranslationId,
    contrastDraftIds: translation.contrastDraftIds,
    translationCatalogReady: translation.translationCatalogReady,
    primarySelectOptions: translation.primarySelectOptions,
    contrastSelectOptions: translation.contrastSelectOptions,
    playbackSelectOptions: translation.playbackSelectOptions,
    chapterAudioPlaybackOptions: translation.chapterAudioPlaybackOptions,
    chapterAudioPlaybackValue: translation.chapterAudioPlaybackValue,
    primaryDisplay: translation.primaryDisplay,
    contrastDisplay: translation.contrastDisplay,
    playbackDisplay: translation.playbackDisplay,
    currentDownloadPackage: audioDownload.currentDownloadPackage,
    downloadActionMeta: audioDownload.downloadActionMeta,
    downloadButtonText: audioDownload.downloadButtonText,
    onPrimarySelect: translation.onPrimarySelect,
    onContrastToggleSelect: translation.onContrastToggleSelect,
    onPrimaryOpenChange: translation.onPrimaryOpenChange,
    onContrastOpenChange: translation.onContrastOpenChange,
    onPlaybackOpenChange: translation.onPlaybackOpenChange,
    onChapterAudioPlaybackSelect: translation.onChapterAudioPlaybackSelect,
    onDownloadTranslation: translation.onDownloadTranslation,
    onDownloadPackage: audioDownload.onDownloadPackage,
    onToggleChapterSegmentMode: translation.onToggleChapterSegmentMode,
  };
}
