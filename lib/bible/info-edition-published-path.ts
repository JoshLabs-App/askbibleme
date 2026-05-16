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

/**
 * 可写发布文件目录。
 * - 本机 dev：`<cwd>/data/bible`
 * - Render 等：`INFO_EDITION_DATA_DIR`（如 `/mnt/data`）→ `/mnt/data/bible`
 */
export function infoEditionWritableBibleDir(cwd: string): string | null {
  if (!isInfoEditionDiskSaveEnabled()) return null;
  const external =
    process.env.INFO_EDITION_DATA_DIR?.trim() ||
    process.env.DATA_ROOT?.trim();
  if (external) return path.join(external, "bible");
  return path.join(cwd, "data", "bible");
}

export function infoEditionWritablePublishedPath(cwd: string): string | null {
  const dir = infoEditionWritableBibleDir(cwd);
  return dir ? path.join(dir, PUBLISHED_FILENAME) : null;
}
