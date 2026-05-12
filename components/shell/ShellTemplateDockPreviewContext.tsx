"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ShellTemplateDockPreviewValue = {
  /** 非空时：底栏与播放钮用此色，与壳模板页预览 `--brand-app-dark` 对齐 */
  templateDockHex: string | null;
  setTemplateDockHex: (hex: string | null) => void;
};

const ShellTemplateDockPreviewContext = createContext<ShellTemplateDockPreviewValue | null>(null);

export function ShellTemplateDockPreviewProvider({ children }: { children: ReactNode }) {
  const [templateDockHex, setTemplateDockHexState] = useState<string | null>(null);
  const setTemplateDockHex = useCallback((hex: string | null) => {
    setTemplateDockHexState(hex);
  }, []);
  const value = useMemo(
    () => ({ templateDockHex, setTemplateDockHex }),
    [templateDockHex, setTemplateDockHex],
  );
  return (
    <ShellTemplateDockPreviewContext.Provider value={value}>{children}</ShellTemplateDockPreviewContext.Provider>
  );
}

export function useShellTemplateDockPreview(): ShellTemplateDockPreviewValue {
  const v = useContext(ShellTemplateDockPreviewContext);
  if (!v) {
    throw new Error("useShellTemplateDockPreview must be used within ShellTemplateDockPreviewProvider");
  }
  return v;
}

export function useShellTemplateDockPreviewOptional(): ShellTemplateDockPreviewValue | null {
  return useContext(ShellTemplateDockPreviewContext);
}
