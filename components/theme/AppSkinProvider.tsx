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
  parseUserSkin,
  presetColorsForUserSkin,
  type UserSkinId,
} from "@/lib/app-user-skin";
import {
  NATURE_HOME_THEME_LOCK_DATASET_KEY,
  NATURE_HOME_THEME_LOCK_VALUE,
} from "@/lib/nature/root-theme";
import { brandColorsToCssVars } from "@/lib/site-branding-colors";

type AppSkinContextValue = {
  skin: UserSkinId;
  setSkin: (id: UserSkinId) => void;
};

const AppSkinContext = createContext<AppSkinContextValue | null>(null);

const skinListeners = new Set<() => void>();

function emitSkinChange() {
  skinListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

function subscribeSkin(onStore: () => void) {
  if (typeof window === "undefined") return () => {};
  skinListeners.add(onStore);
  const onStorage = (e: StorageEvent) => {
    if (e.key === USER_SKIN_STORAGE_KEY || e.key === null) onStore();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    skinListeners.delete(onStore);
    window.removeEventListener("storage", onStorage);
  };
}

function getSkinSnapshot(): UserSkinId {
  if (typeof window === "undefined") return "site";
  return parseUserSkin(localStorage.getItem(USER_SKIN_STORAGE_KEY));
}

function getSkinServerSnapshot(): UserSkinId {
  return "site";
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

function isNatureHomeThemeColorLocked() {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.dataset[NATURE_HOME_THEME_LOCK_DATASET_KEY] === NATURE_HOME_THEME_LOCK_VALUE
  );
}

function syncThemeColorMetaFromCanvas(canvas: string) {
  if (isNatureHomeThemeColorLocked()) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && canvas) meta.setAttribute("content", canvas.trim());
}

function syncThemeColorMetaFromDocumentElement() {
  if (isNatureHomeThemeColorLocked()) return;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--brand-canvas").trim();
  if (raw) syncThemeColorMetaFromCanvas(raw);
}

function applyUserSkinToBody(id: UserSkinId) {
  clearBodyBrandVarOverrides();
  const preset = presetColorsForUserSkin(id);
  if (!preset) {
    syncThemeColorMetaFromDocumentElement();
    return;
  }
  const vars = brandColorsToCssVars(preset);
  applyVarsToBody(vars);
  syncThemeColorMetaFromCanvas(preset.canvas);
}

export function AppSkinProvider({ children }: { children: ReactNode }) {
  const skin = useSyncExternalStore(subscribeSkin, getSkinSnapshot, getSkinServerSnapshot);

  useLayoutEffect(() => {
    applyUserSkinToBody(skin);
  }, [skin]);

  const setSkin = useCallback((id: UserSkinId) => {
    try {
      localStorage.setItem(USER_SKIN_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    applyUserSkinToBody(id);
    emitSkinChange();
  }, []);

  const value = useMemo(() => ({ skin, setSkin }), [skin, setSkin]);

  return <AppSkinContext.Provider value={value}>{children}</AppSkinContext.Provider>;
}

export function useAppSkin(): AppSkinContextValue {
  const v = useContext(AppSkinContext);
  if (!v) throw new Error("useAppSkin must be used within AppSkinProvider");
  return v;
}
