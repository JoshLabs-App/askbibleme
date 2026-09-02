import {
  buildChapterAudioPlaybackOptions,
  decodeChapterAudioPlaybackOptionId,
  translationUsesEditionChapterAudio,
} from "./read-chapter-audio-playback-options";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { t } from "../i18n/site-copy";
import {
  shortLabel,
  sortPickerTranslations,
  translationOptionLabel,
} from "./readBibleSettingsPanelConstants";
import type { BibleTranslationsIndex } from "../bible/translations-types";
import type { AppLocale } from "../i18n/config";
import type { ReadSettingsSelectOption } from "./ReadSettingsSelect";
import type { MutableRefObject } from "react";
import type { ReadBibleSettingsOpenMenu } from "./useReadBibleSettingsTranslationOptions";

type Catalog = BibleTranslationsIndex["translations"];

type OptionDeps = {
  locale: AppLocale;
  optionDownloadState: (id: string) => ReadSettingsSelectOption["downloadState"];
  translationStatusSuffix: (id: string) => string;
};

export function buildPrimaryTranslationOptions(
  translationCatalog: Catalog,
  { locale, optionDownloadState, translationStatusSuffix }: OptionDeps,
): ReadSettingsSelectOption[] {
  return sortPickerTranslations(translationCatalog, locale).map((tr) => {
    const label = translationOptionLabel(tr, locale);
    return {
      id: tr.id,
      label,
      shortLabel: shortLabel(tr.id, locale, label),
      downloadState: optionDownloadState(tr.id),
    };
  });
}

export function buildContrastTranslationOptions(
  translationCatalog: Catalog,
  primaryTranslationId: string,
  contrastDraftIds: string[],
  openMenu: ReadBibleSettingsOpenMenu,
  deps: OptionDeps,
): ReadSettingsSelectOption[] {
  const all = sortPickerTranslations(
    translationCatalog
      .filter((tr) => tr.id !== primaryTranslationId)
      .map((tr) => {
        const label = translationOptionLabel(tr, deps.locale);
        return {
          id: tr.id,
          label,
          shortLabel: shortLabel(tr.id, deps.locale, label),
          downloadState: deps.optionDownloadState(tr.id),
        };
    }),
    deps.locale,
  );
  if (contrastDraftIds.length === 0 || openMenu === "contrast") return all;
  const selectedSet = new Set(contrastDraftIds);
  const picked = all.filter((opt) => selectedSet.has(opt.id));
  const rest = all.filter((opt) => !selectedSet.has(opt.id));
  return [...picked, ...rest];
}

export function buildChapterAudioPlaybackSelectOptions(
  translationCatalog: Catalog,
  locale: AppLocale,
  primaryTranslationId: string,
): ReadSettingsSelectOption[] {
  return buildChapterAudioPlaybackOptions(translationCatalog, locale, t, primaryTranslationId).map(
    (opt) => ({
      ...opt,
      shortLabel: shortLabel(opt.id, locale, opt.label),
    }),
  );
}

export function resolveChapterAudioPlaybackValue(
  chapterAudioTranslationId: string,
  audioVoiceId: CuvChapterAudioVoiceId,
): string {
  return translationUsesEditionChapterAudio(chapterAudioTranslationId)
    ? chapterAudioTranslationId
    : audioVoiceId;
}

type OpenMenuSnapshotRef = MutableRefObject<
  Partial<Record<Exclude<ReadBibleSettingsOpenMenu, null>, ReadSettingsSelectOption[]>>
>;

export function freezeReadSettingsSelectOptions(
  menu: Exclude<ReadBibleSettingsOpenMenu, null>,
  openMenu: ReadBibleSettingsOpenMenu,
  live: ReadSettingsSelectOption[],
  snapshotRef: OpenMenuSnapshotRef,
): ReadSettingsSelectOption[] {
  if (openMenu !== menu) return live;
  if (live.length <= 3) return live;
  const snap = snapshotRef.current;
  if (!snap[menu]) snap[menu] = live;
  return snap[menu]!;
}

export function resolveTranslationOptionDisplays(args: {
  primaryOptions: ReadSettingsSelectOption[];
  primaryTranslationId: string;
  contrastOptions: ReadSettingsSelectOption[];
  contrastDraftIds: string[];
  chapterAudioPlaybackOptions: ReadSettingsSelectOption[];
  chapterAudioPlaybackValue: string;
}): { primaryDisplay: string; contrastDisplay: string; playbackDisplay: string } {
  const primaryDisplay =
    args.primaryOptions.find((o) => o.id === args.primaryTranslationId)?.shortLabel ??
    args.primaryOptions.find((o) => o.id === args.primaryTranslationId)?.label ??
    "";
  const contrastDisplay =
    args.contrastDraftIds.length > 0
      ? args.contrastDraftIds
          .map((id) => {
            const picked = args.contrastOptions.find((o) => o.id === id);
            return picked?.shortLabel ?? picked?.label ?? "";
          })
          .filter(Boolean)
          .join(", ")
      : t("pages.read.typography.contrastNone");
  const playbackDisplay =
    args.chapterAudioPlaybackOptions.find((o) => o.id === args.chapterAudioPlaybackValue)
      ?.shortLabel ??
    args.chapterAudioPlaybackOptions.find((o) => o.id === args.chapterAudioPlaybackValue)?.label ??
    "";
  return { primaryDisplay, contrastDisplay, playbackDisplay };
}

export { decodeChapterAudioPlaybackOptionId };
