"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useAppSkin } from "@/components/theme/AppSkinProvider";
import { ShellTemplateThemeStrip } from "@/components/shell/ShellTemplateThemeStrip";
import { LocalePickerModal } from "@/components/i18n/LocalePickerModal";
import { isNatureHomeShellPath } from "@/components/home/HomeDockChromeContext";
import { getPublicRegisterUrl } from "@/lib/site-auth-links";
import { isSelahSuperAdminEmail } from "@/lib/selah-super-admin";
import { useShellInsetClockEnvironment } from "@/hooks/useShellInsetClockEnvironment";
import { HomePrayerVerseDockSettings } from "@/components/home/HomePrayerVerseDockSettings";

/** 常规手机最小触控约 44×44（iOS HIG / Material）；壳层角标按钮统一此尺寸 */
const HIT = "flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97]";

function formatShellInsetTime(d: Date) {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isRelaxShellPath(pathname: string) {
  const p = pathname || "";
  return p === "/relax" || p.startsWith("/relax/");
}

function TopShellInsetTime({
  visible,
  tone,
  pathname,
}: {
  visible: boolean;
  tone: AppShellTopBarTone;
  pathname: string;
}) {
  const timeRef = useRef<HTMLTimeElement>(null);
  const relaxRoute = isRelaxShellPath(pathname);
  /** 自然首页：横屏时底区有 `videoStage` 底栏与经文，壳层时钟改顶对齐 safe-area，避免被叠住 */
  const natureHomeShell = isNatureHomeShellPath(pathname);

  useLayoutEffect(() => {
    if (!visible) return;
    const el = timeRef.current;
    if (!el) return;
    const apply = () => {
      const d = new Date();
      el.dateTime = d.toISOString();
      el.textContent = formatShellInsetTime(d);
    };
    apply();

    let intervalId: number | undefined;
    const msToNextMinute = 60000 - (Date.now() % 60000) + 50;
    const kick = window.setTimeout(() => {
      apply();
      intervalId = window.setInterval(apply, 60000);
    }, msToNextMinute);

    return () => {
      window.clearTimeout(kick);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [visible]);

  if (!visible) return null;

  const onLight = tone === "onLight";

  /** 自然首页横屏：底栏与经文叠在下半屏，`bottom` 易被挡住；顶栏位与竖屏一致、不占主视觉中部 */
  const landscapeNatureTime =
    "landscape:bottom-auto landscape:top-[calc(env(safe-area-inset-top,0px)+0.35rem)] landscape:text-[clamp(0.9375rem,3.4vmin,1.125rem)] landscape:tracking-[0.05em] landscape:sm:text-[clamp(1rem,3.2vmin,1.1875rem)]";

  /**
   * 横屏且时间落在底部时：抬高到 **底栏浮条之上**（与 `NatureVideoExperience` 底区 hint 的留白同量级），
   * 避免与 `HomeShellFloatingRouteNav`（播放钮约 52px + safe-area）叠住。
   */
  const landscapeTimeAboveBottomNav =
    "landscape:bottom-[max(5.25rem,calc(env(safe-area-inset-bottom,0px)+4.75rem))] landscape:top-auto";

  return (
    <time
      ref={timeRef}
      className={[
        "pointer-events-none fixed left-1/2 z-[52] -translate-x-1/2 select-none font-medium tabular-nums portrait:opacity-100",
        relaxRoute ? "landscape:opacity-95" : natureHomeShell ? "landscape:opacity-100" : "landscape:opacity-50",
        "text-[14px] tracking-[0.04em] sm:text-[15px] sm:tracking-[0.05em]",
        "portrait:top-[calc(env(safe-area-inset-top,0px)+0.2rem)] portrait:bottom-auto portrait:translate-y-0",
        "landscape:translate-y-0",
        relaxRoute
          ? `${landscapeTimeAboveBottomNav} landscape:text-[clamp(1.125rem,3.8vmin,1.375rem)] landscape:tracking-[0.05em] landscape:sm:text-[clamp(1.1875rem,3.6vmin,1.4375rem)]`
          : natureHomeShell
            ? landscapeNatureTime
            : `${landscapeTimeAboveBottomNav} landscape:text-[28px] landscape:tracking-[0.06em] landscape:sm:text-[30px] landscape:sm:tracking-[0.07em]`,
        onLight ? "text-ink" : "text-white",
      ].join(" ")}
    />
  );
}

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
  labelKey: "nav.music" | "nav.shellTemplate";
}[] = [
  { href: "/music", labelKey: "nav.music" },
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
  /** 深色底用 `onDark`，浅色底用 `onLight`（角标图标 hover 等） */
  tone?: AppShellTopBarTone;
  /** 右上槽（如自然页静音）；不传则仅显示菜单 */
  rightAccessory?: ReactNode;
  /**
   * 手机横屏沉浸：角标淡出且不可点；左缘窄条仍可滑开菜单（见同文件 edge strip）。
   */
  landscapeImmersive?: boolean;
  /**
   * 与 `landscapeImmersive` 无关：在状态栏附近显示壳层时间（如自然页横屏有主视频时）。
   */
  showTopInsetTime?: boolean;
  /**
   * 为 true 时不渲染壳层时间（覆盖 PWA 全屏等 `useShellInsetClockEnvironment`、以及 `showTopInsetTime` / `landscapeImmersive`）。
   * 用于 `/scenes` 等不希望出现大号叠层时钟的页面。
   */
  hideTopShellInsetTime?: boolean;
};

/** 抽屉挂 `body`：须高于底栏 `z-20`，且低于 `AppShellModal`（`z-index: 100`）以便语言弹层在上 */
const NAV_DRAWER_PORTAL_Z = 80;

/**
 * 应用壳角标式浮动控制：左上打开 **Notion 式左侧全高抽屉**（主导航 + 语言）；抽屉经 Portal 叠在底栏之上。无整行顶栏。
 */
export function AppShellTopBar({
  tone = "onDark",
  rightAccessory = null,
  landscapeImmersive = false,
  showTopInsetTime = false,
  hideTopShellInsetTime = false,
}: Props) {
  const pathname = usePathname() ?? "";
  const insetClockEnv = useShellInsetClockEnvironment();
  const showTopShellTime =
    !hideTopShellInsetTime && (insetClockEnv || landscapeImmersive || showTopInsetTime);
  const registerUrl = getPublicRegisterUrl();
  const registerExternal = Boolean(registerUrl && /^https?:\/\//i.test(registerUrl));
  const { t } = useLocale();
  const { bootstrapped, user, isAdmin, logout } = useAskbibleUser();
  const { shellTemplateBrand, setShellTemplateBrand } = useAppSkin();
  const onLight = tone === "onLight";
  const iconBtn =
    HIT +
    (onLight ? " text-ink/85 hover:bg-ink/[0.06]" : " text-white/[0.9] hover:bg-white/[0.1]");
  const [navOpen, setNavOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [localePickerOpen, setLocalePickerOpen] = useState(false);
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

  const openNav = () => {
    toggleNavMenu();
  };

  /** 角标区下缘大致位置，左缘窄条从此向下延伸（safe-area + ~44px 菜单行 + 少量空隙） */
  const edgeStripTopClass = "top-[calc(env(safe-area-inset-top,0px)+3.75rem)]";

  const drawerMotion = "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] motion-reduce:transition-none motion-reduce:duration-0";

  const linkRowBase =
    "flex w-full items-center rounded-md px-2.5 py-2.5 text-left text-[15px] font-normal leading-snug text-[#37352f] transition sm:py-2 sm:text-[14px]";
  const linkRowIdle = "hover:bg-black/[0.06] active:bg-black/[0.08]";
  const linkRowActive = "bg-black/[0.07] font-medium";

  return (
    <>
      <TopShellInsetTime visible={showTopShellTime} tone={tone} pathname={pathname} />
      <button
        type="button"
        ref={navEdgeStripRef}
        tabIndex={-1}
        aria-hidden
        className={`fixed bottom-[max(5.25rem,calc(env(safe-area-inset-bottom,0px)+4.5rem))] left-0 z-[48] w-6 min-w-[1.25rem] cursor-pointer border-0 bg-transparent py-0 pl-[env(safe-area-inset-left)] pr-0 outline-none ${edgeStripTopClass}`}
        onClick={() => {
          if (suppressNavEdgeClickRef.current) {
            suppressNavEdgeClickRef.current = false;
            return;
          }
          toggleNavMenu();
        }}
      />
      <div
        className={[
          "pointer-events-none fixed inset-x-0 top-0 z-[50] flex items-start justify-between gap-2 pt-[max(0.35rem,env(safe-area-inset-top,0px))] pl-[max(0.35rem,env(safe-area-inset-left,0px))] pr-[max(0.35rem,env(safe-area-inset-right,0px))] transition-opacity duration-300 motion-reduce:transition-none",
          landscapeImmersive
            ? "opacity-0 [&_.chrome-float-hit]:pointer-events-none"
            : "opacity-100",
        ].join(" ")}
        aria-hidden={landscapeImmersive ? true : undefined}
        inert={landscapeImmersive ? true : undefined}
      >
        <div className="chrome-float-hit pointer-events-auto">
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
        <div className="chrome-float-hit pointer-events-auto flex flex-col items-end gap-2">{rightAccessory}</div>
      </div>

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
                          }}
                        >
                          {t(labelKey)}
                        </Link>
                      );
                    })}
                    <div className="mt-1.5 border-t border-neutral-200/90 pt-2">
                      <HomePrayerVerseDockSettings
                        placement="drawer"
                        drawerOpen={navOpen && drawerEntered}
                        sections={["translation"]}
                      />
                    </div>
                    {bootstrapped && isAdmin ? (
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
                    ) : null}
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
