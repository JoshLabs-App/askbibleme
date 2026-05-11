"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";
import { IconNavExplore, IconNavHome, IconNavJourney, IconNavRead } from "@/components/ui/NavTabIcons";

const itemDefs: {
  href: string;
  labelKey: string;
  Icon: ComponentType<{ className?: string }>;
  match: (p: string) => boolean;
}[] = [
  { href: "/", labelKey: "nav.home", Icon: IconNavHome, match: (p) => p === "/" || p === "" || p === "/nature" },
  { href: "/journey", labelKey: "nav.journey", Icon: IconNavJourney, match: (p) => p.startsWith("/journey") },
  { href: "/read", labelKey: "nav.read", Icon: IconNavRead, match: (p) => p.startsWith("/read") },
  { href: "/explore", labelKey: "nav.explore", Icon: IconNavExplore, match: (p) => p.startsWith("/explore") },
];

function tabClass(active: boolean) {
  return [
    "flex min-h-[3rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-0.5 text-[11px] font-medium leading-tight tracking-wide transition sm:min-h-[3.25rem] sm:gap-1 sm:px-1 sm:text-sm",
    active ? "text-ink" : "text-ink/50 hover:bg-ink/[0.04] hover:text-ink/85",
  ].join(" ");
}

/** 置于 shell 底部列（非 fixed），由父级 `fixed inset-0 + flex` 保证始终在视口内。 */
export function HomeBottomNav() {
  const pathname = usePathname() ?? "";
  const { t } = useLocale();
  const { canPlay, playing, togglePlay } = useMusicShellPlayback();
  if (pathname.startsWith("/admin")) return null;
  if (pathname.startsWith("/relax")) return null;

  return (
    <nav
      className="home-bottom-nav relative z-20 w-full min-w-0 max-w-full shrink-0 overflow-x-hidden border-t border-border/25 bg-transparent pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5"
      aria-label={t("nav.mainLabel")}
    >
      <div className="flex w-full min-w-0 max-w-full items-stretch gap-0.5 px-1 sm:px-2">
        <div className="flex min-w-0 flex-1 items-stretch justify-end gap-px sm:gap-0.5">
          {[0, 1].map((i) => {
            const def = itemDefs[i];
            const active = def.match(pathname);
            const Icon = def.Icon;
            return (
              <Link
                key={def.href}
                href={def.href}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 sm:h-5 sm:w-5" />
                <span className="max-w-full truncate text-center">{t(def.labelKey)}</span>
              </Link>
            );
          })}
        </div>

        <div className="music-reactive-play-btn flex shrink-0 items-center justify-center self-center px-0.5">
          <button
            type="button"
            disabled={!canPlay}
            aria-label={
              !canPlay ? t("playback.noTrack") : playing ? t("playback.pauseMusic") : t("playback.playMusic")
            }
            onClick={() => togglePlay()}
            className="music-reactive-play-btn flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-[0_1px_2px_rgba(31,26,18,0.05),0_3px_10px_rgba(31,26,18,0.06)] ring-1 ring-border/45 transition hover:bg-[#EDE4D4] hover:ring-border/60 hover:shadow-[0_2px_6px_rgba(31,26,18,0.07)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand/50 disabled:pointer-events-none disabled:opacity-35"
          >
            {playing ? (
              <IconPause className="h-[18px] w-[18px] shrink-0 opacity-95" />
            ) : (
              <IconPlay className="h-[18px] w-[18px] shrink-0 translate-x-[1px] opacity-95" />
            )}
          </button>
        </div>

        <div className="flex min-w-0 flex-1 items-stretch justify-start gap-px sm:gap-0.5">
          {[2, 3].map((i) => {
            const def = itemDefs[i];
            const active = def.match(pathname);
            const Icon = def.Icon;
            return (
              <Link
                key={def.href}
                href={def.href}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 sm:h-5 sm:w-5" />
                <span className="max-w-full truncate text-center">{t(def.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
