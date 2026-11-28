"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  ASKBIBLE_MOBILE_MODEL_CHANGE_EVENT,
  ASKBIBLE_SHELL_VIEWPORT_ID,
  PHONE_SHELL_OUTER_HEIGHT,
  PHONE_SHELL_OUTER_WIDTH,
  PHONE_VIEWPORT_HEIGHT,
  PHONE_VIEWPORT_WIDTH,
  computePhoneFrameScale,
  isDesktopViewportEligible,
} from "@/lib/shell/app-shell-portal-root";
import "./mobile-model-stage.css";

export {
  PHONE_SHELL_OUTER_HEIGHT,
  PHONE_SHELL_OUTER_WIDTH,
  PHONE_VIEWPORT_HEIGHT,
  PHONE_VIEWPORT_WIDTH,
  computePhoneFrameScale,
};

type ScrollAnchorSnapshot = {
  verse: string | null;
  verseOffsetPx: number;
  scrollRatio: number;
};

function captureScrollAnchor(viewportEl: HTMLElement | null): ScrollAnchorSnapshot {
  const appScroll = document.querySelector<HTMLElement>("[data-app-shell-scroll]");
  const scroller = appScroll ?? viewportEl;
  if (!scroller) {
    return { verse: null, verseOffsetPx: 0, scrollRatio: 0 };
  }
  const containerRect = scroller.getBoundingClientRect();
  const verses = Array.from(scroller.querySelectorAll<HTMLElement>("[data-verse]"));
  for (const vEl of verses) {
    const r = vEl.getBoundingClientRect();
    if (r.bottom > containerRect.top + 40) {
      return {
        verse: vEl.getAttribute("data-verse"),
        verseOffsetPx: r.top - containerRect.top,
        scrollRatio:
          scroller.scrollHeight > scroller.clientHeight
            ? scroller.scrollTop / (scroller.scrollHeight - scroller.clientHeight)
            : 0,
      };
    }
  }
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  return {
    verse: null,
    verseOffsetPx: 0,
    scrollRatio: maxScroll > 0 ? scroller.scrollTop / maxScroll : 0,
  };
}

function restoreScrollAnchor(snap: ScrollAnchorSnapshot, viewportEl: HTMLElement | null): void {
  const appScroll = document.querySelector<HTMLElement>("[data-app-shell-scroll]");
  const scroller = appScroll ?? viewportEl;
  if (!scroller) return;
  if (snap.verse) {
    const target = scroller.querySelector<HTMLElement>(`[data-verse="${CSS.escape(snap.verse)}"]`);
    if (target) {
      const containerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const delta = targetRect.top - containerRect.top - snap.verseOffsetPx;
      scroller.scrollTop = Math.max(0, scroller.scrollTop + delta);
      return;
    }
  }
  const maxScroll = scroller.scrollHeight - scroller.clientHeight;
  if (maxScroll > 0 && snap.scrollRatio > 0) {
    scroller.scrollTop = Math.round(snap.scrollRatio * maxScroll);
  }
}

type MobileModelContextValue = {
  mobileModelOpen: boolean;
  desktopEligible: boolean;
  setMobileModelOpen: (open: boolean) => void;
  toggleMobileModel: () => void;
};

const MobileModelContext = createContext<MobileModelContextValue | null>(null);

export function useMobileModel(): MobileModelContextValue {
  const ctx = useContext(MobileModelContext);
  if (!ctx) {
    return {
      mobileModelOpen: false,
      desktopEligible: false,
      setMobileModelOpen: () => {},
      toggleMobileModel: () => {},
    };
  }
  return ctx;
}

function isExcludedDesktopToolPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname === "/tv" ||
    pathname.startsWith("/tv/")
  );
}

/**
 * 桌面端客户级「电脑端 ⇄ 1:1 手机模型（390 × 844）」自由切换容器：
 * - 原地切换同一棵 React 子树与 `<div id="askbible-shell-viewport">`，零销毁、零重载；
 * - 当前经文阅读位置、搜经输入状态、音乐/朗读/金句播放进度 100% 原地保留；
 * - 小屏笔记本高度不足时外层 `.ab-phone-shell` 自动 `transform: scale(...)` 等比缩放，内部保持真实 `390×844` 视口。
 */
export function MobileModelStage({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const { locale } = useLocale();
  const isEn = locale === "en";
  const excludedRoute = isExcludedDesktopToolPath(pathname);

  const [desktopEligible, setDesktopEligible] = useState(false);
  const [mobileModelOpenState, setMobileModelOpenState] = useState(false);
  const [scale, setScale] = useState(1);

  const stageBodyRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pendingAnchorRef = useRef<ScrollAnchorSnapshot | null>(null);

  const effectiveOpen = desktopEligible && !excludedRoute && mobileModelOpenState;

  const setMobileModelOpen = useCallback((next: boolean) => {
    pendingAnchorRef.current = captureScrollAnchor(viewportRef.current);
    setMobileModelOpenState(next);
  }, []);

  const toggleMobileModel = useCallback(() => {
    setMobileModelOpenState((prev) => {
      pendingAnchorRef.current = captureScrollAnchor(viewportRef.current);
      return !prev;
    });
  }, []);

  useEffect(() => {
    const syncViewportEligibility = () => {
      const eligible = isDesktopViewportEligible();
      setDesktopEligible(eligible);
      if (!eligible) {
        setMobileModelOpenState(false);
      }
    };
    syncViewportEligibility();
    window.addEventListener("resize", syncViewportEligibility);
    return () => window.removeEventListener("resize", syncViewportEligibility);
  }, []);

  useLayoutEffect(() => {
    const html = document.documentElement;
    if (effectiveOpen) {
      html.dataset.abMobileModel = "1";
    } else {
      delete html.dataset.abMobileModel;
    }
    window.dispatchEvent(new CustomEvent(ASKBIBLE_MOBILE_MODEL_CHANGE_EVENT, { detail: { open: effectiveOpen } }));
    window.dispatchEvent(new Event("resize"));

    const snap = pendingAnchorRef.current;
    if (snap) {
      pendingAnchorRef.current = null;
      restoreScrollAnchor(snap, viewportRef.current);
      const raf = requestAnimationFrame(() => {
        restoreScrollAnchor(snap, viewportRef.current);
      });
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [effectiveOpen]);

  useLayoutEffect(() => {
    if (!effectiveOpen) {
      setScale(1);
      return;
    }
    const updateScale = () => {
      const bodyEl = stageBodyRef.current;
      const availW = bodyEl ? bodyEl.clientWidth - 8 : window.innerWidth - 32;
      const availH = bodyEl ? bodyEl.clientHeight - 8 : window.innerHeight - 76;
      setScale(computePhoneFrameScale(availW, availH));
    };
    updateScale();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScale) : null;
    if (ro && stageBodyRef.current) ro.observe(stageBodyRef.current);
    window.addEventListener("resize", updateScale);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [effectiveOpen]);

  useEffect(() => {
    if (!effectiveOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.documentElement.dataset.abCodeProbe === "1") return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      e.stopPropagation();
      setMobileModelOpen(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [effectiveOpen, setMobileModelOpen]);

  const ctxValue = useMemo(
    () => ({
      mobileModelOpen: effectiveOpen,
      desktopEligible: desktopEligible && !excludedRoute,
      setMobileModelOpen,
      toggleMobileModel,
    }),
    [effectiveOpen, desktopEligible, excludedRoute, setMobileModelOpen, toggleMobileModel],
  );

  const onOfficialLanding = pathname === "/";

  return (
    <MobileModelContext.Provider value={ctxValue}>
      <div
        className="ab-mobile-model-stage"
        data-ab-mobile-stage={effectiveOpen ? "1" : "0"}
        role={effectiveOpen ? "region" : undefined}
        aria-label={
          effectiveOpen
            ? isEn
              ? "1:1 Phone Model Preview (390×844)"
              : "1:1 手机模型预览（390×844）"
            : undefined
        }
      >
        {effectiveOpen ? (
          <header className="ab-mobile-model-bar" data-ab-probe-ui="">
            <div
              className="ab-mobile-model-tabs"
              role="tablist"
              aria-label={isEn ? "Viewport switcher" : "电脑与手机视图切换"}
            >
              <button
                type="button"
                role="tab"
                className="ab-mobile-model-tab"
                aria-selected={false}
                data-ab-nav-id="viewport-desktop"
                onClick={() => setMobileModelOpen(false)}
              >
                {isEn ? "Desktop" : "电脑端"}
              </button>
              <button
                type="button"
                role="tab"
                className="ab-mobile-model-tab"
                aria-selected={true}
                data-ab-nav-id="viewport-phone-model"
              >
                {isEn ? "1:1 Phone (390×844)" : "1:1 手机模型 (390×844)"}
              </button>
            </div>
            <button
              type="button"
              className="ab-mobile-model-exit"
              data-ab-nav-id="mobile-model-exit"
              onClick={() => setMobileModelOpen(false)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M8 20h8M12 16v4" />
              </svg>
              <span>{isEn ? "Back to Desktop (Esc)" : "切回电脑端（Esc）"}</span>
            </button>
          </header>
        ) : null}

        <div ref={stageBodyRef} className="ab-mobile-model-body">
          <div
            className="ab-phone-shell"
            style={effectiveOpen && scale !== 1 ? { transform: `scale(${scale})` } : undefined}
          >
            {effectiveOpen ? <div className="ab-phone-earpiece" aria-hidden="true" /> : null}
            <div
              key="ab-shell-viewport"
              id={ASKBIBLE_SHELL_VIEWPORT_ID}
              ref={viewportRef}
              className="ab-shell-viewport"
              data-viewport={effectiveOpen ? `${PHONE_VIEWPORT_WIDTH}x${PHONE_VIEWPORT_HEIGHT}` : undefined}
            >
              {children}
            </div>
            {effectiveOpen ? <div className="ab-phone-homebar" aria-hidden="true" /> : null}
          </div>
        </div>
      </div>

      {desktopEligible && !excludedRoute && !effectiveOpen && !onOfficialLanding ? (
        <button
          type="button"
          className="ab-desktop-model-fab"
          data-ab-nav-id="desktop-phone-fab"
          aria-pressed={false}
          title={
            isEn
              ? "Switch to 1:1 Phone Model (390×844) without losing reading or audio state"
              : "切入 1:1 手机模型（390×844），保留当前阅读与音频播放进度"
          }
          onClick={() => setMobileModelOpen(true)}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="4" y="1.5" width="8" height="13" rx="1.8" />
            <path d="M7 12.2h2" />
          </svg>
          <span>{isEn ? "1:1 Phone" : "1:1 手机模型"}</span>
        </button>
      ) : null}
    </MobileModelContext.Provider>
  );
}
