import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  InteractionManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShellSwipeExclude } from "../shell/ShellSwipeExclude";
import { useShellSwipeSuspend } from "../shell/useShellSwipeSuspend";
import {
  buildChapterAudioPlaybackOptions,
  decodeChapterAudioPlaybackOptionId,
} from "./read-chapter-audio-playback-options";
import type { CuvChapterAudioVoiceId } from "../bible/cuv-chapter-audio-voices";
import { useLocale } from "../i18n/LocaleProvider";
import { t, toZhTwText } from "../i18n/site-copy";
import { getMusicPlaybackControlSnapshot } from "../music/MusicPlaybackContext";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { ReadSettingsSelect, type ReadSettingsSelectOption } from "./ReadSettingsSelect";
import { translationUsesWebChapterAudio } from "../bible/web-chapter-audio";
import { translationSupportsCuvChapterAudio } from "../bible/cuv-chapter-audio";
import {
  chapterAudioPackageKey,
  ensureAudioPackageDownloadHydrated,
  pauseAudioPackageDownload,
  readAudioPackageDownloadState,
  resumeAudioPackageDownload,
  startAudioPackageDownload,
  subscribeAudioPackageDownload,
} from "./read-audio-package-download";
import { trackTap } from "../telemetry/tap";
import { translationMetaFromCatalog } from "../api/fetchBibleTranslationsCatalog";
import {
  downloadScriptureTranslation,
  ensureScriptureTranslationReady,
  readScriptureTranslationDownloadState,
  subscribeScriptureTranslationDownload,
} from "../bible/scripture-translation-download";
import {
  listScriptureTranslationInstallStates,
  type ScriptureTranslationInstallStatus,
} from "../bible/scripture-translation-update";
import type { BibleTranslationsIndex } from "../bible/translations-types";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type OpenMenu = "primary" | "contrast" | "playback" | null;
type AudioDownloadPackageItem = {
  packageKey: string;
  translationId: string;
  voiceId: CuvChapterAudioVoiceId;
  label: string;
};

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

const SHORT_LABEL_ZH: Record<string, string> = {
  asv: "ASV",
  "cuv-simp": "和合本",
  "cuv-trad": "繁体",
  "otb-zh-hans": "Open简体",
  "otb-zh-hant": "Open繁体",
  "otb-en-gb": "Open英",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "blm-es": "BLM",
  "cbs-zh": "当代",
  "heb-leningrad": "希伯来",
  "dby-en": "Darby",
  "gnv-en": "Geneva",
  kjv: "KJV",
  "rv1909-es": "西语",
  "rvg-es": "RVG",
  "swcb-zh": "世中圣经",
  "vbl-es": "VBL",
  "ylt-en": "YLT",
  mandarin: "普通话",
  "teochew-nt": "潮汕语",
};

const SHORT_LABEL_ZH_TW: Record<string, string> = {
  asv: "ASV",
  "cuv-simp": "和合本",
  "cuv-trad": "繁體",
  "otb-zh-hans": "Open簡體",
  "otb-zh-hant": "Open繁體",
  "otb-en-gb": "Open英",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "blm-es": "BLM",
  "cbs-zh": "當代",
  "heb-leningrad": "希伯來",
  "dby-en": "Darby",
  "gnv-en": "Geneva",
  kjv: "KJV",
  "rv1909-es": "西語",
  "rvg-es": "RVG",
  "swcb-zh": "世中聖經",
  "vbl-es": "VBL",
  "ylt-en": "YLT",
  mandarin: "普通話",
  "teochew-nt": "潮汕語",
};

const SHORT_LABEL_EN: Record<string, string> = {
  asv: "ASV",
  "cuv-simp": "CUV",
  "cuv-trad": "CUV Trad",
  "otb-zh-hans": "OTB ZH",
  "otb-zh-hant": "OTB ZH-T",
  "otb-en-gb": "OTB EN",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "blm-es": "BLM",
  "cbs-zh": "CCB",
  "heb-leningrad": "Hebrew",
  "dby-en": "Darby",
  "gnv-en": "Geneva",
  kjv: "KJV",
  "rv1909-es": "Spanish",
  "rvg-es": "RVG",
  "swcb-zh": "WCB",
  "vbl-es": "VBL",
  "ylt-en": "YLT",
  mandarin: "Mandarin",
  "teochew-nt": "Teochew",
};

function shortLabel(id: string, locale: string, fallback: string): string {
  const map = locale === "en" ? SHORT_LABEL_EN : locale === "zh-TW" ? SHORT_LABEL_ZH_TW : SHORT_LABEL_ZH;
  return map[id] ?? fallback;
}

function translationOptionLabel(
  tr: { labelZh: string; labelEn: string },
  locale: string,
): string {
  if (locale === "en") return tr.labelEn;
  return locale === "zh-TW" ? toZhTwText(tr.labelZh) : tr.labelZh;
}

function rankTranslationForPicker(id: string): number {
  if (id === "kjv") return 0;
  return 100;
}

function sortPickerTranslations<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => rankTranslationForPicker(a.id) - rankTranslationForPicker(b.id));
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  sheet: {
    width: "90%",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surfaceSolid,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 8,
    shadowColor: "#2a1810",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  rowIcon: {
    width: 22,
    paddingTop: 8,
    alignItems: "center",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  translationRow: {
    flexDirection: "column",
    gap: 8,
    width: "100%",
  },
  translationSelect: {
    width: "100%",
  },
  audioPlaybackRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  audioPlaybackSelect: {
    flex: 1,
  },
  audioDownloadIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  audioDownloadIconBtnPressed: {
    backgroundColor: c.hover,
  },
  sizeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sizeActionsTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  sizeSection: {
    gap: 8,
  },
  segmentModeText: {
    fontSize: 12,
    color: c.muted,
    ...parchmentSans(700),
  },
  segmentModeTextActive: {
    color: c.parchmentAccent,
  },
  sizeActionBtn: {
    width: 36,
    height: 34,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  sizeActionBtnPressed: {
    backgroundColor: c.hover,
  },
  sizeActionBtnDisabled: {
    opacity: 0.48,
  },
  sizeActionBtnActive: {
    backgroundColor: c.parchmentAccentGlow,
    borderColor: c.parchmentAccent,
  },
  sizeActionText: {
    fontSize: 13,
    color: c.ink,
    ...parchmentSans(600),
  },
  sizeActionTextPreset: {
    fontSize: 14,
    letterSpacing: 0.3,
    color: c.ink,
    ...parchmentSans(700),
  },
  sizeActionTextDisabled: {
    color: c.muted,
  },
});

function ParchmentSettingRow({
  icon,
  children,
}: {
  icon: MaterialIconName;
  children: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <MaterialIcons name={icon} size={17} color={c.faint} />
      </View>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}

export function ReadBibleSettingsPanel({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  useShellSwipeSuspend(visible);
  const { locale } = useLocale();
  const {
    audioVoiceId,
    setAudioVoiceId: persistAudioVoiceId,
    translationCatalog,
    translationCatalogReady,
    primaryTranslationId,
    contrastTranslationIds,
    audioTranslationId,
    chapterAudioTranslationId,
    sizeAtMin,
    sizeAtMax,
    sizeAtDefault,
    sizeAtLargePreset,
    setSizeToLargePreset,
    verseParagraphFlow,
    setVerseParagraphFlow,
    chapterSegmentMode,
    setChapterSegmentMode: setChapterSegmentModeMaybe,
    bumpSize,
    resetSizeToDefault,
    setPrimaryTranslationId,
    setContrastTranslationIds,
    setAudioTranslationId,
    refreshTranslationCatalog,
  } = useReadBibleTypography();
  const setChapterSegmentModeSafe = useCallback(
    (mode: "default" | "t1") => {
      if (typeof setChapterSegmentModeMaybe === "function") {
        setChapterSegmentModeMaybe(mode);
      }
    },
    [setChapterSegmentModeMaybe],
  );

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const openMenuRef = useRef<OpenMenu>(null);
  const openMenuOptionsSnapshotRef = useRef<Partial<Record<Exclude<OpenMenu, null>, ReadSettingsSelectOption[]>>>(
    {},
  );
  const [downloadState, setDownloadState] = useState(() => readAudioPackageDownloadState());
  const [translationDownloadState, setTranslationDownloadState] = useState(() =>
    readScriptureTranslationDownloadState(),
  );
  const [installStates, setInstallStates] = useState<Record<string, ScriptureTranslationInstallStatus>>({});
  const installStatesRef = useRef(installStates);
  openMenuRef.current = openMenu;
  installStatesRef.current = installStates;
  const [contrastDraftIds, setContrastDraftIds] = useState<string[]>(contrastTranslationIds);
  const localeZhText = useCallback(
    (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text),
    [locale],
  );

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

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void ensureAudioPackageDownloadHydrated();
    });
    const unsub = subscribeAudioPackageDownload(() => {
      if (openMenuRef.current) return;
      setDownloadState(readAudioPackageDownloadState());
    });
    return () => {
      task.cancel();
      unsub();
    };
  }, []);

  useEffect(() => {
    return subscribeScriptureTranslationDownload(() => {
      if (openMenuRef.current) return;
      setTranslationDownloadState(readScriptureTranslationDownloadState());
    });
  }, []);

  const translationCatalogIndex = useMemo(
    (): BibleTranslationsIndex => ({
      translations: translationCatalog,
      defaultTranslationId: null,
    }),
    [translationCatalog],
  );

  const refreshInstallStates = useCallback(async () => {
    if (translationCatalog.length === 0 || openMenuRef.current) return;
    const states = await listScriptureTranslationInstallStates(translationCatalogIndex);
    if (openMenuRef.current) return;
    setInstallStates(states);
  }, [translationCatalog.length, translationCatalogIndex]);

  useEffect(() => {
    if (!visible || openMenu || !translationCatalogReady || translationCatalog.length === 0) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void refreshInstallStates();
    });
    return () => task.cancel();
  }, [visible, openMenu, translationCatalogReady, translationCatalog.length, refreshInstallStates]);

  useEffect(() => {
    if (!visible) return;
    void refreshTranslationCatalog();
  }, [visible, refreshTranslationCatalog]);

  useEffect(() => {
    if (!visible || openMenu || translationDownloadState.status !== "done") return;
    const task = InteractionManager.runAfterInteractions(() => {
      void refreshInstallStates();
    });
    return () => task.cancel();
  }, [visible, openMenu, translationDownloadState.status, refreshInstallStates]);

  const optionDownloadState = useCallback(
    (translationId: string): ReadSettingsSelectOption["downloadState"] => {
      if (
        translationDownloadState.status === "running" &&
        translationDownloadState.translationId === translationId
      ) {
        return "downloading";
      }
      const status = installStates[translationId];
      if (status === "missing") return "missing";
      if (status === "outdated") return "outdated";
      return null;
    },
    [installStates, translationDownloadState],
  );

  const translationStatusSuffix = useCallback(
    (translationId: string): string => {
      const state = optionDownloadState(translationId);
      if (state === "downloading") {
        return translationDownloadState.translationId === translationId
          ? ` (${translationDownloadState.percent}%)`
          : "";
      }
      if (state === "missing") {
        return locale === "en" ? " · download" : ` · ${localeZhText("需下载")}`;
      }
      if (state === "outdated") {
        return locale === "en" ? " · update" : ` · ${localeZhText("可更新")}`;
      }
      return "";
    },
    [locale, optionDownloadState, translationDownloadState],
  );

  const onDownloadTranslation = useCallback(
    async (translationId: string) => {
      const meta = translationMetaFromCatalog(translationCatalogIndex, translationId);
      if (!meta) return;
      const status = installStatesRef.current[translationId];
      try {
        await downloadScriptureTranslation(translationId, meta.downloadUrl, {
          force: status === "outdated",
        });
        await refreshInstallStates();
      } catch {
        /* surfaced via translationDownloadState */
      }
    },
    [refreshInstallStates, translationCatalogIndex],
  );

  const ensureTranslationDownloaded = useCallback(
    async (translationId: string) => {
      const meta = translationMetaFromCatalog(
        { translations: translationCatalog, defaultTranslationId: null },
        translationId,
      );
      await ensureScriptureTranslationReady(translationId, meta?.downloadUrl);
    },
    [translationCatalog],
  );

  const primaryOptions = useMemo((): ReadSettingsSelectOption[] => {
    return sortPickerTranslations(translationCatalog).map((tr) => {
      const label = translationOptionLabel(tr, locale);
      return {
        id: tr.id,
        label: `${label}${translationStatusSuffix(tr.id)}`,
        shortLabel: shortLabel(tr.id, locale, label),
        downloadState: optionDownloadState(tr.id),
      };
    });
  }, [translationCatalog, locale, optionDownloadState, translationStatusSuffix]);

  const contrastOptions = useMemo((): ReadSettingsSelectOption[] => {
    const all = sortPickerTranslations(
      translationCatalog
      .filter((tr) => tr.id !== primaryTranslationId)
      .map((tr) => {
        const label = translationOptionLabel(tr, locale);
        return {
          id: tr.id,
          label: `${label}${translationStatusSuffix(tr.id)}`,
          shortLabel: shortLabel(tr.id, locale, label),
          downloadState: optionDownloadState(tr.id),
        };
      }),
    );
    if (contrastDraftIds.length === 0 || openMenu === "contrast") return all;
    const selectedSet = new Set(contrastDraftIds);
    const picked = all.filter((opt) => selectedSet.has(opt.id));
    const rest = all.filter((opt) => !selectedSet.has(opt.id));
    return [...picked, ...rest];
  }, [
    translationCatalog,
    primaryTranslationId,
    locale,
    contrastDraftIds,
    openMenu,
    optionDownloadState,
    translationStatusSuffix,
  ]);

  const chapterAudioPlaybackOptions = useMemo((): ReadSettingsSelectOption[] => {
    return buildChapterAudioPlaybackOptions(translationCatalog, locale, t).map((opt) => ({
      ...opt,
      shortLabel: shortLabel(opt.id, locale, opt.label),
    }));
  }, [translationCatalog, locale]);


  const chapterAudioPlaybackValue = useMemo(
    () => (translationUsesWebChapterAudio(chapterAudioTranslationId) ? chapterAudioTranslationId : audioVoiceId),
    [chapterAudioTranslationId, audioVoiceId],
  );

  const freezeSelectOptions = useCallback(
    (menu: Exclude<OpenMenu, null>, live: ReadSettingsSelectOption[]) => {
      if (openMenu !== menu) return live;
      // 目录仍只有内置 3 译本时不冻结，避免 Android 上后台拉取完成后列表不刷新。
      if (live.length <= 3) return live;
      const snap = openMenuOptionsSnapshotRef.current;
      if (!snap[menu]) snap[menu] = live;
      return snap[menu]!;
    },
    [openMenu],
  );

  const primarySelectOptions = useMemo(
    () => freezeSelectOptions("primary", primaryOptions),
    [freezeSelectOptions, primaryOptions],
  );
  const contrastSelectOptions = useMemo(
    () => freezeSelectOptions("contrast", contrastOptions),
    [freezeSelectOptions, contrastOptions],
  );
  const playbackSelectOptions = useMemo(
    () => freezeSelectOptions("playback", chapterAudioPlaybackOptions),
    [freezeSelectOptions, chapterAudioPlaybackOptions],
  );

  const primaryDisplay =
    primaryOptions.find((o) => o.id === primaryTranslationId)?.shortLabel ??
    primaryOptions.find((o) => o.id === primaryTranslationId)?.label ??
    "";
  const contrastDisplay =
    contrastDraftIds.length > 0
      ? contrastDraftIds
          .map((id) => {
            const picked = contrastOptions.find((o) => o.id === id);
            return picked?.shortLabel ?? picked?.label ?? "";
          })
          .filter(Boolean)
          .join(", ")
      : t("pages.read.typography.contrastNone");
  const playbackDisplay =
    chapterAudioPlaybackOptions.find((o) => o.id === chapterAudioPlaybackValue)?.shortLabel ??
    chapterAudioPlaybackOptions.find((o) => o.id === chapterAudioPlaybackValue)?.label ??
    "";

  const downloadTarget = useMemo(() => {
    const picked = decodeChapterAudioPlaybackOptionId(chapterAudioPlaybackValue);
    if (picked.audioTranslationId && translationUsesWebChapterAudio(picked.audioTranslationId)) {
      return {
        translationId: picked.audioTranslationId,
        voiceId: "mandarin" as const,
      };
    }
    return {
      translationId: "cuv-simp",
      voiceId: picked.voiceId,
    };
  }, [chapterAudioPlaybackValue]);

  const activePackageKey = useMemo(
    () =>
      chapterAudioPackageKey({
        translationId: downloadTarget.translationId,
        voiceId: downloadTarget.voiceId,
      }),
    [downloadTarget.translationId, downloadTarget.voiceId],
  );
  const downloadPercent = downloadState.total
    ? Math.floor(((downloadState.completed + downloadState.currentPercent) / downloadState.total) * 100)
    : 0;

  const currentDownloadPackage = useMemo(
    (): AudioDownloadPackageItem => ({
      packageKey: activePackageKey,
      translationId: downloadTarget.translationId,
      voiceId: downloadTarget.voiceId,
      label: playbackDisplay || (locale === "en" ? "Chapter audio" : localeZhText("朗读音频")),
    }),
    [
      activePackageKey,
      downloadTarget.translationId,
      downloadTarget.voiceId,
      playbackDisplay,
      locale,
      localeZhText,
    ],
  );

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
    [primaryTranslationId, setPrimaryTranslationId, ensureTranslationDownloaded],
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
    [setContrastTranslationIds, ensureTranslationDownloaded],
  );

  const onPrimaryOpenChange = useCallback(
    (open: boolean) => {
      if (open && translationCatalog.length <= 3) void refreshTranslationCatalog();
      setOpenMenu(open ? "primary" : null);
    },
    [translationCatalog.length, refreshTranslationCatalog],
  );
  const onContrastOpenChange = useCallback(
    (open: boolean) => {
      if (open && translationCatalog.length <= 3) void refreshTranslationCatalog();
      setOpenMenu(open ? "contrast" : null);
    },
    [translationCatalog.length, refreshTranslationCatalog],
  );
  const onPlaybackOpenChange = useCallback((open: boolean) => {
    setOpenMenu(open ? "playback" : null);
  }, []);

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
    ],
  );

  const onToggleChapterSegmentMode = useCallback(() => {
    if (chapterSegmentMode === "default") {
      setChapterSegmentModeSafe("t1");
      return;
    }
    setChapterSegmentModeSafe("default");
  }, [chapterSegmentMode, setChapterSegmentModeSafe]);

  const downloadButtonText = useCallback(
    (pkg: AudioDownloadPackageItem): string => {
      const active = downloadState.packageKey === pkg.packageKey;
      if (active && downloadState.status === "running") {
        return locale === "en" ? `Downloading ${downloadPercent}%` : `${localeZhText("下载中")} ${downloadPercent}%`;
      }
      if (active && downloadState.status === "paused") {
        return locale === "en" ? "Resume" : localeZhText("继续");
      }
      if (active && downloadState.status === "done") {
        return locale === "en" ? "Downloaded" : localeZhText("已下载");
      }
      if (active && downloadState.status === "error") {
        return locale === "en" ? "Retry" : localeZhText("重试");
      }
      return locale === "en" ? "Download" : localeZhText("下载");
    },
    [downloadState.packageKey, downloadState.status, downloadPercent, locale, localeZhText],
  );

  const downloadActionMeta = useMemo(() => {
    const active = downloadState.packageKey === currentDownloadPackage.packageKey;
    const status = active ? downloadState.status : "idle";
    if (status === "running") {
      return {
        icon: "pause-circle-filled" as const,
        color: c.parchmentAccent,
      };
    }
    if (status === "done") {
      return {
        icon: "check-circle" as const,
        color: "#7EA26B",
      };
    }
    if (status === "paused" || status === "error") {
      return {
        icon: "play-circle-filled" as const,
        color: c.parchmentAccent,
      };
    }
    return {
      icon: "download" as const,
      color: c.faint,
    };
  }, [downloadState.packageKey, downloadState.status, currentDownloadPackage.packageKey]);

  const onDownloadPackage = useCallback(
    (pkg: AudioDownloadPackageItem) => {
      trackTap("read.downloadAudioPack");
      const active = downloadState.packageKey === pkg.packageKey;
      if (active && downloadState.status === "running") {
        void pauseAudioPackageDownload();
        return;
      }
      if (active && (downloadState.status === "paused" || downloadState.status === "error")) {
        void resumeAudioPackageDownload({
          translationId: pkg.translationId,
          voiceId: pkg.voiceId,
          label: pkg.label,
        });
        return;
      }
      void startAudioPackageDownload({
        translationId: pkg.translationId,
        voiceId: pkg.voiceId,
        label: pkg.label,
      });
    },
    [downloadState.packageKey, downloadState.status],
  );

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <ShellSwipeExclude style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[styles.sheet, { marginTop: insets.top + 48, marginRight: Math.max(insets.right, 10) }]}
          onStartShouldSetResponder={() => true}
        >
          <ParchmentSettingRow icon="menu-book">
            <View style={styles.translationRow}>
              <ReadSettingsSelect
                style={styles.translationSelect}
                accessibilityLabel={`${t("pages.read.typography.primaryTranslation")} ${primaryDisplay}`}
                value={primaryTranslationId}
                options={primarySelectOptions}
                open={openMenu === "primary"}
                onOpenChange={onPrimaryOpenChange}
                onSelect={onPrimarySelect}
                onDownloadOption={onDownloadTranslation}
                disabled={!translationCatalogReady || primarySelectOptions.length === 0}
              />
              <ReadSettingsSelect
                style={styles.translationSelect}
                accessibilityLabel={`${t("pages.read.typography.contrastTranslation")} ${contrastDisplay}`}
                values={contrastDraftIds}
                emptyDisplay={t("pages.read.typography.contrastNone")}
                options={contrastSelectOptions}
                open={openMenu === "contrast"}
                onOpenChange={onContrastOpenChange}
                onToggleSelect={onContrastToggleSelect}
                onDownloadOption={onDownloadTranslation}
                disabled={!translationCatalogReady || contrastSelectOptions.length === 0}
              />
            </View>
          </ParchmentSettingRow>

          {chapterAudioPlaybackOptions.length > 0 ? (
            <ParchmentSettingRow icon="record-voice-over">
              <View style={styles.audioPlaybackRow}>
                <ReadSettingsSelect
                  style={styles.audioPlaybackSelect}
                  accessibilityLabel={`${t("pages.read.typography.chapterAudioVoiceLabel")} ${playbackDisplay}`}
                  value={
                    chapterAudioPlaybackOptions.some((o) => o.id === chapterAudioPlaybackValue)
                      ? chapterAudioPlaybackValue
                      : chapterAudioPlaybackOptions[0]!.id
                  }
                  options={playbackSelectOptions}
                  open={openMenu === "playback"}
                  onOpenChange={onPlaybackOpenChange}
                  onSelect={onChapterAudioPlaybackSelect}
                  disabled={!translationCatalogReady}
                />
                <Pressable
                  onPress={() => onDownloadPackage(currentDownloadPackage)}
                  accessibilityRole="button"
                  accessibilityLabel={`${locale === "en" ? "Audio package" : localeZhText("语音包")} ${downloadButtonText(currentDownloadPackage)}`}
                  style={({ pressed }) => [
                    styles.audioDownloadIconBtn,
                    pressed && styles.audioDownloadIconBtnPressed,
                  ]}
                >
                  <MaterialIcons name={downloadActionMeta.icon} size={18} color={downloadActionMeta.color} />
                </Pressable>
              </View>
            </ParchmentSettingRow>
          ) : null}

          <ParchmentSettingRow icon="format-size">
            <View style={styles.sizeSection}>
              <View style={styles.sizeActions}>
                <Pressable
                  onPress={onToggleChapterSegmentMode}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: chapterSegmentMode === "t1" }}
                  accessibilityLabel={
                    locale === "en"
                      ? "Toggle section titles (T1)"
                      : localeZhText("切换分段标题（T1）")
                  }
                  style={({ pressed }) => [
                    styles.sizeActionBtn,
                    chapterSegmentMode === "t1" && styles.sizeActionBtnActive,
                    pressed && styles.sizeActionBtnPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentModeText,
                      chapterSegmentMode === "t1" && styles.segmentModeTextActive,
                    ]}
                  >
                    T1
                  </Text>
                </Pressable>
                <View style={styles.sizeActionsTrailing}>
                <Pressable
                  onPress={() => setVerseParagraphFlow(!verseParagraphFlow)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: verseParagraphFlow }}
                  accessibilityLabel={t("pages.read.typography.verseParagraphFlowLabel")}
                  style={({ pressed }) => [
                    styles.sizeActionBtn,
                    verseParagraphFlow && styles.sizeActionBtnActive,
                    pressed && styles.sizeActionBtnPressed,
                  ]}
                >
                  <MaterialIcons
                    name="subject"
                    size={16}
                    color={verseParagraphFlow ? c.parchmentAccent : c.muted}
                  />
                </Pressable>
                <Pressable
                  onPress={resetSizeToDefault}
                  disabled={sizeAtDefault}
                  accessibilityRole="button"
                  accessibilityLabel={
                    locale === "en" ? "Reset scripture text size" : localeZhText("恢复默认字号")
                  }
                  style={({ pressed }) => [
                    styles.sizeActionBtn,
                    sizeAtDefault && styles.sizeActionBtnDisabled,
                    pressed && !sizeAtDefault && styles.sizeActionBtnPressed,
                  ]}
                >
                  <MaterialIcons
                    name="text-fields"
                    size={16}
                    color={sizeAtDefault ? c.muted : c.ink}
                  />
                </Pressable>
                <Pressable
                  onPress={setSizeToLargePreset}
                  disabled={sizeAtLargePreset}
                  accessibilityRole="button"
                  accessibilityLabel={
                    locale === "en" ? "Apply large text preset" : localeZhText("切换到大字预设")
                  }
                  style={({ pressed }) => [
                    styles.sizeActionBtn,
                    sizeAtLargePreset && styles.sizeActionBtnDisabled,
                    pressed && !sizeAtLargePreset && styles.sizeActionBtnPressed,
                  ]}
                >
                  <Text style={[styles.sizeActionTextPreset, sizeAtLargePreset && styles.sizeActionTextDisabled]}>
                    TT
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => bumpSize(1)}
                  disabled={sizeAtMax}
                  accessibilityRole="button"
                  accessibilityLabel={
                    locale === "en" ? "Increase scripture text size" : localeZhText("增大经文字号")
                  }
                  style={({ pressed }) => [
                    styles.sizeActionBtn,
                    sizeAtMax && styles.sizeActionBtnDisabled,
                    pressed && !sizeAtMax && styles.sizeActionBtnPressed,
                  ]}
                >
                  <Text style={[styles.sizeActionText, sizeAtMax && styles.sizeActionTextDisabled]}>T+</Text>
                </Pressable>
                <Pressable
                  onPress={() => bumpSize(-1)}
                  disabled={sizeAtMin}
                  accessibilityRole="button"
                  accessibilityLabel={
                    locale === "en" ? "Decrease scripture text size" : localeZhText("减小经文字号")
                  }
                  style={({ pressed }) => [
                    styles.sizeActionBtn,
                    sizeAtMin && styles.sizeActionBtnDisabled,
                    pressed && !sizeAtMin && styles.sizeActionBtnPressed,
                  ]}
                >
                  <Text style={[styles.sizeActionText, sizeAtMin && styles.sizeActionTextDisabled]}>T-</Text>
                </Pressable>
                </View>
              </View>
            </View>
          </ParchmentSettingRow>

        </View>
      </ShellSwipeExclude>
    </Modal>
  );
}
