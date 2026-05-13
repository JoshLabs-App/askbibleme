"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useAppSkin } from "@/components/theme/AppSkinProvider";
import { ShellTemplateThemeStrip } from "@/components/shell/ShellTemplateThemeStrip";
import { LocalePickerModal } from "@/components/i18n/LocalePickerModal";
import { isNatureHomeShellPath, useHomeDockChrome } from "@/components/home/HomeDockChromeContext";
import { subscribeSiteBrandingUpdated } from "@/lib/branding-broadcast";
import { getPublicRegisterUrl } from "@/lib/site-auth-links";
import { isSelahSuperAdminEmail } from "@/lib/selah-super-admin";

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

function IconClose(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const DRAWER_TRANSITION_MS = 300;

const drawerNavLinks: {
  href: string;
  labelKey: "nav.home" | "nav.music" | "nav.relax" | "nav.journey" | "nav.read" | "nav.prayer" | "nav.explore" | "nav.shellTemplate";
}[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/music", labelKey: "nav.music" },
  { href: "/relax", labelKey: "nav.relax" },
  { href: "/journey", labelKey: "nav.journey" },
  { href: "/read", labelKey: "nav.read" },
  { href: "/prayer", labelKey: "nav.prayer" },
  { href: "/explore", labelKey: "nav.explore" },
  { href: "/template", labelKey: "nav.shellTemplate" },
];

function shellPathActive(href: string, pathname: string): boolean {
  const p = pathname || "";
  if (href === "/") return p === "/" || p === "" || p === "/nature" || p.startsWith("/nature/");
  return p === href || p.startsWith(`${href}/`);
}

const EDGE_SWIPE_OPEN_PX = 56;
const EDGE_SWIPE_START_MAX_X = 28;

export type AppShellTopBarTone = "onDark" | "onLight";

type Props = {
  /** 深色底用 `onDark`，浅色底用 `onLight`（顶栏图标 hover 等） */
  tone?: AppShellTopBarTone;
  /** 顶栏右上（如自然页环境声静音）；未传时用占位保持与左侧按钮对称 */
  rightAccessory?: ReactNode;
  /**
   * 手机横屏沉浸：顶栏淡出且不可点；左缘窄条仍可滑开菜单（见同文件 edge strip）。
   */
  landscapeImmersive?: boolean;
};

/** 抽屉挂 `body`：须高于底栏 `z-20`，且低于 `AppShellModal`（`z-index: 100`）以便语言弹层在上 */
const NAV_DRAWER_PORTAL_Z = 80;

/**
 * 应用壳默认顶栏：左上打开 **Notion 式左侧全高抽屉**（主导航 + 语言）；抽屉经 Portal 叠在底栏之上。
 */
export function AppShellTopBar({
  tone = "onDark",
  rightAccessory = null,
  landscapeImmersive = false,
}: Props) {
  const pathname = usePathname() ?? "";
  const registerUrl = getPublicRegisterUrl();
  const registerExternal = Boolean(registerUrl && /^https?:\/\//i.test(registerUrl));
  const { t } = useLocale();
  const { bootstrapped, user, logout } = useAskbibleUser();
  const { shellTemplateBrand, setShellTemplateBrand } = useAppSkin();
  const { setDockChromeVisible } = useHomeDockChrome();
  const onLight = tone === "onLight";
  const iconBtn =
    HIT +
    (onLight ? " text-ink/85 hover:bg-ink/[0.06]" : " text-white/[0.9] hover:bg-white/[0.1]");
  const [navOpen, setNavOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [localePickerOpen, setLocalePickerOpen] = useState(false);
  /** 与 `/api/admin/branding` 一致：有资源时顶栏中央展示透明 LOGO */
  const [brandLogoSrc, setBrandLogoSrc] = useState<string | null>(null);
  const brandFetchAbortRef = useRef<AbortController | null>(null);
  const navEdgeStripRef = useRef<HTMLButtonElement>(null);
  const suppressNavEdgeClickRef = useRef(false);
  const edgeSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const drawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bodyPortalReady, setBodyPortalReady] = useState(false);

  useEffect(() => {
    setBodyPortalReady(true);
  }, []);

  const openNavMenu = useCallback(() => {
    setNavOpen(true);
  }, []);

  const toggleNavMenu = useCallback(() => {
    setNavOpen((o) => !o);
  }, []);

  const closeNavMenu = useCallback(() => {
    setNavOpen(false);
  }, []);

  useEffect(() => {
    if (navOpen) {
      if (drawerCloseTimerRef.current != null) {
        clearTimeout(drawerCloseTimerRef.current);
        drawerCloseTimerRef.current = null;
      }
      setDrawerVisible(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setDrawerEntered(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setDrawerEntered(false);
    drawerCloseTimerRef.current = setTimeout(() => {
      setDrawerVisible(false);
      drawerCloseTimerRef.current = null;
    }, DRAWER_TRANSITION_MS);
    return () => {
      if (drawerCloseTimerRef.current != null) {
        clearTimeout(drawerCloseTimerRef.current);
        drawerCloseTimerRef.current = null;
      }
    };
  }, [navOpen]);

  useEffect(() => {
    if (!drawerVisible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerVisible]);

  useEffect(() => {
    if (!drawerVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNavMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerVisible, closeNavMenu]);

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

  const openNav = () => {
    toggleNavMenu();
  };

  /** 顶栏下缘大致位置，左缘窄条从此向下延伸（与加大后的 pt + 44px 行对齐） */
  const edgeStripTopClass = "top-[calc(env(safe-area-inset-top,0px)+6.25rem)]";

  const drawerMotion = "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] motion-reduce:transition-none motion-reduce:duration-0";

  const linkRowBase =
    "flex w-full items-center rounded-md px-2.5 py-2.5 text-left text-[15px] font-normal leading-snug text-[#37352f] transition sm:py-2 sm:text-[14px]";
  const linkRowIdle = "hover:bg-black/[0.06] active:bg-black/[0.08]";
  const linkRowActive = "bg-black/[0.07] font-medium";

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
      <header
        className={[
          "pointer-events-none absolute inset-x-0 top-0 z-[50] px-4 pt-[max(2.125rem,calc(env(safe-area-inset-top,0px)+1.5rem))] pb-1.5 transition-opacity duration-300 motion-reduce:transition-none sm:px-5 sm:pt-[max(2.375rem,calc(env(safe-area-inset-top,0px)+1.75rem))] sm:pb-2",
          landscapeImmersive
            ? "opacity-0 [&_.pointer-events-auto]:pointer-events-none"
            : "opacity-100",
        ].join(" ")}
        aria-hidden={landscapeImmersive ? true : undefined}
        inert={landscapeImmersive ? true : undefined}
      >
        <div className="grid w-full min-h-[44px] grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="pointer-events-auto relative justify-self-start">
            <button
              type="button"
              onClick={openNav}
              aria-label={navOpen ? t("chrome.closeNavMenu") : t("chrome.openNavMenu")}
              aria-expanded={navOpen}
              aria-haspopup="dialog"
              aria-controls="app-shell-nav-drawer"
              className={iconBtn}
            >
              <IconMenu className="h-3 w-[1.125rem] opacity-90" />
            </button>
          </div>

          <div className="pointer-events-auto flex min-w-0 max-w-[min(52vw,14rem)] justify-center justify-self-center">
            {brandLogoSrc ? (
              <Link
                href="/"
                className="flex h-11 max-h-[44px] items-center py-1"
                aria-label={t("nav.home")}
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

          <div className="pointer-events-auto relative z-[55] isolate flex touch-manipulation justify-end justify-self-end">
            {rightAccessory ?? <span className="h-11 w-11 shrink-0" aria-hidden />}
          </div>
        </div>
      </header>

      {bodyPortalReady && drawerVisible
        ? createPortal(
            <div
              className="fixed inset-0 flex"
              style={{ zIndex: NAV_DRAWER_PORTAL_Z }}
              role="presentation"
              aria-hidden={!navOpen && !drawerEntered ? true : undefined}
            >
              <button
                type="button"
                aria-label={t("chrome.closeNavMenu")}
                className={[
                  "absolute inset-0 border-0 bg-black/40 backdrop-blur-[1px] transition-opacity",
                  drawerMotion,
                  drawerEntered ? "opacity-100" : "opacity-0",
                ].join(" ")}
                onClick={closeNavMenu}
              />
              <aside
                id="app-shell-nav-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={t("nav.mainLabel")}
                className={[
                  "absolute bottom-0 left-0 top-0 flex w-[min(22rem,calc(100vw-12px))] min-h-0 flex-col border-r border-neutral-200/90 bg-[#f7f6f3] shadow-[4px_0_32px_-12px_rgba(0,0,0,0.18)]",
                  drawerMotion,
                  drawerEntered ? "translate-x-0 opacity-100" : "-translate-x-[102%] opacity-100",
                  "pt-[max(0.5rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-2",
                ].join(" ")}
              >
                <div className="flex shrink-0 items-center justify-between gap-2 pb-2 pl-0.5 pr-0.5 pt-1">
                  <h2 className="min-w-0 truncate text-[13px] font-semibold uppercase tracking-[0.06em] text-[#37352f]/55">
                    {t("nav.mainLabel")}
                  </h2>
                  <button
                    type="button"
                    onClick={closeNavMenu}
                    aria-label={t("chrome.closeNavMenu")}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[#37352f]/80 transition hover:bg-black/[0.06] active:bg-black/[0.08]"
                  >
                    <IconClose className="h-5 w-5" />
                  </button>
                </div>
                <nav className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] py-1 pr-0.5">
                  <div className="flex flex-col gap-0.5">
                    {drawerNavLinks.map(({ href, labelKey }) => {
                      const active = shellPathActive(href, pathname);
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={[linkRowBase, active ? linkRowActive : linkRowIdle].join(" ")}
                          aria-current={active ? "page" : undefined}
                          onClick={() => {
                            closeNavMenu();
                            if (href === "/" && isNatureHomeShellPath(pathname)) {
                              setDockChromeVisible(true);
                            }
                          }}
                        >
                          {t(labelKey)}
                        </Link>
                      );
                    })}
                    <div className="mt-1.5 border-t border-neutral-200/90 pt-2">
                      <span className="sr-only">{t("nav.themeColorsHeading")}</span>
                      <p className="sr-only">{t("nav.themeColorsHint")}</p>
                      <ShellTemplateThemeStrip
                        variant="drawer"
                        selectedId={shellTemplateBrand}
                        onPick={(id) => {
                          setShellTemplateBrand(id);
                          closeNavMenu();
                        }}
                      />
                      <button
                        type="button"
                        className={[
                          linkRowBase,
                          linkRowIdle,
                          "mt-2 text-[13px] text-[#37352f]/80",
                          shellTemplateBrand == null ? linkRowActive : "",
                        ].join(" ")}
                        aria-pressed={shellTemplateBrand == null}
                        onClick={() => {
                          setShellTemplateBrand(null);
                          closeNavMenu();
                        }}
                      >
                        {t("nav.themeColorsFollowSite")}
                      </button>
                    </div>
                    {bootstrapped ? (
                      user ? (
                        <div className="mt-1 border-t border-neutral-200/90 pt-3">
                          <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#37352f]/45">
                            {t("auth.drawerSignedIn")}
                          </p>
                          <p className="truncate px-2.5 pb-2 text-[13px] text-[#37352f]/80" title={user.email}>
                            {user.name !== user.email ? user.name : user.email}
                          </p>
                          <button
                            type="button"
                            className={[linkRowBase, linkRowIdle, "text-[#37352f]/85"].join(" ")}
                            onClick={() => {
                              closeNavMenu();
                              void logout();
                            }}
                          >
                            {t("auth.drawerLogout")}
                          </button>
                          {isSelahSuperAdminEmail(user.email) ? (
                            <Link
                              href="/admin"
                              className={[linkRowBase, linkRowIdle, "text-[#37352f]/85"].join(" ")}
                              onClick={() => closeNavMenu()}
                            >
                              {t("auth.drawerAdmin")}
                            </Link>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-1 space-y-0.5 border-t border-neutral-200/90 pt-3">
                          <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#37352f]/45">
                            {t("auth.drawerAccount")}
                          </p>
                          <Link
                            href="/login"
                            className={[linkRowBase, linkRowIdle, "text-[#37352f]/85"].join(" ")}
                            onClick={() => closeNavMenu()}
                          >
                            {t("auth.drawerLogin")}
                          </Link>
                          {registerExternal && registerUrl ? (
                            <a
                              href={registerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={[linkRowBase, linkRowIdle, "text-[#37352f]/85"].join(" ")}
                              onClick={() => closeNavMenu()}
                            >
                              {t("auth.drawerRegister")}
                            </a>
                          ) : (
                            <Link
                              href="/register"
                              className={[linkRowBase, linkRowIdle, "text-[#37352f]/85"].join(" ")}
                              onClick={() => closeNavMenu()}
                            >
                              {t("auth.drawerRegister")}
                            </Link>
                          )}
                        </div>
                      )
                    ) : null}
                    <button
                      type="button"
                      className={[linkRowBase, linkRowIdle, "mt-1 border-t border-neutral-200/90 pt-3"].join(" ")}
                      onClick={() => {
                        closeNavMenu();
                        setLocalePickerOpen(true);
                      }}
                    >
                      {t("nav.language")}
                    </button>
                  </div>
                </nav>
              </aside>
            </div>,
            document.body,
          )
        : null}

      <LocalePickerModal open={localePickerOpen} onDismiss={() => setLocalePickerOpen(false)} />
    </>
  );
}
