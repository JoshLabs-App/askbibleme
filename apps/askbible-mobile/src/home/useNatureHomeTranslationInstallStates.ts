import { useCallback, useEffect, useRef, useState } from "react";
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
import type { BibleTranslationMeta } from "../bible/translations-types";
import type { NatureHomeSettingsSelectOption } from "./NatureHomeSettingsSelect";

export type NatureHomeTranslationDownloadState =
  NatureHomeSettingsSelectOption["downloadState"];

function toOptionDownloadState(
  status: ScriptureTranslationInstallStatus | undefined,
  translationId: string,
  downloadState: ReturnType<typeof readScriptureTranslationDownloadState>,
): NatureHomeTranslationDownloadState {
  if (
    downloadState.status === "running" &&
    downloadState.translationId === translationId
  ) {
    return "downloading";
  }
  if (status === "missing") return "missing";
  if (status === "outdated") return "outdated";
  return null;
}

export function attachNatureHomeTranslationDownloadStates(
  options: NatureHomeSettingsSelectOption[],
  installStates: Record<string, ScriptureTranslationInstallStatus>,
  downloadState: ReturnType<typeof readScriptureTranslationDownloadState>,
): NatureHomeSettingsSelectOption[] {
  return options.map((opt) => ({
    ...opt,
    downloadState: toOptionDownloadState(installStates[opt.id], opt.id, downloadState),
  }));
}

export function useNatureHomeTranslationInstallStates(catalog: BibleTranslationMeta[]) {
  const [translationDownloadState, setTranslationDownloadState] = useState(() =>
    readScriptureTranslationDownloadState(),
  );
  const [installStates, setInstallStates] = useState<Record<string, ScriptureTranslationInstallStatus>>(
    {},
  );
  const openMenuRef = useRef<"primary" | "contrast" | null>(null);

  useEffect(() => {
    return subscribeScriptureTranslationDownload(() => {
      if (openMenuRef.current) return;
      setTranslationDownloadState(readScriptureTranslationDownloadState());
    });
  }, []);

  const refreshInstallStates = useCallback(async () => {
    if (catalog.length === 0 || openMenuRef.current) return;
    const states = await listScriptureTranslationInstallStates({
      translations: catalog,
      defaultTranslationId: null,
    });
    if (openMenuRef.current) return;
    setInstallStates(states);
  }, [catalog]);

  useEffect(() => {
    if (catalog.length === 0) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void refreshInstallStates();
    });
    return () => task.cancel();
  }, [catalog, refreshInstallStates]);

  useEffect(() => {
    if (translationDownloadState.status !== "done") return;
    void refreshInstallStates();
  }, [translationDownloadState.status, refreshInstallStates]);

  const setOpenMenuTracked = useCallback((menu: "primary" | "contrast" | null) => {
    openMenuRef.current = menu;
  }, []);

  const onDownloadTranslation = useCallback(
    async (translationId: string) => {
      const meta = translationMetaFromCatalog(
        { translations: catalog, defaultTranslationId: null },
        translationId,
      );
      if (!meta?.downloadUrl) return;
      try {
        await downloadScriptureTranslation(translationId, meta.downloadUrl);
        await refreshInstallStates();
      } catch {
        /* surfaced via translationDownloadState */
      }
    },
    [catalog, refreshInstallStates],
  );

  const ensureTranslationDownloaded = useCallback(
    async (translationId: string) => {
      const meta = translationMetaFromCatalog(
        { translations: catalog, defaultTranslationId: null },
        translationId,
      );
      await ensureScriptureTranslationReady(translationId, meta?.downloadUrl);
      await refreshInstallStates();
    },
    [catalog, refreshInstallStates],
  );

  const isTranslationReady = useCallback(
    (translationId: string) => {
      const status = installStates[translationId];
      return status === "bundled" || status === "installed" || status === "outdated";
    },
    [installStates],
  );

  return {
    installStates,
    translationDownloadState,
    refreshInstallStates,
    setOpenMenuTracked,
    onDownloadTranslation,
    ensureTranslationDownloaded,
    isTranslationReady,
  };
}
