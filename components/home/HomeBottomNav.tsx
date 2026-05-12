"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useHomeDockChrome } from "@/components/home/HomeDockChromeContext";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";
import {
  IconNavExplore,
  IconNavHome,
  IconNavJourney,
  IconNavRead,
  type NavTabIconProps,
} from "@/components/ui/NavTabIcons";
import { HOME_DOCK_NAV_BG } from "@/lib/shell/home-dock-nav-bg";

const itemDefs: {
  href: string;
  labelKey: string;
  Icon: ComponentType<NavTabIconProps>;
  match: (p: string) => boolean;
}[] = [
  { href: "/", labelKey: "nav.home", Icon: IconNavHome, match: (p) => p === "/" || p === "" || p === "/nature" },
  { href: "/journey", labelKey: "nav.journey", Icon: IconNavJourney, match: (p) => p.startsWith("/journey") },
  { href: "/read", labelKey: "nav.read", Icon: IconNavRead, match: (p) => p.startsWith("/read") },
  { href: "/explore", labelKey: "nav.explore", Icon: IconNavExplore, match: (p) => p.startsWith("/explore") },
];

function navLinkClass(active: boolean) {
  const base =
    "flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center justify-center px-0.5 py-0 text-[10px] font-medium leading-tight tracking-wide transition sm:px-0.5 sm:text-[11px]";
  return [
    base,
    active
      ? "text-white"
      : "text-white/45 hover:text-white/75",
  ].join(" ");
}

const navItemInnerClass =
  "flex max-w-full min-w-0 flex-col items-center justify-center gap-0.5 leading-tight sm:gap-0.5";

/** 置于 shell 底部列（非 fixed），由父级 `fixed inset-0 + flex` 保证始终在视口内。 */
export function HomeBottomNav() {
  const pathname = usePathname() ?? "";
  const { t } = useLocale();
  const { setDockChromeVisible } = useHomeDockChrome();
  const { canPlay, playing, togglePlay } = useMusicShellPlayback();
  if (pathname.startsWith("/admin")) return null;

  /** 同一路径再点「首页」时 pathname 不变，须显式展开底区，否则场景卡仍处收起态 */
  const onHomeNavClick = () => {
    setDockChromeVisible(true);
  };

  return (
    <nav
      className="home-bottom-nav relative z-20 flex h-[70px] min-h-[70px] w-full min-w-0 max-w-full shrink-0 flex-col overflow-x-hidden overflow-y-hidden box-border pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] pt-1"
      style={{ backgroundColor: HOME_DOCK_NAV_BG }}
      aria-label={t("nav.mainLabel")}
    >
      <div className="flex min-h-0 w-full min-w-0 max-w-full flex-1 items-stretch px-0.5 sm:px-1">
        {itemDefs.slice(0, 2).map((def) => {
          const active = def.match(pathname);
          const Icon = def.Icon;
          return (
            <Link
              key={def.href}
              href={def.href}
              aria-current={active ? "page" : undefined}
              className={navLinkClass(active)}
              onClick={def.href === "/" ? onHomeNavClick : undefined}
            >
              <span className={navItemInnerClass}>
                <Icon className="h-4 w-4 shrink-0 sm:h-[1.05rem] sm:w-[1.05rem]" />
                <span className="max-w-full truncate text-center">{t(def.labelKey)}</span>
              </span>
            </Link>
          );
        })}

        <div className="music-reactive-play-btn flex min-w-0 flex-1 basis-0 items-center justify-center">
          <button
            type="button"
            disabled={!canPlay}
            aria-label={
              !canPlay ? t("playback.noTrack") : playing ? t("playback.pauseMusic") : t("playback.playMusic")
            }
            onClick={() => togglePlay()}
            style={{ backgroundColor: "rgba(255,255,255,0.94)", color: HOME_DOCK_NAV_BG }}
            className="music-reactive-play-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-white/40 transition hover:bg-white hover:ring-white/55 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-35"
          >
            {playing ? (
              <IconPause className="h-4 w-4 shrink-0" />
            ) : (
              <IconPlay className="h-4 w-4 shrink-0 translate-x-[1px]" />
            )}
          </button>
        </div>

        {itemDefs.slice(2, 4).map((def) => {
          const active = def.match(pathname);
          const Icon = def.Icon;
          return (
            <Link
              key={def.href}
              href={def.href}
              aria-current={active ? "page" : undefined}
              className={navLinkClass(active)}
            >
              <span className={navItemInnerClass}>
                <Icon className="h-4 w-4 shrink-0 sm:h-[1.05rem] sm:w-[1.05rem]" />
                <span className="max-w-full truncate text-center">{t(def.labelKey)}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
