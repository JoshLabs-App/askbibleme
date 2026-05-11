"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { IconPause, IconPlay } from "@/components/ui/MediaPlaybackIcons";

const itemDefs: { href: string; labelKey: string; match: (p: string) => boolean }[] = [
  { href: "/", labelKey: "nav.music", match: (p) => p === "/" || p === "" },
  { href: "/journey", labelKey: "nav.journey", match: (p) => p.startsWith("/journey") },
  { href: "/nature", labelKey: "nav.nature", match: (p) => p.startsWith("/nature") },
  { href: "/relax", labelKey: "nav.relax", match: (p) => p.startsWith("/relax") },
  { href: "/read", labelKey: "nav.read", match: (p) => p.startsWith("/read") },
  { href: "/explore", labelKey: "nav.explore", match: (p) => p.startsWith("/explore") },
];

function tabClass(active: boolean) {
  return [
    "flex min-h-[2.5rem] min-w-0 flex-1 flex-col items-center justify-center px-0.5 py-1 text-[11px] font-medium tracking-wide transition sm:px-1 sm:text-sm",
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
      className="relative z-20 w-full min-w-0 max-w-full shrink-0 overflow-x-hidden border-t border-border/25 bg-transparent pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5"
      aria-label={t("nav.mainLabel")}
    >
      <div className="flex w-full min-w-0 max-w-full items-stretch gap-0.5 px-1 sm:px-2">
        <div className="flex min-w-0 flex-1 items-stretch justify-end gap-px sm:gap-0.5">
          {[0, 1, 2].map((i) => (
            <Link
              key={itemDefs[i].href}
              href={itemDefs[i].href}
              aria-current={itemDefs[i].match(pathname) ? "page" : undefined}
              className={tabClass(itemDefs[i].match(pathname))}
            >
              {t(itemDefs[i].labelKey)}
            </Link>
          ))}
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
          {[3, 4, 5].map((i) => (
            <Link
              key={itemDefs[i].href}
              href={itemDefs[i].href}
              aria-current={itemDefs[i].match(pathname) ? "page" : undefined}
              className={tabClass(itemDefs[i].match(pathname))}
            >
              {t(itemDefs[i].labelKey)}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
