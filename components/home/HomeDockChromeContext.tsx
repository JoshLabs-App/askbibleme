"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type Value = {
  /** 场景条已完全展开且不透明（用于 a11y、pointer-events） */
  dockChromeVisible: boolean;
  /** 底区占位行是否展开（含淡入淡出过程中的占位） */
  dockChromeLayoutOpen: boolean;
  /** 场景条内容不透明度 0–1 */
  dockChromeContentOpacity: number;
  /** 当前 opacity 过渡时长（淡入 / 淡出） */
  dockChromeOpacityTransitionMs: number;
  setDockChromeVisible: (v: boolean) => void;
  toggleDockChrome: () => void;
  /** 自然首页：与进入首页相同节奏（延迟 → 淡入 → 停留 → 渐隐） */
  peekDockChrome: () => void;
};

const HomeDockChromeContext = createContext<Value | null>(null);

/** 进入自然首页 / peek：先等待再显示场景条（毫秒） */
const NATURE_DOCK_SCENE_DELAY_MS = 3000;
/** 场景条淡入时长 */
const NATURE_DOCK_SCENE_FADE_IN_MS = 750;
/** 完全显示后保持时长 */
const NATURE_DOCK_SCENE_HOLD_MS = 3000;
/** 场景条渐隐时长 */
const NATURE_DOCK_SCENE_FADE_OUT_MS = 650;
/** 底区占位 `grid-template-rows` 展开/收起动画 */
const NATURE_DOCK_LAYOUT_TRANSITION_MS = 520;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/** 手动点画面展开/收起：内容淡入略短；收起较快 */
const NATURE_DOCK_MANUAL_FADE_IN_MS = 320;
const NATURE_DOCK_MANUAL_FADE_OUT_MS = 220;

/** 自然首页 `/`、`/nature` 等：底区场景卡节奏由本文件定时；点主画面可即时展开/收起（打断自动序列）。 */
export function isNatureHomeShellPath(pathname: string) {
  const p = pathname || "";
  return p === "/" || p === "" || p === "/nature" || p.startsWith("/nature/");
}

export function HomeDockChromeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const reduceMotion = usePrefersReducedMotion();
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [contentOpacity, setContentOpacity] = useState(0);
  const [opacityTransitionMs, setOpacityTransitionMs] = useState(NATURE_DOCK_SCENE_FADE_IN_MS);
  const sequenceTimerIdsRef = useRef<number[]>([]);

  const clearSequenceTimers = useCallback(() => {
    for (const id of sequenceTimerIdsRef.current) {
      window.clearTimeout(id);
    }
    sequenceTimerIdsRef.current = [];
  }, []);

  const pushTimer = useCallback((id: number) => {
    sequenceTimerIdsRef.current.push(id);
  }, []);

  const dockChromeVisible = layoutOpen && contentOpacity >= 1;

  const startAutoRevealSequence = useCallback(() => {
    clearSequenceTimers();
    const delay = reduceMotion ? 0 : NATURE_DOCK_SCENE_DELAY_MS;
    const fadeIn = reduceMotion ? 140 : NATURE_DOCK_SCENE_FADE_IN_MS;
    const hold = reduceMotion ? 900 : NATURE_DOCK_SCENE_HOLD_MS;
    const fadeOut = reduceMotion ? 160 : NATURE_DOCK_SCENE_FADE_OUT_MS;

    setOpacityTransitionMs(fadeIn);
    setLayoutOpen(false);
    setContentOpacity(0);

    const fadeOutAt = delay + fadeIn + hold;
    const collapseAt = fadeOutAt + fadeOut;

    const tShow = window.setTimeout(() => {
      setLayoutOpen(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOpacityTransitionMs(fadeIn);
          setContentOpacity(1);
        });
      });
    }, delay);
    pushTimer(tShow);

    const tFadeOut = window.setTimeout(() => {
      setOpacityTransitionMs(fadeOut);
      setContentOpacity(0);
    }, fadeOutAt);
    pushTimer(tFadeOut);

    const tCollapse = window.setTimeout(() => {
      setLayoutOpen(false);
      setContentOpacity(0);
    }, collapseAt);
    pushTimer(tCollapse);
  }, [clearSequenceTimers, pushTimer, reduceMotion]);

  const peekDockChrome = useCallback(() => {
    if (!isNatureHomeShellPath(pathname)) return;
    startAutoRevealSequence();
  }, [pathname, startAutoRevealSequence]);

  useEffect(() => {
    clearSequenceTimers();
    if (isNatureHomeShellPath(pathname)) {
      startAutoRevealSequence();
    } else {
      setLayoutOpen(false);
      setContentOpacity(0);
    }
    return () => clearSequenceTimers();
  }, [pathname, clearSequenceTimers, startAutoRevealSequence, reduceMotion]);

  const setDockChromeVisible = useCallback(
    (v: boolean) => {
      clearSequenceTimers();
      if (v) {
        setOpacityTransitionMs(NATURE_DOCK_MANUAL_FADE_IN_MS);
        setLayoutOpen(true);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setContentOpacity(1));
        });
      } else {
        setOpacityTransitionMs(NATURE_DOCK_MANUAL_FADE_OUT_MS);
        setContentOpacity(0);
        setLayoutOpen(false);
      }
    },
    [clearSequenceTimers],
  );

  const toggleDockChrome = useCallback(() => {
    clearSequenceTimers();
    const full = layoutOpen && contentOpacity >= 1;
    if (full) {
      setOpacityTransitionMs(NATURE_DOCK_MANUAL_FADE_OUT_MS);
      setContentOpacity(0);
      setLayoutOpen(false);
    } else {
      setOpacityTransitionMs(NATURE_DOCK_MANUAL_FADE_IN_MS);
      setLayoutOpen(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setContentOpacity(1));
      });
    }
  }, [clearSequenceTimers, contentOpacity, layoutOpen]);

  const value = useMemo(
    () => ({
      dockChromeVisible,
      dockChromeLayoutOpen: layoutOpen,
      dockChromeContentOpacity: contentOpacity,
      dockChromeOpacityTransitionMs: opacityTransitionMs,
      setDockChromeVisible,
      toggleDockChrome,
      peekDockChrome,
    }),
    [
      contentOpacity,
      dockChromeVisible,
      layoutOpen,
      opacityTransitionMs,
      peekDockChrome,
      setDockChromeVisible,
      toggleDockChrome,
    ],
  );

  return <HomeDockChromeContext.Provider value={value}>{children}</HomeDockChromeContext.Provider>;
}

export function useHomeDockChrome(): Value {
  const ctx = useContext(HomeDockChromeContext);
  if (!ctx) throw new Error("useHomeDockChrome must be used within HomeDockChromeProvider");
  return ctx;
}

/** 与场景条布局/透明度同步：先占位展开再淡入，收起前渐隐 */
export function DockChromeCollapse({ children }: { children: ReactNode }) {
  const {
    dockChromeLayoutOpen,
    dockChromeContentOpacity,
    dockChromeOpacityTransitionMs,
    dockChromeVisible,
  } = useHomeDockChrome();
  return (
    <div
      className={[
        "grid shrink-0 transition-[grid-template-rows] ease-out motion-reduce:transition-none",
        dockChromeLayoutOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        !dockChromeLayoutOpen ? "pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        transitionDuration: `${NATURE_DOCK_LAYOUT_TRANSITION_MS}ms`,
      }}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className="flex min-h-0 flex-col motion-reduce:!transition-none"
          style={{
            opacity: dockChromeContentOpacity,
            transitionProperty: "opacity",
            transitionDuration: `${dockChromeOpacityTransitionMs}ms`,
            transitionTimingFunction: "ease-out",
            pointerEvents: dockChromeVisible ? "auto" : "none",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
