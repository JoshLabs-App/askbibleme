"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type Value = {
  dockChromeVisible: boolean;
  setDockChromeVisible: (v: boolean) => void;
  toggleDockChrome: () => void;
};

const HomeDockChromeContext = createContext<Value | null>(null);

/** 自然首页进入时展开场景卡，此后自动收起（毫秒） */
const NATURE_DOCK_SCENE_AUTO_HIDE_MS = 5000;

/** 自然首页 `/`、`/nature` 等：底区场景卡由 `DockChromeCollapse` 控制；进入时先展开约 5s 后自动收起，点主画面可再展开/收起。 */
export function isNatureHomeShellPath(pathname: string) {
  const p = pathname || "";
  return p === "/" || p === "" || p === "/nature" || p.startsWith("/nature/");
}

export function HomeDockChromeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [dockChromeVisible, setDockChromeVisible] = useState(false);

  useEffect(() => {
    if (isNatureHomeShellPath(pathname)) {
      setDockChromeVisible(true);
      const id = window.setTimeout(() => setDockChromeVisible(false), NATURE_DOCK_SCENE_AUTO_HIDE_MS);
      return () => window.clearTimeout(id);
    }
    setDockChromeVisible(false);
  }, [pathname]);

  const toggleDockChrome = useCallback(() => {
    setDockChromeVisible((v) => !v);
  }, []);

  const value = useMemo(
    () => ({
      dockChromeVisible,
      setDockChromeVisible,
      toggleDockChrome,
    }),
    [dockChromeVisible],
  );

  return <HomeDockChromeContext.Provider value={value}>{children}</HomeDockChromeContext.Provider>;
}

export function useHomeDockChrome(): Value {
  const ctx = useContext(HomeDockChromeContext);
  if (!ctx) throw new Error("useHomeDockChrome must be used within HomeDockChromeProvider");
  return ctx;
}

/** 与 `dockChromeVisible` 同步收起：用于底栏、自然页底部条等 */
export function DockChromeCollapse({ children }: { children: ReactNode }) {
  const { dockChromeVisible } = useHomeDockChrome();
  return (
    <div
      className={[
        "grid shrink-0 transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
        dockChromeVisible ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        !dockChromeVisible ? "pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex min-h-0 flex-col">{children}</div>
      </div>
    </div>
  );
}
