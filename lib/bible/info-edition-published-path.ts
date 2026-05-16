import fs from "node:fs";
import path from "node:path";

const PUBLISHED_FILENAME = "info-edition-v1-published.json";

/** Render 等自托管：持久磁盘挂载时，生产环境也可写 JSON */
export function isInfoEditionDiskSaveEnabled(): boolean {
  if (process.env.STUDIO_DISABLE_DISK_SAVE === "1") {
    return false;
  }
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  return process.env.INFO_EDITION_DISK_SAVE === "1";
}

/** 构建产物内、随 Git 部署的默认发布文件（只读回退） */
export function infoEditionBundledPublishedPath(cwd: string): string {
  return path.join(cwd, "data", "bible", PUBLISHED_FILENAME);
}

function infoEditionExternalDataRoot(): string | null {
  const external =
    process.env.INFO_EDITION_DATA_DIR?.trim() || process.env.DATA_ROOT?.trim();
  return external || null;
}

/**
 * 可写目录（用于判断磁盘模式是否可用）。
 * - 本机 dev：`<cwd>/data/bible`
 * - 生产磁盘：挂载根目录（如 `/mnt/data`），文件直接写在根下，避免 `mkdir bible` 权限问题
 */
export function infoEditionWritableBibleDir(_cwd: string): string | null {
  if (!isInfoEditionDiskSaveEnabled()) return null;
  const external = infoEditionExternalDataRoot();
  if (external) return external;
  if (process.env.NODE_ENV === "production") return null;
  return path.join(_cwd, "data", "bible");
}

/** 磁盘目录真实可写（避免生产误配 DATA_ROOT 却无挂载，如 Vercel / 未挂盘的 Render） */
export function isInfoEditionWritableDiskAvailable(cwd: string): boolean {
  const dir = infoEditionWritableBibleDir(cwd);
  if (!dir) return false;
  try {
    if (fs.existsSync(dir)) {
      fs.accessSync(dir, fs.constants.W_OK);
      return true;
    }
    if (process.env.NODE_ENV !== "production") {
      fs.mkdirSync(dir, { recursive: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 生产环境磁盘写入是否已正确配置（避免写入只读构建目录导致 POST 500） */
export function isInfoEditionProductionDiskConfigured(): boolean {
  if (!isInfoEditionDiskSaveEnabled()) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(infoEditionExternalDataRoot());
}

/** Vercel 等无持久盘；勿把 DATA_ROOT 当可写目录 */
export function isVercelDeployment(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL);
}

/** askbible.me 等自托管（Render Web Service） */
export function isRenderDeployment(): boolean {
  return process.env.RENDER === "true" || Boolean(process.env.RENDER_SERVICE_ID);
}

/** 已开 INFO_EDITION_DISK_SAVE 但生产环境未挂 DATA_ROOT（Vercel 等无盘时常误配） */
export function isInfoEditionDiskSaveMisconfiguredInProduction(): boolean {
  return (
    isInfoEditionDiskSaveEnabled() &&
    process.env.NODE_ENV === "production" &&
    !infoEditionExternalDataRoot()
  );
}

/** 旧版 Render 路径（曾写入 `<mount>/bible/…`，只读合并用） */
export function infoEditionLegacyWritablePublishedPath(cwd: string): string | null {
  const external = infoEditionExternalDataRoot();
  if (!external || !isInfoEditionDiskSaveEnabled()) return null;
  return path.join(external, "bible", PUBLISHED_FILENAME);
}

/**
 * 可写发布文件路径。
 * - 本机 dev：`<cwd>/data/bible/info-edition-v1-published.json`
 * - 生产磁盘：`<DATA_ROOT>/info-edition-v1-published.json`（挂载根目录，勿再建 bible 子目录）
 */
export function infoEditionWritablePublishedPath(cwd: string): string | null {
  if (!isInfoEditionDiskSaveEnabled()) return null;
  const external = infoEditionExternalDataRoot();
  if (external) return path.join(external, PUBLISHED_FILENAME);
  if (process.env.NODE_ENV === "production") return null;
  return path.join(cwd, "data", "bible", PUBLISHED_FILENAME);
}
