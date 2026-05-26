"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReadChapterActionChrome } from "@/components/bible/ReadChapterActionChrome";
import { ScriptureAudioDockStrip } from "@/components/bible/ScriptureAudioDockStrip";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import { trackTap } from "@/lib/telemetry/tap";
import { trackTelemetry } from "@/lib/telemetry/client";
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

function IconMusic(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M14 5.5v9.1a2.7 2.7 0 1 1-1.5-2.42V8.4l6-1.4v6.1a2.7 2.7 0 1 1-1.5-2.42V5.5L14 6.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconRead(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M12 5.25v13.5M12 5.25c-2.1-1.1-4.6-.9-6.75.65V18.6c2.15-1.35 4.65-1.55 6.75-.35M12 5.25c2.1-1.1 4.6-.9 6.75.65V18.6c-2.15-1.35-4.65-1.55-6.75-.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconExplore(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="m12 5 7 3-7 11L5 8l7-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const homeItem: NavItemDef = {
  href: "/",
  labelKey: "nav.home",
  match: (p) => p === "/" || p === "" || p === "/nature" || p.startsWith("/nature/"),
  Icon: IconHome,
};

const musicItem: NavItemDef = {
  href: "/music",
  labelKey: "nav.music",
  match: (p) => p === "/music" || p.startsWith("/music/"),
  Icon: IconMusic,
};

const readItem: NavItemDef = {
  href: "/read",
  labelKey: "nav.read",
  match: (p) => p === "/read" || p.startsWith("/read/"),
  Icon: IconRead,
};

const exploreItem: NavItemDef = {
  href: "/explore",
  labelKey: "nav.explore",
  match: (p) => p === "/explore" || p.startsWith("/explore/"),
  Icon: IconExplore,
};

function shellHref(path: string, shellRoot: string): string {
  if (!shellRoot) return path;
  if (path === "/") return shellRoot;
  return `${shellRoot}${path}`;
}

function buildNavItems(shellRoot: string): { left: NavItemDef[]; right: NavItemDef[] } {
  const home: NavItemDef = {
    href: shellHref("/", shellRoot),
    labelKey: "nav.home",
    match: shellRoot
      ? (p) => p === shellRoot || p === `${shellRoot}/`
      : homeItem.match,
    Icon: IconHome,
  };
  const music: NavItemDef = {
    href: shellHref("/music", shellRoot),
    labelKey: "nav.music",
    match: shellRoot
      ? (p) => p === `${shellRoot}/music` || p.startsWith(`${shellRoot}/music/`)
      : musicItem.match,
    Icon: IconMusic,
  };
  const read: NavItemDef = {
    href: shellHref("/read", shellRoot),
    labelKey: "nav.read",
    match: shellRoot
      ? (p) => p === `${shellRoot}/read` || p.startsWith(`${shellRoot}/read/`)
      : readItem.match,
    Icon: IconRead,
  };
  const explore: NavItemDef = {
    href: shellHref("/explore", shellRoot),
    labelKey: "nav.explore",
    match: shellRoot
      ? (p) => p.startsWith(`${shellRoot}/explore`)
      : exploreItem.match,
    Icon: IconExplore,
  };
  return { left: [home, music], right: [read, explore] };
}

function iconLinkClass(active: boolean) {
  return [
    "flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-full transition active:scale-[0.97] sm:min-h-[44px] sm:min-w-[44px]",
    // 浅色底上仍可辨认：双层深色 drop-shadow（对 SVG 描边生效）
    "drop-shadow-[0_1px_2px_rgba(0,0,0,0.62)] drop-shadow-[0_0_12px_rgba(0,0,0,0.32)]",
    active
      ? "text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.72),0_0_1px_rgba(0,0,0,0.85)]"
      : "text-white/60 hover:text-white/95 [text-shadow:0_1px_10px_rgba(0,0,0,0.55),0_0_1px_rgba(0,0,0,0.8)]",
  ].join(" ");
}

type Placement = "fixedShell" | "videoStage";

type Props = { placement: Placement; /** 电视壳：`/tv` */ shellRoot?: string };

/**
 * 原底栏路由 + 壳层播放：图标条，可叠在视频上（`videoStage`）或全局 fixed（其它页）。
 */
export function HomeShellFloatingRouteNav({ placement, shellRoot = "" }: Props) {
  const pathname = usePathname() ?? "";
  const { t } = useLocale();
  const { canPlayMusic, playing, effectiveSrc, togglePlayMusic } = useMusicShellPlayback();
  const musicActive = playing && !isCuvChapterAudioEffectiveSrc(effectiveSrc);
  const { left: navLeft, right: navRight } = buildNavItems(shellRoot);

  const outer =
    placement === "fixedShell"
      ? "home-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center justify-end gap-1 px-3 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] pt-0"
      : "pointer-events-none absolute inset-x-0 bottom-0 z-[18] flex flex-col items-center justify-end gap-1 px-3 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] pt-0";

  const navTapTarget = (item: NavItemDef): void => {
    if (item.labelKey === "nav.home") trackTelemetry("tab_select", { tab: "home" });
    else if (item.labelKey === "nav.music") trackTelemetry("tab_select", { tab: "music" });
    else if (item.labelKey === "nav.read") {
      trackTelemetry("tab_select", { tab: "read" });
      trackTap("read.catalog");
    } else if (item.labelKey === "nav.explore") {
      trackTelemetry("tab_select", { tab: "explore" });
      trackTap("explore.open");
    }
  };

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
        onClick={() => navTapTarget(item)}
      >
        <Icon className="h-6 w-6 sm:h-7 sm:w-7" />
      </Link>
    );
  };

  return (
    <div className={outer}>
      <ScriptureAudioDockStrip placement={placement} />
      <ReadChapterActionChrome />
      <nav
        className="pointer-events-auto flex min-w-0 max-w-[min(100%,var(--read-parchment-column-max,28rem))] items-center justify-center gap-1 rounded-full border-0 bg-transparent px-1.5 py-1 sm:gap-1.5 sm:px-2.5 sm:py-1.5"
        aria-label={t("nav.mainLabel")}
      >
        <div className="flex items-center gap-0.5 sm:gap-1">{navLeft.map(renderIconLink)}</div>

        <button
          type="button"
          disabled={!canPlayMusic}
          aria-label={
            !canPlayMusic
              ? t("playback.noTrack")
              : musicActive
                ? t("playback.pauseMusic")
                : t("playback.playMusic")
          }
          onClick={() => void togglePlayMusic()}
          className="mx-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-0 bg-white/[0.07] transition hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75 disabled:pointer-events-none disabled:opacity-35 sm:h-12 sm:w-12"
        >
          <span className="flex items-center justify-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
            {musicActive ? (
              <IconPause className="h-[18px] w-[18px] shrink-0 sm:h-5 sm:w-5" />
            ) : (
              <IconPlay className="h-[18px] w-[18px] shrink-0 translate-x-[0.5px] sm:h-5 sm:w-5" />
            )}
          </span>
        </button>

        <div className="flex items-center gap-0.5 sm:gap-1">{navRight.map(renderIconLink)}</div>
      </nav>
    </div>
  );
}
