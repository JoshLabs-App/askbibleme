"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LocaleTrigger } from "@/components/i18n/LocaleTrigger";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AppSkinTrigger } from "@/components/theme/AppSkinTrigger";

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

function IconUserAvatar(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

const navLinks: { href: string; labelKey: string }[] = [
  { href: "/journey", labelKey: "nav.journey" },
  { href: "/read", labelKey: "nav.read" },
  { href: "/explore", labelKey: "nav.explore" },
];

const menuSurface =
  "min-w-[10rem] rounded-xl border border-white/[0.12] bg-black/45 py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl";

const menuItem =
  "block px-3 py-2 text-[13px] font-normal text-white/[0.92] transition hover:bg-white/[0.06]";

const menuSectionTitle =
  "select-none px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/40";

/**
 * 音乐首页顶栏：左上三横菜单、右上用户菜单；绝对定位浮在内容之上。
 */
export function HomeMusicFloatingChrome() {
  const pathname = usePathname() ?? "";
  const { t } = useLocale();
  const [navOpen, setNavOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navOpen && !userOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (navRef.current?.contains(target)) return;
      if (userRef.current?.contains(target)) return;
      setNavOpen(false);
      setUserOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNavOpen(false);
        setUserOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [navOpen, userOpen]);

  const openNav = () => {
    setNavOpen((o) => !o);
    setUserOpen(false);
  };

  const openUser = () => {
    setUserOpen((o) => !o);
    setNavOpen(false);
  };

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-[50] px-4 pt-[max(0.35rem,env(safe-area-inset-top))] sm:px-5 lg:px-9 lg:pt-[max(0.6rem,env(safe-area-inset-top))]">
      <div className="flex w-full items-start justify-between">
        <div className="pointer-events-auto relative" ref={navRef}>
          <button
            type="button"
            onClick={openNav}
            aria-label={navOpen ? t("chrome.closeNavMenu") : t("chrome.openNavMenu")}
            aria-expanded={navOpen}
            aria-haspopup="menu"
            aria-controls="home-music-nav-menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/[0.88] transition hover:bg-white/[0.08] active:scale-[0.97]"
          >
            <IconMenu className="h-[11px] w-[0.88rem] opacity-90" />
          </button>
          {navOpen ? (
            <div
              id="home-music-nav-menu"
              role="menu"
              className={`absolute left-0 top-[calc(100%+0.3rem)] z-[60] ${menuSurface}`}
            >
              {pathname !== "/" && pathname !== "" ? (
                <Link
                  href="/"
                  role="menuitem"
                  className={menuItem}
                  onClick={() => setNavOpen(false)}
                >
                  {t("chrome.backHome")}
                </Link>
              ) : null}
              {navLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className={menuItem}
                  onClick={() => setNavOpen(false)}
                >
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="pointer-events-auto relative" ref={userRef}>
          <button
            type="button"
            onClick={openUser}
            aria-label={userOpen ? t("chrome.closeUserMenu") : t("chrome.openUserMenu")}
            aria-expanded={userOpen}
            aria-haspopup="menu"
            aria-controls="home-music-user-menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/[0.88] transition hover:bg-white/[0.08] active:scale-[0.97]"
          >
            <IconUserAvatar className="h-[14px] w-[14px] opacity-[0.88]" />
          </button>
          {userOpen ? (
            <div
              id="home-music-user-menu"
              role="menu"
              aria-label={t("chrome.userMenuAria")}
              className={`absolute right-0 top-[calc(100%+0.3rem)] z-[60] ${menuSurface}`}
            >
              <p className={menuSectionTitle}>{t("chrome.personalSettings")}</p>
              <LocaleTrigger>
                {(openLocale) => (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${menuItem} w-full text-left`}
                    onClick={() => {
                      setUserOpen(false);
                      openLocale();
                    }}
                  >
                    {t("nav.language")}
                  </button>
                )}
              </LocaleTrigger>
              <AppSkinTrigger>
                {(openSkin) => (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${menuItem} w-full text-left`}
                    onClick={() => {
                      setUserOpen(false);
                      openSkin();
                    }}
                  >
                    {t("nav.appearance")}
                  </button>
                )}
              </AppSkinTrigger>
              <p className={menuSectionTitle}>{t("chrome.adminToolsSection")}</p>
              <Link
                href="/admin"
                role="menuitem"
                className={menuItem}
                onClick={() => setUserOpen(false)}
              >
                {t("chrome.adminHome")}
              </Link>
              <Link
                href="/admin/studio"
                role="menuitem"
                className={menuItem}
                onClick={() => setUserOpen(false)}
              >
                {t("chrome.studioInternal")}
              </Link>
              <Link
                href="/admin/music"
                role="menuitem"
                className={menuItem}
                onClick={() => setUserOpen(false)}
              >
                {t("chrome.musicAdmin")}
              </Link>
              <Link
                href="/admin/visual"
                role="menuitem"
                className={menuItem}
                onClick={() => setUserOpen(false)}
              >
                {t("chrome.playbackVisual")}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
