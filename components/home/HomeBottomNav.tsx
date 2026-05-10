"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";

const items: { href: string; label: string; match: (p: string) => boolean }[] = [
  /** 文案「音乐」对应首页 `/` 主体验 */
  { href: "/", label: "音乐", match: (p) => p === "/" || p === "" },
  { href: "/journey", label: "旅程", match: (p) => p.startsWith("/journey") },
  { href: "/read", label: "圣经", match: (p) => p.startsWith("/read") },
  { href: "/explore", label: "探索", match: (p) => p.startsWith("/explore") },
];

function tabClass(active: boolean) {
  return [
    "flex min-h-[2.5rem] min-w-0 flex-1 flex-col items-center justify-center px-1 py-1 text-[11px] font-medium tracking-wide transition",
    active ? "text-ink" : "text-ink/50 hover:bg-ink/[0.04] hover:text-ink/85",
  ].join(" ");
}

/** 置于 shell 底部列（非 fixed），由父级 `fixed inset-0 + flex` 保证始终在视口内。 */
export function HomeBottomNav() {
  const pathname = usePathname() ?? "";
  const { canPlay, playing, togglePlay } = useMusicShellPlayback();

  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      className="relative z-20 w-full min-w-0 max-w-full shrink-0 overflow-x-hidden border-t border-border/25 bg-transparent pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5"
      aria-label="主导航"
    >
      <div className="flex w-full min-w-0 max-w-full items-stretch gap-0.5 px-2 sm:px-3">
        <Link
          href={items[0].href}
          aria-current={items[0].match(pathname) ? "page" : undefined}
          className={tabClass(items[0].match(pathname))}
        >
          {items[0].label}
        </Link>
        <Link
          href={items[1].href}
          aria-current={items[1].match(pathname) ? "page" : undefined}
          className={tabClass(items[1].match(pathname))}
        >
          {items[1].label}
        </Link>

        <div className="music-reactive-play-btn flex flex-none items-center justify-center px-0.5">
          <button
            type="button"
            disabled={!canPlay}
            aria-label={
              !canPlay ? "暂无可播放曲目" : playing ? "暂停音乐" : "播放音乐"
            }
            onClick={() => togglePlay()}
            className="music-reactive-play-btn flex h-11 w-11 -translate-y-0.5 items-center justify-center rounded-full bg-white text-[14px] text-ink shadow-sm ring-1 ring-ink/[0.06] transition-colors hover:bg-white hover:shadow disabled:pointer-events-none disabled:opacity-35"
          >
            {playing ? "⏸" : "▶"}
          </button>
        </div>

        <Link
          href={items[2].href}
          aria-current={items[2].match(pathname) ? "page" : undefined}
          className={tabClass(items[2].match(pathname))}
        >
          {items[2].label}
        </Link>
        <Link
          href={items[3].href}
          aria-current={items[3].match(pathname) ? "page" : undefined}
          className={tabClass(items[3].match(pathname))}
        >
          {items[3].label}
        </Link>
      </div>
    </nav>
  );
}
