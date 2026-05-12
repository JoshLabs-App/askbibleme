"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useHomeDockChrome } from "@/components/home/HomeDockChromeContext";
import { useShellTemplateDockPreviewOptional } from "@/components/shell/ShellTemplateDockPreviewContext";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";

const itemDefs: {
  href: string;
  labelKey: string;
  match: (p: string) => boolean;
}[] = [
  { href: "/", labelKey: "nav.home", match: (p) => p === "/" || p === "" || p === "/nature" },
  { href: "/journey", labelKey: "nav.journey", match: (p) => p.startsWith("/journey") },
  { href: "/read", labelKey: "nav.read", match: (p) => p.startsWith("/read") },
  { href: "/explore", labelKey: "nav.explore", match: (p) => p.startsWith("/explore") },
];

function navLinkClass(active: boolean) {
  const base =
    "flex min-h-0 min-w-0 flex-1 basis-0 flex-col items-center justify-center px-0.5 py-0 text-[13px] font-medium leading-tight tracking-wide transition sm:px-0.5 sm:text-[14px]";
  return [
    base,
    active ? "text-white" : "text-white/45 hover:text-white/75",
  ].join(" ");
}

const navItemTextClass = "max-w-full truncate text-center";

/** 置于 shell 底部列（非 fixed），由父级 `fixed inset-0 + flex` 保证始终在视口内。 */
export function HomeBottomNav() {
  const pathname = usePathname() ?? "";
  const { t } = useLocale();
  const { setDockChromeVisible } = useHomeDockChrome();
  const { canPlay, playing, togglePlay } = useMusicShellPlayback();
  const shellTemplateDock = useShellTemplateDockPreviewOptional();
  const dockBackground = shellTemplateDock?.templateDockHex ?? "var(--brand-app-dark)";
  const dockAccent = shellTemplateDock?.templateDockHex ?? "var(--brand-app-dark)";
  const dockChromeStyle = {
    backgroundColor: dockBackground,
  } as const;
  const underfillBg =
    typeof dockBackground === "string" && dockBackground.trim().startsWith("#")
      ? dockBackground.trim()
      : "rgb(var(--brand-app-dark-rgb))";

  if (pathname.startsWith("/admin")) return null;

  /** 同一路径再点「首页」时 pathname 不变，须显式展开底区，否则场景卡仍处收起态 */
  const onHomeNavClick = () => {
    setDockChromeVisible(true);
  };

  return (
    <nav
      className="home-bottom-nav relative z-20 -mt-px flex h-[70px] min-h-[70px] max-h-[70px] w-full min-w-0 max-w-full shrink-0 flex-col overflow-x-hidden overflow-y-visible box-border border-0 border-t-0 pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] pt-1 shadow-none outline-none ring-0"
      style={dockChromeStyle}
      aria-label={t("nav.mainLabel")}
    >
      {/**
       * 向下多画同色带：盖住与视口底 / `canvas` 之间的子像素缝。
       * 勿用 `overflow-hidden` 包住本层，否则此条会被裁掉，反露出浅色线。
       */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-1 left-0 right-0 z-[1] h-[max(10px,calc(env(safe-area-inset-bottom,0px)+8px))]"
        style={{ backgroundColor: underfillBg }}
      />
      <div className="relative z-[2] flex min-h-0 w-full min-w-0 max-w-full flex-1 items-stretch px-0.5 sm:px-1">
        {itemDefs.slice(0, 2).map((def) => {
          const active = def.match(pathname);
          return (
            <Link
              key={def.href}
              href={def.href}
              aria-current={active ? "page" : undefined}
              className={navLinkClass(active)}
              onClick={def.href === "/" ? onHomeNavClick : undefined}
            >
              <span className={navItemTextClass}>{t(def.labelKey)}</span>
            </Link>
          );
        })}

        <div className="music-reactive-play-btn flex min-w-0 flex-1 basis-0 items-center justify-center px-0.5">
          <button
            type="button"
            disabled={!canPlay}
            aria-label={
              !canPlay ? t("playback.noTrack") : playing ? t("playback.pauseMusic") : t("playback.playMusic")
            }
            onClick={() => togglePlay()}
            style={{ backgroundColor: "rgba(255,255,255,0.94)", color: dockAccent }}
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
          return (
            <Link
              key={def.href}
              href={def.href}
              aria-current={active ? "page" : undefined}
              className={navLinkClass(active)}
            >
              <span className={navItemTextClass}>{t(def.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
