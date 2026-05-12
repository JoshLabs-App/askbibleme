import type { ShellTemplatePreviewThemeId } from "@/lib/shell/template-preview-themes";
import { isShellTemplatePreviewThemeId } from "@/lib/shell/template-preview-themes";

/** 左菜单「主题配色」：写入后由 `AppSkinProvider` 覆盖 `body` 上 `--brand-*`（与界面风格二选一优先级见该组件） */
export const SHELL_TEMPLATE_BRAND_STORAGE_KEY = "selah-shell-template-brand-v1";

export function readShellTemplateBrandFromStorage(): ShellTemplatePreviewThemeId | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SHELL_TEMPLATE_BRAND_STORAGE_KEY);
  if (!raw || raw === "off") return null;
  return isShellTemplatePreviewThemeId(raw) ? raw : null;
}

export function writeShellTemplateBrandToStorage(id: ShellTemplatePreviewThemeId | null): void {
  try {
    if (id == null) localStorage.removeItem(SHELL_TEMPLATE_BRAND_STORAGE_KEY);
    else localStorage.setItem(SHELL_TEMPLATE_BRAND_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
