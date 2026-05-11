"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { LocalePickerModal } from "@/components/i18n/LocalePickerModal";
import { subscribeSiteBrandingUpdated } from "@/lib/branding-broadcast";

/** 常规手机最小触控约 44×44（iOS HIG / Material）；顶栏按钮统一此尺寸 */
const HIT = "flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97]";

function IconMenu(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 18" fill="none" className={props.className} aria-hidden>
      <path
        d="M1 1.25h22M1 9h22M1 16.75h22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

const menuSurfaceDark =
  "min-w-[10rem] rounded-xl border border-white/[0.12] bg-black/45 py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl";

const menuSurfaceLight =
  "min-w-[10rem] rounded-xl border border-sky-200/80 bg-white/[0.94] py-1 text-ink shadow-[0_12px_40px_-12px_rgba(15,60,90,0.12)] backdrop-blur-xl";

const menuItemDark =
  "block px-3 py-2.5 text-[15px] font-normal leading-snug text-white/[0.92] transition hover:bg-white/[0.06] sm:py-2 sm:text-[14px]";

const menuItemLight =
  "block px-3 py-2.5 text-[15px] font-normal leading-snug text-ink/90 transition hover:bg-sky-100/90 sm:py-2 sm:text-[14px]";

const EDGE_SWIPE_OPEN_PX = 56;
const EDGE_SWIPE_START_MAX_X = 28;

export type AppShellTopBarTone = "onDark" | "onLight";

type Props = {
  /** 深色底用 `onDark`，浅色底用 `onLight`（菜单面与字色） */
  tone?: AppShellTopBarTone;
  /** 顶栏右上（如自然页环境声静音）；未传时用占位保持与左侧按钮对称 */
  rightAccessory?: ReactNode;
};

/**
 * 应用壳默认顶栏：左上导航菜单（含管理入口）、右上可选控件；`absolute` 叠在页面内容之上。
 * 任意路由页在 `relative` 容器内引用即可；左缘滑开与窄条与首页行为一致。
 */
export function AppShellTopBar({ tone = "onDark", rightAccessory = null }: Props) {
  const pathname = usePathname() ?? "";
  const { t } = useLocale();
  const onLight = tone === "onLight";
  const menuSurface = onLight ? menuSurfaceLight : menuSurfaceDark;
  const menuItem = onLight ? menuItemLight : menuItemDark;
  const iconBtn =
    HIT +
    (onLight ? " text-ink/85 hover:bg-ink/[0.06]" : " text-white/[0.9] hover:bg-white/[0.1]");
  const [navOpen, setNavOpen] = useState(false);
  const [localePickerOpen, setLocalePickerOpen] = useState(false);
  /** 与 `/api/admin/branding` 一致：有资源时顶栏中央展示透明 LOGO */
  const [brandLogoSrc, setBrandLogoSrc] = useState<string | null>(null);
  const brandFetchAbortRef = useRef<AbortController | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const navEdgeStripRef = useRef<HTMLButtonElement>(null);
  const suppressNavEdgeClickRef = useRef(false);
  const edgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const openNavMenu = useCallback(() => {
    setNavOpen(true);
  }, []);

  const toggleNavMenu = useCallback(() => {
    setNavOpen((o) => !o);
  }, []);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (navOpen) {
        edgeSwipeStartRef.current = null;
        return;
      }
      const rawTarget = e.target;
      if (rawTarget instanceof Element && rawTarget.closest("button, a, input, textarea, select")) {
        edgeSwipeStartRef.current = null;
        return;
      }
      const x = e.touches[0]?.clientX ?? 999;
      if (x <= EDGE_SWIPE_START_MAX_X) {
        edgeSwipeStartRef.current = { x, y: e.touches[0]?.clientY ?? 0 };
      } else {
        edgeSwipeStartRef.current = null;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const start = edgeSwipeStartRef.current;
      edgeSwipeStartRef.current = null;
      if (!start) return;
      const endX = e.changedTouches[0]?.clientX ?? start.x;
      const endY = e.changedTouches[0]?.clientY ?? start.y;
      const dx = endX - start.x;
      const dy = Math.abs(endY - start.y);
      if (dx >= EDGE_SWIPE_OPEN_PX && dx > dy * 1.1) {
        suppressNavEdgeClickRef.current = true;
        openNavMenu();
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [navOpen, openNavMenu]);

  const loadBrandingLogo = useCallback(() => {
    brandFetchAbortRef.current?.abort();
    const ac = new AbortController();
    brandFetchAbortRef.current = ac;
    void (async () => {
      try {
        const res = await fetch("/api/admin/branding", { signal: ac.signal, cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          logoReady?: boolean;
          iconsReady?: boolean;
          state?: { logoKind?: string; updatedAt?: string } | null;
          urls?: { logo?: string; vector?: string } | null;
        };
        if (ac.signal.aborted) return;
        if (!data.logoReady || !data.state?.updatedAt) {
          setBrandLogoSrc(null);
          return;
        }
        const v = encodeURIComponent(data.state.updatedAt);
        const src =
          data.state.logoKind === "svg" && data.urls?.vector
            ? `${data.urls.vector}?v=${v}`
            : data.urls?.logo
              ? `${data.urls.logo}?v=${v}`
              : null;
        if (!src) {
          setBrandLogoSrc(null);
          return;
        }
        setBrandLogoSrc(src);
      } catch {
        if (!ac.signal.aborted) setBrandLogoSrc(null);
      }
    })();
  }, []);

  useEffect(() => {
    loadBrandingLogo();
    return () => {
      brandFetchAbortRef.current?.abort();
    };
  }, [loadBrandingLogo]);

  useEffect(() => {
    return subscribeSiteBrandingUpdated(() => loadBrandingLogo());
  }, [loadBrandingLogo]);

  useEffect(() => {
    if (!navOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (navEdgeStripRef.current?.contains(target)) return;
      if (navRef.current?.contains(target)) return;
      setNavOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNavOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);

  const openNav = () => {
    toggleNavMenu();
  };

  /** 顶栏下缘大致位置，左缘窄条从此向下延伸，避开顶栏按钮 */
  const edgeStripTopClass = "top-[calc(env(safe-area-inset-top)+3.25rem)]";

  return (
    <>
      <button
        type="button"
        ref={navEdgeStripRef}
        tabIndex={-1}
        aria-hidden
        className={`fixed bottom-[calc(4.85rem+env(safe-area-inset-bottom))] left-0 z-[48] w-6 min-w-[1.25rem] cursor-pointer border-0 bg-transparent py-0 pl-[env(safe-area-inset-left)] pr-0 outline-none ${edgeStripTopClass}`}
        onClick={() => {
          if (suppressNavEdgeClickRef.current) {
            suppressNavEdgeClickRef.current = false;
            return;
          }
          toggleNavMenu();
        }}
      />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[50] px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
        <div className="grid w-full min-h-[44px] grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="pointer-events-auto relative justify-self-start" ref={navRef}>
            <button
              type="button"
              onClick={openNav}
              aria-label={navOpen ? t("chrome.closeNavMenu") : t("chrome.openNavMenu")}
              aria-expanded={navOpen}
              aria-haspopup="menu"
              aria-controls="app-shell-nav-menu"
              className={iconBtn}
            >
              <IconMenu className="h-3 w-[1.125rem] opacity-90" />
            </button>
            {navOpen ? (
              <div
                id="app-shell-nav-menu"
                role="menu"
                className={`absolute left-0 top-[calc(100%+0.35rem)] z-[60] ${menuSurface}`}
              >
                {pathname !== "/" && pathname !== "" ? (
                  <Link href="/" role="menuitem" className={menuItem} onClick={() => setNavOpen(false)}>
                    {t("chrome.backHome")}
                  </Link>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className={`${menuItem} w-full cursor-pointer border-0 bg-transparent text-left`}
                  onClick={() => {
                    setNavOpen(false);
                    setLocalePickerOpen(true);
                  }}
                >
                  {t("nav.language")}
                </button>
                <Link href="/admin" role="menuitem" className={menuItem} onClick={() => setNavOpen(false)}>
                  {t("chrome.adminHome")}
                </Link>
              </div>
            ) : null}
          </div>

          <div className="pointer-events-auto flex min-w-0 max-w-[min(52vw,14rem)] justify-center justify-self-center">
            {brandLogoSrc ? (
              <Link
                href="/"
                className="flex h-11 max-h-[44px] items-center py-1"
                aria-label={t("chrome.backHome")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 动态 branding 查询串；无需 Image 优化 */}
                <img
                  src={brandLogoSrc}
                  alt=""
                  className="max-h-9 w-auto max-w-full object-contain opacity-[0.92] drop-shadow-sm transition hover:opacity-100"
                  decoding="async"
                />
              </Link>
            ) : (
              <span className="h-11 w-px shrink-0" aria-hidden />
            )}
          </div>

          <div className="pointer-events-auto relative flex justify-end justify-self-end">
            {rightAccessory ?? <span className="h-11 w-11 shrink-0" aria-hidden />}
          </div>
        </div>
      </header>
      <LocalePickerModal open={localePickerOpen} onDismiss={() => setLocalePickerOpen(false)} />
    </>
  );
}
