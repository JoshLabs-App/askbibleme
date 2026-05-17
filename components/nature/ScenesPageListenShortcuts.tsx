"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/i18n/LocaleProvider";

/** 与 `NatureSceneLayer` 方卡同尺寸与圆角，便于视觉一致 */
const TILE_BASE =
  "group relative flex aspect-square w-[4.25rem] shrink-0 items-stretch justify-stretch overflow-hidden rounded-[0.75rem] text-left shadow-[0_4px_16px_-8px_rgba(15,23,42,0.14)] ring-1 ring-inset transition hover:ring-ink/15 sm:w-[4.75rem] sm:rounded-[0.85rem]";
const TILE_IDLE = "ring-ink/[0.08]";
const TILE_ACTIVE = "ring-2 ring-sky-500/55 ring-inset";

function IconMusicMark(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden>
      <path
        d="M9 18V5l12-2v13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconRelaxMark(props: { className?: string }) {
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

function IconVerseMark(props: { className?: string }) {
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

export function ScenesPageListenShortcuts() {
  const { t } = useLocale();
  const pathname = usePathname() ?? "";

  const items = [
    {
      href: "/music",
      label: t("nav.music"),
      match: (p: string) => p === "/music" || p.startsWith("/music/"),
      Icon: IconMusicMark,
      panelClass: "bg-gradient-to-br from-violet-200 via-purple-100 to-indigo-50",
      iconClass: "text-violet-900/88",
    },
    {
      href: "/relax",
      label: t("nav.relax"),
      match: (p: string) => p === "/relax" || p.startsWith("/relax/"),
      Icon: IconRelaxMark,
      panelClass: "bg-gradient-to-br from-teal-200 via-emerald-100 to-cyan-50",
      iconClass: "text-teal-900/88",
    },
    {
      href: "/verse",
      label: t("nav.goldenVerses"),
      match: (p: string) => p === "/verse" || p.startsWith("/verse/"),
      Icon: IconVerseMark,
      panelClass: "bg-gradient-to-br from-amber-200 via-orange-100 to-amber-50",
      iconClass: "text-amber-950/88",
    },
  ] as const;

  return (
    <section
      className="@container relative mb-5 w-full shrink-0 sm:mb-6"
      aria-label={t("scenesPage.sectionListen")}
      data-shell-swipe-nav-exclude
    >
      <div className="flex w-full justify-center gap-2 sm:gap-2.5">
        {items.map(({ href, label, match, Icon, panelClass, iconClass }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? "page" : undefined}
              aria-label={t("scenesPage.openShortcutAria", { name: label })}
              className={[TILE_BASE, "z-10", active ? TILE_ACTIVE : TILE_IDLE].join(" ")}
            >
              <span className={`absolute inset-0 ${panelClass}`} aria-hidden />
              <span className="relative z-[1] flex h-full w-full items-center justify-center p-2">
                <Icon className={`h-9 w-9 sm:h-10 sm:w-10 ${iconClass}`} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
