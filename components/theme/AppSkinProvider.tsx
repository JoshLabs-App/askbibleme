"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  BRAND_CSS_VAR_NAMES,
  USER_SKIN_STORAGE_KEY,
  USER_SKIN_STORAGE_KEY_LEGACY,
  parseUserSkin,
  presetColorsForUserSkin,
  type UserSkinId,
} from "@/lib/app-user-skin";
import {
  readShellTemplateBrandFromStorage,
  SHELL_TEMPLATE_BRAND_STORAGE_KEY,
  writeShellTemplateBrandToStorage,
} from "@/lib/shell/shell-template-brand-preference";
import {
  isShellTemplatePreviewThemeId,
  shellTemplatePreviewCssVars,
  shellTemplatePreviewThemeById,
  type ShellTemplatePreviewThemeId,
} from "@/lib/shell/template-preview-themes";
import { isThemeColorManagedOnDocument } from "@/lib/read/scripture-parchment-shell";
import { brandColorsToCssVars } from "@/lib/site-branding-colors";

type AppSkinContextValue = {
  skin: UserSkinId;
  setSkin: (id: UserSkinId) => void;
  /** 非空时：`body` 上壳主题配色覆盖「界面风格」预设与站点默认 */
  shellTemplateBrand: ShellTemplatePreviewThemeId | null;
  setShellTemplateBrand: (id: ShellTemplatePreviewThemeId | null) => void;
};

const AppSkinContext = createContext<AppSkinContextValue | null>(null);

const appearanceListeners = new Set<() => void>();

function emitAppearanceChange() {
  appearanceListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function subscribeAppearance(onStore: () => void) {
  if (typeof window === "undefined") return () => {};
  appearanceListeners.add(onStore);
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === USER_SKIN_STORAGE_KEY ||
      e.key === USER_SKIN_STORAGE_KEY_LEGACY ||
      e.key === SHELL_TEMPLATE_BRAND_STORAGE_KEY ||
      e.key === null
    ) {
      onStore();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    appearanceListeners.delete(onStore);
    window.removeEventListener("storage", onStorage);
  };
}

const APPEARANCE_SERVER_SNAPSHOT = JSON.stringify({ skin: "site", template: null as string | null });

function getAppearanceSnapshot(): string {
  if (typeof window === "undefined") return APPEARANCE_SERVER_SNAPSHOT;
  const skin = parseUserSkin(
    localStorage.getItem(USER_SKIN_STORAGE_KEY) ?? localStorage.getItem(USER_SKIN_STORAGE_KEY_LEGACY),
  );
  const template = readShellTemplateBrandFromStorage();
  return JSON.stringify({ skin, template });
}

function parseAppearanceSnapshot(raw: string): {
  skin: UserSkinId;
  shellTemplateBrand: ShellTemplatePreviewThemeId | null;
} {
  try {
    const o = JSON.parse(raw) as { skin?: unknown; template?: unknown };
    const skin = parseUserSkin(typeof o.skin === "string" ? o.skin : null);
    const t = o.template;
    const shellTemplateBrand =
      typeof t === "string" && isShellTemplatePreviewThemeId(t) ? t : null;
    return { skin, shellTemplateBrand };
  } catch {
    return { skin: "site", shellTemplateBrand: null };
  }
}

function clearBodyBrandVarOverrides() {
  for (const name of BRAND_CSS_VAR_NAMES) {
    document.body.style.removeProperty(name);
  }
}

function applyVarsToBody(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) {
    document.body.style.setProperty(k, v);
  }
}

function isThemeColorLockedExternally() {
  return isThemeColorManagedOnDocument();
}

function syncThemeColorMetaFromCanvas(canvas: string) {
  if (isThemeColorLockedExternally()) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && canvas) meta.setAttribute("content", canvas.trim());
}

function syncThemeColorMetaFromDocumentElement() {
  if (isThemeColorLockedExternally()) return;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--brand-canvas").trim();
  if (raw) syncThemeColorMetaFromCanvas(raw);
}

function syncHtmlCanvasBackgroundWithBody() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const cs = getComputedStyle(document.body);
  const canvas = cs.getPropertyValue("--brand-canvas").trim();
  const rgb = cs.getPropertyValue("--brand-canvas-rgb").trim();
  if (canvas) root.style.setProperty("--brand-canvas", canvas);
  if (rgb) root.style.setProperty("--brand-canvas-rgb", rgb);
}

function applyAppearanceToBody(skin: UserSkinId, shellTemplateBrand: ShellTemplatePreviewThemeId | null) {
  clearBodyBrandVarOverrides();
  if (shellTemplateBrand) {
    const theme = shellTemplatePreviewThemeById(shellTemplateBrand);
    applyVarsToBody(shellTemplatePreviewCssVars(theme));
    syncThemeColorMetaFromCanvas(theme.colors.canvas);
    syncHtmlCanvasBackgroundWithBody();
    return;
  }
  const preset = presetColorsForUserSkin(skin);
  if (!preset) {
    syncThemeColorMetaFromDocumentElement();
    syncHtmlCanvasBackgroundWithBody();
    return;
  }
  applyVarsToBody(brandColorsToCssVars(preset));
  syncThemeColorMetaFromCanvas(preset.canvas);
  syncHtmlCanvasBackgroundWithBody();
}

export function AppSkinProvider({ children }: { children: ReactNode }) {
  const appearanceSnapshot = useSyncExternalStore(
    subscribeAppearance,
    getAppearanceSnapshot,
    () => APPEARANCE_SERVER_SNAPSHOT,
  );

  const { skin, shellTemplateBrand } = useMemo(
    () => parseAppearanceSnapshot(appearanceSnapshot),
    [appearanceSnapshot],
  );

  useLayoutEffect(() => {
    const parsed = parseAppearanceSnapshot(appearanceSnapshot);
    applyAppearanceToBody(parsed.skin, parsed.shellTemplateBrand);
  }, [appearanceSnapshot]);

  const setSkin = useCallback((id: UserSkinId) => {
    try {
      localStorage.setItem(USER_SKIN_STORAGE_KEY, id);
      localStorage.removeItem(USER_SKIN_STORAGE_KEY_LEGACY);
    } catch {
      /* ignore */
    }
    emitAppearanceChange();
  }, []);

  const setShellTemplateBrand = useCallback((id: ShellTemplatePreviewThemeId | null) => {
    writeShellTemplateBrandToStorage(id);
    emitAppearanceChange();
  }, []);

  const value = useMemo(
    () => ({ skin, setSkin, shellTemplateBrand, setShellTemplateBrand }),
    [skin, setSkin, shellTemplateBrand, setShellTemplateBrand],
  );

  return <AppSkinContext.Provider value={value}>{children}</AppSkinContext.Provider>;
}

export function useAppSkin(): AppSkinContextValue {
  const v = useContext(AppSkinContext);
  if (!v) throw new Error("useAppSkin must be used within AppSkinProvider");
  return v;
}
