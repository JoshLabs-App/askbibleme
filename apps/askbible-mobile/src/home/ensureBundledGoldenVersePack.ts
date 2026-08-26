import { Asset } from "expo-asset";
import { Directory, File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import {
  GOLDEN_VERSE_AUDIO_SUBDIR,
  GOLDEN_VERSE_WEBP_AUDIO_SUBDIR,
  type GoldenVerseAudioTranslationId,
} from "@/lib/bible/golden-verse-audio";
import {
  extractStoreMethodZipEntry,
  unzipStoreMethodZipAsync,
} from "./unzipStoreMethodZip";
import {
  markGoldenVerseAudioReady,
  reconcileGoldenVerseAudioReadyFromDisk,
} from "./goldenVerseGe5PackState";
import {
  goldenVerseAudioFile,
  goldenVerseAudioRootDir,
  goldenVerseInstalledMarkerFile,
  goldenVerseLangPackDir,
  goldenVerseLangPackId,
  goldenVerseOnDemandFile,
  goldenVersePacksBaseDir,
  type GoldenVerseLangPackId,
} from "./goldenVersePackPaths";

type PackId = GoldenVerseLangPackId;

const installPromises = new Map<PackId, Promise<void>>();
const zipReadablePromises = new Map<PackId, Promise<string>>();
const installingPackIds = new Set<PackId>();
const installListeners = new Set<() => void>();
let installGeneration = 0;

/** 已缓存 zip 的最小合理体积（低于此视为损坏）。 */
const MIN_CACHED_ZIP_BYTES = 5_000_000;

function emitInstallState(): void {
  installGeneration += 1;
  installListeners.forEach((listener) => listener());
}

export function subscribeGoldenVersePackInstall(listener: () => void): () => void {
  installListeners.add(listener);
  return () => installListeners.delete(listener);
}

export function getGoldenVersePackInstallGeneration(): number {
  return installGeneration;
}

export function isGoldenVersePackInstalling(translationId?: GoldenVerseAudioTranslationId): boolean {
  if (!translationId) return installingPackIds.size > 0;
  return installingPackIds.has(goldenVerseLangPackId(translationId));
}

function packIdForTranslation(translationId: GoldenVerseAudioTranslationId): PackId {
  return goldenVerseLangPackId(translationId);
}

function loadPackRegistry(): {
  modules: Partial<Record<PackId, number>>;
  revisions: Partial<Record<PackId, string>>;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const generated = require("../media/generated/bundled-golden-verse-packs") as {
      GOLDEN_VERSE_PACK_MODULES?: Partial<Record<PackId, number>>;
      GOLDEN_VERSE_PACK_REVISIONS?: Partial<Record<PackId, string>>;
    };
    return {
      modules: generated.GOLDEN_VERSE_PACK_MODULES ?? {},
      revisions: generated.GOLDEN_VERSE_PACK_REVISIONS ?? {},
    };
  } catch {
    return { modules: {}, revisions: {} };
  }
}

export function getBundledGoldenVersePackModule(packId: PackId): number | null {
  return loadPackRegistry().modules[packId] ?? null;
}

function getBundledGoldenVersePackRevision(packId: PackId): string | null {
  const rev = loadPackRegistry().revisions[packId];
  return typeof rev === "string" && rev.trim() ? rev.trim() : null;
}

function isPackInstalled(packId: PackId, revision: string | null): boolean {
  const marker = goldenVerseInstalledMarkerFile(packId);
  const dir = goldenVerseLangPackDir(packId);
  if (!marker.exists || !dir.exists) return false;
  if (!revision) return true;
  try {
    return marker.textSync().trim() === revision;
  } catch {
    return false;
  }
}

/** 同步：该语言包是否已整包解压就绪（用于 UI，不挡开播）。 */
export function isBundledGoldenVersePackReady(
  translationId: GoldenVerseAudioTranslationId,
): boolean {
  const packId = packIdForTranslation(translationId);
  return isPackInstalled(packId, getBundledGoldenVersePackRevision(packId));
}

function cachedZipPath(packId: PackId, revision: string): string {
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  return `${base}askbible-golden-verse-zip-full-${packId}-${revision}.zip`;
}

/**
 * 可读 zip 路径：优先已有缓存；否则直接用安装包内 Asset（不先拷 100MB）。
 * 点播抽条 / 后台整包解压共用。
 */
async function resolvePackZipReadableUri(packId: PackId): Promise<string> {
  const mod = getBundledGoldenVersePackModule(packId);
  if (mod == null) throw new Error(`golden verse pack missing: ${packId}`);
  const revision = getBundledGoldenVersePackRevision(packId) || "1";

  let pending = zipReadablePromises.get(packId);
  if (!pending) {
    pending = (async () => {
      const dest = cachedZipPath(packId, revision);
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists && typeof info.size === "number" && info.size > MIN_CACHED_ZIP_BYTES) {
        return dest;
      }

      const [asset] = await Asset.loadAsync(mod);
      const localUri = (asset.localUri || asset.uri || "").trim();
      if (!localUri) throw new Error(`golden verse pack uri missing: ${packId}`);
      return localUri;
    })().finally(() => {
      if (zipReadablePromises.get(packId) === pending) {
        zipReadablePromises.delete(packId);
      }
    });
    zipReadablePromises.set(packId, pending);
  }
  return pending;
}

/**
 * 后台整包：从安装包 zip 解到 Documents/full/。
 * 不在冷启动预热；不挡当前句开播；不走主站下载。
 */
async function installFullPack(packId: PackId): Promise<void> {
  const mod = getBundledGoldenVersePackModule(packId);
  if (mod == null) return;

  const revision = getBundledGoldenVersePackRevision(packId);
  if (isPackInstalled(packId, revision)) return;

  const base = goldenVersePacksBaseDir();
  if (!base.exists) base.create({ intermediates: true, idempotent: true });
  const audioRoot = goldenVerseAudioRootDir();
  if (!audioRoot.exists) audioRoot.create({ intermediates: true, idempotent: true });

  const staging = new Directory(audioRoot, `.staging-${packId}`);
  if (staging.exists) staging.delete();

  const zipPath = await resolvePackZipReadableUri(packId);
  const zipFile = new File(zipPath);
  const expected = revision || String(zipFile.size || "1");
  if (isPackInstalled(packId, expected)) return;

  const dest = goldenVerseLangPackDir(packId);
  if (dest.exists) dest.delete();

  staging.create({ intermediates: true, idempotent: true });
  await unzipStoreMethodZipAsync(zipFile, staging);

  const nested = new Directory(staging, packId);
  if (nested.exists) {
    nested.move(dest);
  } else {
    staging.move(dest);
  }
  if (staging.exists) staging.delete();

  const marker = goldenVerseInstalledMarkerFile(packId);
  if (marker.exists) marker.delete();
  marker.create({ intermediates: true, overwrite: true });
  marker.write(expected);
}

export async function ensureBundledGoldenVersePackInstalled(
  translationId: GoldenVerseAudioTranslationId,
): Promise<boolean> {
  const packId = packIdForTranslation(translationId);
  if (getBundledGoldenVersePackModule(packId) == null) return false;

  const revision = getBundledGoldenVersePackRevision(packId);
  if (isPackInstalled(packId, revision)) {
    await markGoldenVerseAudioReady(translationId);
    return true;
  }
  if (await reconcileGoldenVerseAudioReadyFromDisk(translationId)) {
    return true;
  }

  let pending = installPromises.get(packId);
  if (!pending) {
    installingPackIds.add(packId);
    emitInstallState();
    pending = installFullPack(packId).finally(() => {
      installPromises.delete(packId);
      installingPackIds.delete(packId);
      emitInstallState();
    });
    installPromises.set(packId, pending);
  }
  try {
    await pending;
  } catch (err) {
    if (__DEV__) console.warn("[golden-verse-pack] install failed", translationId, err);
    return false;
  }
  const ok = isPackInstalled(packId, revision) || goldenVerseLangPackDir(packId).exists;
  if (ok) await markGoldenVerseAudioReady(translationId);
  return ok;
}

/**
 * 点播：已解压则直读；否则从 zip 抽当前条（不整包拷贝），立刻可播。
 */
export async function ensureBundledGoldenVerseAudioFile(
  relativePath: string,
): Promise<string | null> {
  const trimmed = relativePath.replace(/^\/+/, "").trim();
  if (!trimmed || trimmed.includes("..")) return null;

  const packed = goldenVerseAudioFile(trimmed);
  if (packed.exists && packed.size > 0) return packed.uri;

  const cached = goldenVerseOnDemandFile(trimmed);
  if (cached.exists && cached.size > 0) return cached.uri;

  const packId: PackId = trimmed.startsWith(`${GOLDEN_VERSE_WEBP_AUDIO_SUBDIR}/`)
    ? GOLDEN_VERSE_WEBP_AUDIO_SUBDIR
    : GOLDEN_VERSE_AUDIO_SUBDIR;
  if (getBundledGoldenVersePackModule(packId) == null) return null;

  try {
    const zipPath = await resolvePackZipReadableUri(packId);
    const bytes = extractStoreMethodZipEntry(new File(zipPath), trimmed);
    if (!bytes || bytes.byteLength <= 0) return null;

    const out = goldenVerseOnDemandFile(trimmed);
    if (out.exists) out.delete();
    out.create({ intermediates: true, overwrite: true });
    out.write(bytes);
    if (!out.exists || out.size <= 0) return null;
    return out.uri;
  } catch (err) {
    if (__DEV__) console.warn("[golden-verse-pack] extract entry failed", trimmed, err);
    return null;
  }
}
