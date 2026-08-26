import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { InteractionManager } from "react-native";
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
import { toZhTwText } from "../i18n/site-copy";
import type { AppLocale } from "../i18n/config";
import type { ReadSettingsSelectOption } from "./ReadSettingsSelect";

type OpenMenu = "primary" | "contrast" | "playback" | null;

type Args = {
  visible: boolean;
  locale: AppLocale;
  translationCatalog: BibleTranslationsIndex["translations"];
  translationCatalogReady: boolean;
  openMenu: OpenMenu;
  openMenuRef: MutableRefObject<OpenMenu>;
};

export function useReadBibleSettingsInstallStates({
  visible,
  locale,
  translationCatalog,
  translationCatalogReady,
  openMenu,
  openMenuRef,
}: Args) {
  const [translationDownloadState, setTranslationDownloadState] = useState(() =>
    readScriptureTranslationDownloadState(),
  );
  const [installStates, setInstallStates] = useState<Record<string, ScriptureTranslationInstallStatus>>({});
  const installStatesRef = useRef(installStates);
  installStatesRef.current = installStates;

  const localeZhText = useCallback(
    (text: string) => (locale === "zh-TW" ? toZhTwText(text) : text),
    [locale],
  );

  useEffect(() => {
    return subscribeScriptureTranslationDownload(() => {
      if (openMenuRef.current) return;
      setTranslationDownloadState(readScriptureTranslationDownloadState());
    });
  }, [openMenuRef]);

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
  }, [translationCatalog.length, translationCatalogIndex, openMenuRef]);

  useEffect(() => {
    if (!visible || openMenu || !translationCatalogReady || translationCatalog.length === 0) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void refreshInstallStates();
    });
    return () => task.cancel();
  }, [visible, openMenu, translationCatalogReady, translationCatalog.length, refreshInstallStates]);

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
      // 缺失译本选中后自动准备，列表里不再标「需下载」
      if (state === "outdated") {
        return locale === "en" ? " · update" : ` · ${localeZhText("可更新")}`;
      }
      return "";
    },
    [locale, localeZhText, optionDownloadState, translationDownloadState],
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
      await ensureScriptureTranslationReady(translationId, meta?.downloadUrl, {
        delivery: meta?.delivery,
      });
    },
    [translationCatalog],
  );

  return {
    optionDownloadState,
    translationStatusSuffix,
    onDownloadTranslation,
    ensureTranslationDownloaded,
  };
}
