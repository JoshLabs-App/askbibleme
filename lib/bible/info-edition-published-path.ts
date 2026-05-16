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
 * - 生产磁盘：挂载根目录（如 `/var/data`），文件直接写在根下，避免 `mkdir bible` 权限问题
 */
export function infoEditionWritableBibleDir(_cwd: string): string | null {
  if (!isInfoEditionDiskSaveEnabled()) return null;
  const external = infoEditionExternalDataRoot();
  if (external) return external;
  if (process.env.NODE_ENV === "production") return null;
  return path.join(_cwd, "data", "bible");
}

function probeWritableFileInDir(dir: string): boolean {
  const probe = path.join(dir, `.selah-write-probe-${process.pid}`);
  try {
    if (!fs.existsSync(dir)) {
      if (process.env.NODE_ENV === "production") return false;
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return true;
  } catch {
    try {
      if (fs.existsSync(probe)) fs.unlinkSync(probe);
    } catch {
      /* ignore */
    }
    return false;
  }
}

/** 磁盘目录真实可写（实际写入探针文件，避免 access 通过但 writeFile 仍 EACCES） */
export function isInfoEditionWritableDiskAvailable(cwd: string): boolean {
  const dir = infoEditionWritableBibleDir(cwd);
  if (!dir) return false;
  return probeWritableFileInDir(dir);
}

/** Render Persistent Disk 运维提示（附在写入错误后） */
export function renderPersistentDiskOpsHint(): string {
  if (!isRenderDeployment()) return "";
  return (
    "Render 提示：Disks 的 Mount Path 须与 DATA_ROOT 完全一致；服务实例数须为 1（多实例无法共用磁盘）；修改后 Manual Deploy。"
  );
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

export function formatInfoEditionDiskWriteError(baseMessage: string): string {
  const hint = renderPersistentDiskOpsHint();
  if (!hint) return baseMessage;
  if (baseMessage.includes("Render 提示")) return baseMessage;
  return `${baseMessage} ${hint}`;
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
  if (external) {
    return path.join(external, PUBLISHED_FILENAME);
  }
  if (process.env.NODE_ENV === "production") return null;
  return path.join(cwd, "data", "bible", PUBLISHED_FILENAME);
}
