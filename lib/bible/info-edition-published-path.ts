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
 * 可写发布文件目录。
 * - 本机 dev：`<cwd>/data/bible`
 * - 生产（Render 等）：必须设 `DATA_ROOT` 或 `INFO_EDITION_DATA_DIR`（如 `/mnt/data`）→ `/mnt/data/bible`
 */
export function infoEditionWritableBibleDir(_cwd: string): string | null {
  if (!isInfoEditionDiskSaveEnabled()) return null;
  const external = infoEditionExternalDataRoot();
  if (external) return path.join(external, "bible");
  if (process.env.NODE_ENV === "production") return null;
  return path.join(_cwd, "data", "bible");
}

/** 生产环境磁盘写入是否已正确配置（避免写入只读构建目录导致 POST 500） */
export function isInfoEditionProductionDiskConfigured(): boolean {
  if (!isInfoEditionDiskSaveEnabled()) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return Boolean(infoEditionExternalDataRoot());
}

export function infoEditionWritablePublishedPath(cwd: string): string | null {
  const dir = infoEditionWritableBibleDir(cwd);
  return dir ? path.join(dir, PUBLISHED_FILENAME) : null;
}
