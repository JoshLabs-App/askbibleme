import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
  encodeChapterAudioPlaybackOptionId,
} from "./read-chapter-audio-playback-options";
import { useLocale } from "../i18n/LocaleProvider";
import { t } from "../i18n/site-copy";
import { useMusicPlayback } from "../music/MusicPlaybackContext";
import { parchmentSans } from "../fonts/parchmentType";
import { readParchmentTheme as c } from "./readParchmentTheme";
import { useReadBibleTypography } from "./ReadBibleTypographyContext";
import { ReadSettingsSelect, type ReadSettingsSelectOption } from "./ReadSettingsSelect";
import { translationUsesWebChapterAudio } from "../bible/web-chapter-audio";
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

type Props = {
  visible: boolean;
  onClose: () => void;
};

type OpenMenu = "primary" | "contrast" | "playback" | null;

type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];

const SHORT_LABEL_ZH: Record<string, string> = {
  "cuv-simp": "和合本",
  "cuv-trad": "繁体",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "heb-leningrad": "希伯来",
  "rv1909-es": "西语",
  mandarin: "普通话",
  "teochew-nt": "潮汕语",
};

const SHORT_LABEL_EN: Record<string, string> = {
  "cuv-simp": "CUV",
  "cuv-trad": "CUV Trad",
  "web-en": "WEB",
  "bbe-en": "BBE",
  "heb-leningrad": "Hebrew",
  "rv1909-es": "Spanish",
  mandarin: "Mandarin",
  "teochew-nt": "Teochew",
};

function shortLabel(id: string, locale: string, fallback: string): string {
  const map = locale === "en" ? SHORT_LABEL_EN : SHORT_LABEL_ZH;
  return map[id] ?? fallback;
}

function translationOptionLabel(
  tr: { labelZh: string; labelEn: string },
  locale: string,
): string {
  return locale === "en" ? tr.labelEn : tr.labelZh;
}

function ParchmentSettingRow({
  icon,
  children,
}: {
  icon: MaterialIconName;
  children: React.ReactNode;
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
    contrastTranslationId,
    audioTranslationId,
    sizeAtMin,
    sizeAtMax,
    sizeAtDefault,
    bumpSize,
    resetSizeToDefault,
    setPrimaryTranslationId,
    setContrastTranslationId,
    setAudioTranslationId,
  } = useReadBibleTypography();
  const { playing, togglePlayScripture, playbackMode } = useMusicPlayback();
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [downloadState, setDownloadState] = useState(() => readAudioPackageDownloadState());

  useEffect(() => {
    if (!visible) setOpenMenu(null);
  }, [visible]);

  useEffect(() => {
    void ensureAudioPackageDownloadHydrated();
    return subscribeAudioPackageDownload(() => {
      setDownloadState(readAudioPackageDownloadState());
    });
  }, []);

  const primaryOptions = useMemo((): ReadSettingsSelectOption[] => {
    return translationCatalog.map((tr) => {
      const label = translationOptionLabel(tr, locale);
      return { id: tr.id, label, shortLabel: shortLabel(tr.id, locale, label) };
    });
  }, [translationCatalog, locale]);

  const contrastOptions = useMemo((): ReadSettingsSelectOption[] => {
    const noneLabel = t("pages.read.typography.contrastNone");
    const none: ReadSettingsSelectOption = {
      id: "",
      label: noneLabel,
      shortLabel: noneLabel,
    };
    const rest = translationCatalog
      .filter((tr) => tr.id !== primaryTranslationId)
      .map((tr) => {
        const label = translationOptionLabel(tr, locale);
        return { id: tr.id, label, shortLabel: shortLabel(tr.id, locale, label) };
      });
    return [none, ...rest];
  }, [translationCatalog, primaryTranslationId, locale]);

  const chapterAudioPlaybackOptions = useMemo((): ReadSettingsSelectOption[] => {
    return buildChapterAudioPlaybackOptions(translationCatalog, locale, t).map((opt) => ({
      ...opt,
      shortLabel: shortLabel(opt.id, locale, opt.label),
    }));
  }, [translationCatalog, locale]);

  const chapterAudioPlaybackValue = useMemo(
    () =>
      encodeChapterAudioPlaybackOptionId(
        audioTranslationId,
        audioVoiceId,
        primaryTranslationId,
      ),
    [audioTranslationId, audioVoiceId, primaryTranslationId],
  );

  const primaryDisplay =
    primaryOptions.find((o) => o.id === primaryTranslationId)?.shortLabel ??
    primaryOptions.find((o) => o.id === primaryTranslationId)?.label ??
    "";
  const contrastDisplay =
    contrastOptions.find((o) => o.id === (contrastTranslationId ?? ""))?.shortLabel ??
    contrastOptions.find((o) => o.id === (contrastTranslationId ?? ""))?.label ??
    t("pages.read.typography.contrastNone");
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
      translationId: primaryTranslationId,
      voiceId: picked.voiceId,
    };
  }, [chapterAudioPlaybackValue, primaryTranslationId]);

  const activePackageKey = useMemo(
    () =>
      chapterAudioPackageKey({
        translationId: downloadTarget.translationId,
        voiceId: downloadTarget.voiceId,
      }),
    [downloadTarget.translationId, downloadTarget.voiceId],
  );
  const downloadForCurrentSelection = downloadState.packageKey === activePackageKey;
  const downloadPercent = downloadState.total
    ? Math.floor(((downloadState.completed + downloadState.currentPercent) / downloadState.total) * 100)
    : 0;
  const downloadPrimaryText =
    locale === "en"
      ? downloadState.status === "running" && downloadForCurrentSelection
        ? `Downloading ${downloadPercent}%`
        : downloadState.status === "paused" && downloadForCurrentSelection
          ? "Resume download"
          : downloadState.status === "done" && downloadForCurrentSelection
            ? "Downloaded"
            : "Download audio pack"
      : downloadState.status === "running" && downloadForCurrentSelection
        ? `下载中 ${downloadPercent}%`
        : downloadState.status === "paused" && downloadForCurrentSelection
          ? "继续下载"
          : downloadState.status === "done" && downloadForCurrentSelection
            ? "已下载"
            : "下载音频包";
  const downloadSecondaryText =
    locale === "en"
      ? `Prepare ${playbackDisplay || "chapter audio"}`
      : `准备下载 ${playbackDisplay || "朗读音频"}`;

  const restartScriptureIfPlaying = useCallback(async () => {
    if (playing && playbackMode === "scripture") {
      await togglePlayScripture();
    }
  }, [playing, playbackMode, togglePlayScripture]);

  const onPrimarySelect = useCallback(
    (id: string) => {
      if (id === primaryTranslationId) {
        setOpenMenu(null);
        return;
      }
      void setPrimaryTranslationId(id).then(() => setOpenMenu(null));
    },
    [primaryTranslationId, setPrimaryTranslationId],
  );

  const onContrastSelect = useCallback(
    (id: string) => {
      const next = id.trim() ? id : null;
      if (next === contrastTranslationId) {
        setOpenMenu(null);
        return;
      }
      void setContrastTranslationId(next).then(() => setOpenMenu(null));
    },
    [contrastTranslationId, setContrastTranslationId],
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
        const audioChanged = (nextAudio ?? null) !== (audioTranslationId ?? null);
        const voiceChanged = nextVoice !== audioVoiceId;
        if (audioChanged) await setAudioTranslationId(nextAudio);
        if (voiceChanged) await persistAudioVoiceId(nextVoice);
        setOpenMenu(null);
        if (audioChanged || voiceChanged) await restartScriptureIfPlaying();
      })();
    },
    [
      chapterAudioPlaybackValue,
      audioTranslationId,
      audioVoiceId,
      setAudioTranslationId,
      persistAudioVoiceId,
      restartScriptureIfPlaying,
    ],
  );

  const onDownloadAudioPack = useCallback(() => {
    trackTap("read.downloadAudioPack");
    if (downloadState.status === "running" && downloadForCurrentSelection) {
      void pauseAudioPackageDownload();
      return;
    }
    if (
      downloadForCurrentSelection &&
      (downloadState.status === "paused" || downloadState.status === "error")
    ) {
      void resumeAudioPackageDownload({
        translationId: downloadTarget.translationId,
        voiceId: downloadTarget.voiceId,
        label: playbackDisplay || (locale === "en" ? "Chapter audio" : "整章朗读"),
      });
      return;
    }
    void startAudioPackageDownload({
      translationId: downloadTarget.translationId,
      voiceId: downloadTarget.voiceId,
      label: playbackDisplay || (locale === "en" ? "Chapter audio" : "整章朗读"),
    });
  }, [
    downloadState.status,
    downloadForCurrentSelection,
    downloadTarget.translationId,
    downloadTarget.voiceId,
    playbackDisplay,
    locale,
  ]);

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
                options={primaryOptions}
                open={openMenu === "primary"}
                onOpenChange={(open) => setOpenMenu(open ? "primary" : null)}
                onSelect={onPrimarySelect}
                disabled={!translationCatalogReady || primaryOptions.length === 0}
              />
              <ReadSettingsSelect
                style={styles.translationSelect}
                accessibilityLabel={`${t("pages.read.typography.contrastTranslation")} ${contrastDisplay}`}
                value={contrastTranslationId ?? ""}
                options={contrastOptions}
                open={openMenu === "contrast"}
                onOpenChange={(open) => setOpenMenu(open ? "contrast" : null)}
                onSelect={onContrastSelect}
                disabled={!translationCatalogReady || contrastOptions.length <= 1}
              />
            </View>
          </ParchmentSettingRow>

          {chapterAudioPlaybackOptions.length > 0 ? (
            <ParchmentSettingRow icon="record-voice-over">
              <ReadSettingsSelect
                accessibilityLabel={`${t("pages.read.typography.chapterAudioVoiceLabel")} ${playbackDisplay}`}
                value={
                  chapterAudioPlaybackOptions.some((o) => o.id === chapterAudioPlaybackValue)
                    ? chapterAudioPlaybackValue
                    : chapterAudioPlaybackOptions[0]!.id
                }
                options={chapterAudioPlaybackOptions}
                open={openMenu === "playback"}
                onOpenChange={(open) => setOpenMenu(open ? "playback" : null)}
                onSelect={onChapterAudioPlaybackSelect}
                disabled={!translationCatalogReady}
              />
            </ParchmentSettingRow>
          ) : null}

          <ParchmentSettingRow icon="format-size">
            <View style={styles.sizeActions}>
              <Pressable
                onPress={resetSizeToDefault}
                disabled={sizeAtDefault}
                accessibilityRole="button"
                accessibilityLabel={locale === "en" ? "Reset scripture text size" : "恢复默认字号"}
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
                onPress={() => bumpSize(1)}
                disabled={sizeAtMax}
                accessibilityRole="button"
                accessibilityLabel={locale === "en" ? "Increase scripture text size" : "增大经文字号"}
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
                accessibilityLabel={locale === "en" ? "Decrease scripture text size" : "减小经文字号"}
                style={({ pressed }) => [
                  styles.sizeActionBtn,
                  sizeAtMin && styles.sizeActionBtnDisabled,
                  pressed && !sizeAtMin && styles.sizeActionBtnPressed,
                ]}
              >
                <Text style={[styles.sizeActionText, sizeAtMin && styles.sizeActionTextDisabled]}>T-</Text>
              </Pressable>
            </View>
          </ParchmentSettingRow>

          <ParchmentSettingRow icon="download">
            <View style={styles.downloadRow}>
              <Pressable
                onPress={onDownloadAudioPack}
                accessibilityRole="button"
                accessibilityLabel={downloadPrimaryText}
                style={({ pressed }) => [
                  styles.downloadBtn,
                  pressed && styles.downloadBtnPressed,
                  downloadState.status === "done" &&
                    downloadForCurrentSelection &&
                    styles.downloadBtnDone,
                ]}
              >
                <Text style={styles.downloadBtnText}>{downloadPrimaryText}</Text>
              </Pressable>
              {!downloadForCurrentSelection ? (
                <Text style={styles.downloadHint}>{downloadSecondaryText}</Text>
              ) : null}
              {downloadState.error && downloadForCurrentSelection ? (
                <Text style={styles.downloadError}>{downloadState.error}</Text>
              ) : null}
            </View>
          </ParchmentSettingRow>

        </View>
      </ShellSwipeExclude>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: c.modalBackdrop,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  sheet: {
    width: 272,
    maxWidth: "88%",
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
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  translationSelect: {
    flex: 1,
    minWidth: 0,
  },
  sizeActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
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
  sizeActionText: {
    fontSize: 13,
    color: c.ink,
    ...parchmentSans(600),
  },
  sizeActionTextDisabled: {
    color: c.muted,
  },
  downloadRow: {
    width: "100%",
    gap: 6,
    paddingTop: 2,
  },
  downloadBtn: {
    minHeight: 34,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  downloadBtnPressed: {
    backgroundColor: c.hover,
  },
  downloadBtnDone: {
    borderColor: "#A5B996",
    backgroundColor: "rgba(165,185,150,0.20)",
  },
  downloadBtnText: {
    fontSize: 13,
    color: c.ink,
    ...parchmentSans(600),
  },
  downloadHint: {
    fontSize: 11,
    color: c.muted,
    ...parchmentSans(400),
  },
  downloadError: {
    fontSize: 11,
    color: "#A3553A",
    ...parchmentSans(500),
  },
});
