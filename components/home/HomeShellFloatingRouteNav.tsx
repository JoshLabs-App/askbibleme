"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useHomeDockChrome } from "@/components/home/HomeDockChromeContext";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";

type NavItemDef = {
  href: string;
  labelKey: string;
  match: (p: string) => boolean;
  Icon: (p: { className?: string }) => ReactElement;
};

function IconHome(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRelax(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M4 14c2.5 2 6.5 2 9-1s3.5-6 1-8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11 19c2.5-1.5 4-4.5 3-8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

function IconVerse(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M7 4h10a1 1 0 0 1 1 1v14l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 9h6M9 12h4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function IconPrayer(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M12 5c-2.5 2.5-4 5-4 7.5a4 4 0 0 0 8 0c0-2.5-1.5-5-4-7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 22V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const homeItem: NavItemDef = {
  href: "/",
  labelKey: "nav.home",
  match: (p) => p === "/" || p === "" || p === "/nature" || p.startsWith("/nature/"),
  Icon: IconHome,
};

const relaxItem: NavItemDef = {
  href: "/relax",
  labelKey: "nav.relax",
  match: (p) => p === "/relax" || p.startsWith("/relax/"),
  Icon: IconRelax,
};

const goldenVersesItem: NavItemDef = {
  href: "/verse",
  labelKey: "nav.goldenVerses",
  match: (p) => p === "/verse" || p.startsWith("/verse/"),
  Icon: IconVerse,
};

const prayerItem: NavItemDef = {
  href: "/prayer",
  labelKey: "nav.prayer",
  match: (p) => p.startsWith("/prayer"),
  Icon: IconPrayer,
};

const navLeft: NavItemDef[] = [homeItem, relaxItem];
const navRight: NavItemDef[] = [goldenVersesItem, prayerItem];

function iconLinkClass(active: boolean) {
  return [
    "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97]",
    // 浅色底上仍可辨认：双层深色 drop-shadow（对 SVG 描边生效）
    "drop-shadow-[0_1px_2px_rgba(0,0,0,0.62)] drop-shadow-[0_0_12px_rgba(0,0,0,0.32)]",
    active
      ? "text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.72),0_0_1px_rgba(0,0,0,0.85)]"
      : "text-white/60 hover:text-white/95 [text-shadow:0_1px_10px_rgba(0,0,0,0.55),0_0_1px_rgba(0,0,0,0.8)]",
  ].join(" ");
}

type Placement = "fixedShell" | "videoStage";

type Props = { placement: Placement };

/**
 * 原底栏路由 + 壳层播放：图标条，可叠在视频上（`videoStage`）或全局 fixed（其它页）。
 */
export function HomeShellFloatingRouteNav({ placement }: Props) {
  const pathname = usePathname() ?? "";
  const { t } = useLocale();
  const { peekDockChrome } = useHomeDockChrome();
  const { canPlay, playing, togglePlay } = useMusicShellPlayback();

  const onHomeNavClick = () => {
    peekDockChrome();
  };

  const outer =
    placement === "fixedShell"
      ? "home-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-0"
      : "pointer-events-none absolute inset-x-0 bottom-0 z-[18] flex justify-center px-3 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-0";

  const renderIconLink = (item: NavItemDef) => {
    const active = item.match(pathname);
    const Icon = item.Icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={t(item.labelKey)}
        aria-current={active ? "page" : undefined}
        aria-label={t(item.labelKey)}
        className={iconLinkClass(active)}
        onClick={item === homeItem ? onHomeNavClick : undefined}
      >
        <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
      </Link>
    );
  };

  return (
    <div className={outer}>
      <nav
        className="pointer-events-auto flex min-w-0 max-w-[min(100%,24rem)] items-center justify-center gap-2 sm:max-w-md sm:gap-3"
        aria-label={t("nav.mainLabel")}
      >
        <div className="flex items-center gap-1 sm:gap-1.5">{navLeft.map(renderIconLink)}</div>

        <button
          type="button"
          disabled={!canPlay}
          aria-label={
            !canPlay ? t("playback.noTrack") : playing ? t("playback.pauseMusic") : t("playback.playMusic")
          }
          onClick={() => togglePlay()}
          className="mx-0.5 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-white/90 bg-transparent shadow-[0_3px_18px_-5px_rgba(0,0,0,0.5)] transition hover:border-white hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 disabled:pointer-events-none disabled:opacity-35"
        >
          <span className="flex items-center justify-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            {playing ? (
              <IconPause className="h-[22px] w-[22px] shrink-0" />
            ) : (
              <IconPlay className="h-[22px] w-[22px] shrink-0 translate-x-[0.5px]" />
            )}
          </span>
        </button>

        <div className="flex items-center gap-1 sm:gap-1.5">{navRight.map(renderIconLink)}</div>
      </nav>
    </div>
  );
}
