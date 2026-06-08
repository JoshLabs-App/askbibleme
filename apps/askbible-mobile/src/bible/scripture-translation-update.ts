import { fetchBibleTranslationsCatalogFresh } from "../api/fetchBibleTranslationsCatalog";
import type { BibleTranslationMeta, BibleTranslationsIndex } from "./translations-types";
import { isBundledScriptureTranslation } from "./bundled-scripture-translations";
import { getLocalScriptureTranslationByteSize } from "./scripture-database";
import {
  downloadScriptureTranslation,
  type ScriptureTranslationDownloadState,
  readScriptureTranslationDownloadState,
  subscribeScriptureTranslationDownload,
} from "./scripture-translation-download";

export type ScriptureTranslationUpdateReason = "missing" | "outdated";

export type ScriptureTranslationInstallStatus = "bundled" | "installed" | "missing" | "outdated";

export async function resolveScriptureTranslationInstallStatus(
  tr: BibleTranslationMeta,
): Promise<ScriptureTranslationInstallStatus> {
  const serverBytes = typeof tr.bytes === "number" && tr.bytes > 0 ? tr.bytes : 0;
  const localBytes = await getLocalScriptureTranslationByteSize(tr.id);
  if (serverBytes > 0 && localBytes > 0 && localBytes !== serverBytes) return "outdated";
  if (localBytes <= 0) return "missing";
  if (tr.bundled || isBundledScriptureTranslation(tr.id)) return "bundled";
  return "installed";
}

export async function listScriptureTranslationInstallStates(
  catalog: BibleTranslationsIndex,
): Promise<Record<string, ScriptureTranslationInstallStatus>> {
  const entries = await Promise.all(
    catalog.translations.map(async (tr) => [tr.id, await resolveScriptureTranslationInstallStatus(tr)] as const),
  );
  return Object.fromEntries(entries);
}

export type ScriptureTranslationUpdateItem = {
  translationId: string;
  labelZh: string;
  labelEn: string;
  bytes: number;
  downloadUrl: string | null;
  reason: ScriptureTranslationUpdateReason;
};

export async function checkScriptureTranslationUpdates(): Promise<ScriptureTranslationUpdateItem[]> {
  const catalog = await fetchBibleTranslationsCatalogFresh();
  const pending: ScriptureTranslationUpdateItem[] = [];

  for (const tr of catalog.translations) {
    const serverBytes = typeof tr.bytes === "number" && tr.bytes > 0 ? tr.bytes : 0;
    if (serverBytes <= 0) continue;

    const localBytes = await getLocalScriptureTranslationByteSize(tr.id);
    if (localBytes <= 0) {
      pending.push(toUpdateItem(tr, "missing"));
      continue;
    }
    if (localBytes !== serverBytes) {
      pending.push(toUpdateItem(tr, "outdated"));
    }
  }

  return pending;
}

function toUpdateItem(
  tr: BibleTranslationMeta,
  reason: ScriptureTranslationUpdateReason,
): ScriptureTranslationUpdateItem {
  return {
    translationId: tr.id,
    labelZh: tr.labelZh,
    labelEn: tr.labelEn,
    bytes: tr.bytes ?? 0,
    downloadUrl: tr.downloadUrl ?? null,
    reason,
  };
}

export async function downloadScriptureTranslationUpdate(
  item: ScriptureTranslationUpdateItem,
  options?: { force?: boolean },
): Promise<void> {
  const force = options?.force ?? item.reason === "outdated";
  await downloadScriptureTranslation(item.translationId, item.downloadUrl, { force });
}

export {
  readScriptureTranslationDownloadState,
  subscribeScriptureTranslationDownload,
  type ScriptureTranslationDownloadState,
};
