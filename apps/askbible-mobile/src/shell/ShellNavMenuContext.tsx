import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ShellNavMenuContextValue = {
  open: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
};

const ShellNavMenuContext = createContext<ShellNavMenuContextValue | null>(null);

export function ShellNavMenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openMenu = useCallback(() => setOpen(true), []);
  const closeMenu = useCallback(() => setOpen(false), []);
  const toggleMenu = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, openMenu, closeMenu, toggleMenu }),
    [open, openMenu, closeMenu, toggleMenu],
  );

  return <ShellNavMenuContext.Provider value={value}>{children}</ShellNavMenuContext.Provider>;
}

export function useShellNavMenu(): ShellNavMenuContextValue {
  const ctx = useContext(ShellNavMenuContext);
  if (!ctx) {
    throw new Error("useShellNavMenu must be used within ShellNavMenuProvider");
  }
  return ctx;
}
