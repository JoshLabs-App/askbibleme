"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BRAND_CSS_VAR_NAMES,
  USER_SKIN_STORAGE_KEY,
  parseUserSkin,
  presetColorsForUserSkin,
  type UserSkinId,
} from "@/lib/app-user-skin";
import { brandColorsToCssVars } from "@/lib/site-branding-colors";

type AppSkinContextValue = {
  skin: UserSkinId;
  setSkin: (id: UserSkinId) => void;
};

const AppSkinContext = createContext<AppSkinContextValue | null>(null);

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

function syncThemeColorMetaFromCanvas(canvas: string) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && canvas) meta.setAttribute("content", canvas.trim());
}

function syncThemeColorMetaFromDocumentElement() {
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
  const [skin, setSkinState] = useState<UserSkinId>("site");

  useLayoutEffect(() => {
    const saved = parseUserSkin(
      typeof window !== "undefined" ? localStorage.getItem(USER_SKIN_STORAGE_KEY) : null,
    );
    setSkinState(saved);
    applyUserSkinToBody(saved);
  }, []);

  const setSkin = useCallback((id: UserSkinId) => {
    setSkinState(id);
    try {
      localStorage.setItem(USER_SKIN_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    applyUserSkinToBody(id);
  }, []);

  const value = useMemo(() => ({ skin, setSkin }), [skin, setSkin]);

  return <AppSkinContext.Provider value={value}>{children}</AppSkinContext.Provider>;
}

export function useAppSkin(): AppSkinContextValue {
  const v = useContext(AppSkinContext);
  if (!v) throw new Error("useAppSkin must be used within AppSkinProvider");
  return v;
}
