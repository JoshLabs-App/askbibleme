"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ReadChapterActionChrome } from "@/components/bible/ReadChapterActionChrome";
import { ReadChapterCatalogQuickPicker } from "@/components/bible/ReadChapterCatalogQuickPicker";
import { ReadScriptureAudioDockStrip } from "@/components/bible/ReadScriptureAudioDockStrip";
import { ScriptureAudioDockStrip } from "@/components/bible/ScriptureAudioDockStrip";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { ShellMaterialCommunityIcon } from "@/components/shell/ShellMaterialCommunityIcon";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { isCuvChapterAudioEffectiveSrc } from "@/lib/bible/parse-cuv-chapter-audio-src";
import { isReadPlanPlayPath, readPlanPlayHref } from "@/lib/read/read-plan-play-route";
import { isExploreHomeRoute } from "@/lib/explore/explore-route-chrome";
import { isReadBibleHomeRoute } from "@/lib/read/read-route-chrome";
import { parseReadChapterPathname } from "@/lib/read/resolve-chapter-page-scripture-play-target";
import { shouldShowReadScriptureAudioDock } from "@/lib/read/read-scripture-dock-visibility";
import { useReadChapterPageAudioAvailable } from "@/hooks/useReadChapterPageAudioAvailable";
import {
  SHELL_TAB_BAR_ICON,
  SHELL_PLAY_ICON_SIZE_PX,
  SHELL_TAB_ICON_SIZE_PX,
  shellTabMaterialIcon,
  type ShellTabMaterialIconName,
} from "@/lib/shell/shell-chrome-icons";
import { WEB_APP_HOME_PATH, isWebAppHomePath } from "@/lib/web-app-home-path";

type NavItemDef = {
  key: "home" | "panorama" | "today" | "read" | "study";
  href: string;
  zhLabel: string;
  enLabel: string;
  match: (p: string) => boolean;
  materialIcon: ShellTabMaterialIconName;
};

const homeItem: NavItemDef = {
  key: "home",
  href: WEB_APP_HOME_PATH,
  zhLabel: "首页",
  enLabel: "Home",
  match: (p) =>
    isWebAppHomePath(p) ||
    p === "" ||
    p === "/nature" ||
    p.startsWith("/nature/") ||
    p === "/music" ||
    p.startsWith("/music/"),
  materialIcon: shellTabMaterialIcon("home"),
};

const panoramaItem: NavItemDef = {
  key: "panorama",
  href: "/panorama",
  zhLabel: "全景",
  enLabel: "Story",
  match: (p) =>
    p === "/panorama" ||
    p.startsWith("/panorama/") ||
    p === "/journey" ||
    p.startsWith("/journey/"),
  materialIcon: shellTabMaterialIcon("panorama"),
};

const todayItem: NavItemDef = {
  key: "today",
  href: "/read/plan-play",
  zhLabel: "今日",
  enLabel: "Today",
  match: (p) => isReadPlanPlayPath(p) || p === "/read/plans" || p.startsWith("/read/plans/"),
  materialIcon: shellTabMaterialIcon("today"),
};

const readItem: NavItemDef = {
  key: "read",
  href: "/read",
  zhLabel: "圣经",
  enLabel: "Bible",
  match: (p) =>
    (p === "/read" || p.startsWith("/read/")) &&
    !isReadPlanPlayPath(p) &&
    p !== "/read/plans" &&
    !p.startsWith("/read/plans/"),
  materialIcon: shellTabMaterialIcon("read"),
};

const studyItem: NavItemDef = {
  key: "study",
  href: "/explore",
  zhLabel: "书房",
  enLabel: "Study",
  match: (p) => p === "/explore" || p.startsWith("/explore/"),
  materialIcon: shellTabMaterialIcon("explore"),
};

function shellHref(path: string, shellRoot: string): string {
  if (!shellRoot) return path === "/" ? WEB_APP_HOME_PATH : path;
  if (path === "/") return shellRoot;
  return `${shellRoot}${path}`;
}

function buildAllNavItems(shellRoot: string): NavItemDef[] {
  if (!shellRoot) return [homeItem, panoramaItem, todayItem, readItem, studyItem];
  return [
    {
      ...homeItem,
      href: shellHref("/", shellRoot),
      match: (p) => p === shellRoot || p === `${shellRoot}/` || p.startsWith(`${shellRoot}/music`),
    },
    {
      ...panoramaItem,
      href: shellHref("/panorama", shellRoot),
      match: (p) =>
        p.startsWith(`${shellRoot}/panorama`) || p.startsWith(`${shellRoot}/journey`),
    },
    {
      ...todayItem,
      href: shellHref("/read/plan-play", shellRoot),
      match: (p) => p.startsWith(`${shellRoot}/read/plan-play`) || p.startsWith(`${shellRoot}/read/plans`),
    },
    {
      ...readItem,
      href: shellHref("/read", shellRoot),
      match: (p) =>
        p.startsWith(`${shellRoot}/read`) &&
        !p.startsWith(`${shellRoot}/read/plan-play`) &&
        !p.startsWith(`${shellRoot}/read/plans`),
    },
    {
      ...studyItem,
      href: shellHref("/explore", shellRoot),
      match: (p) => p.startsWith(`${shellRoot}/explore`),
    },
  ];
}

function iconLinkClass(active: boolean) {
  return [
    "home-bottom-nav__tab",
    active ? "home-bottom-nav__tab--active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function parseReadChapterRoute(pathname: string): { bookId: string; chapter: number } | null {
  const match = pathname.match(/^\/read\/([A-Za-z0-9_]+)\/(\d+)(?:\/)?$/);
  if (!match) return null;
  const chapter = Number(match[2]);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  return { bookId: match[1].toUpperCase(), chapter };
}

type Placement = "fixedShell" | "videoStage";

type Props = { placement: Placement; /** 电视壳：`/tv` */ shellRoot?: string };

/**
 * 原底栏路由 + 壳层播放：Material Icons 与 App `ShellTabBar` 同名同尺寸。
 */
export function HomeShellFloatingRouteNav({ placement, shellRoot = "" }: Props) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { t, locale } = useLocale();
  const { playing, effectiveSrc, loading } = useMusicShellPlayback();
  const readChapterRoute = useMemo(() => parseReadChapterRoute(pathname), [pathname]);
  const isPlanPlay = isReadPlanPlayPath(pathname);
  const readChapterAudioAvailable = useReadChapterPageAudioAvailable();
  const onChapterPage = parseReadChapterPathname(pathname) !== null;
  const [readCatalogOpen, setReadCatalogOpen] = useState(false);
  const navItems = buildAllNavItems(shellRoot);
  const onReadTab = navItems.find((item) => item.key === "read")?.match(pathname) ?? false;
  const scriptureActive = playing && isCuvChapterAudioEffectiveSrc(effectiveSrc);

  const showFullScriptureDock =
    onReadTab &&
    !isPlanPlay &&
    shouldShowReadScriptureAudioDock({
      readChapterAudioAvailable,
      onChapterPage,
      playing: scriptureActive,
      scripturePreparing: loading && (scriptureActive || onChapterPage),
    });

  useEffect(() => {
    if (readChapterRoute === null) setReadCatalogOpen(false);
  }, [readChapterRoute]);

  const outer =
    placement === "fixedShell"
      ? "home-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center justify-end gap-1.5 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-0"
      : "pointer-events-none absolute inset-x-0 bottom-0 z-[18] flex flex-col items-center justify-end gap-1.5 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-0";

  const itemLabel = (item: NavItemDef) =>
    locale === "en" ? item.enLabel : item.zhLabel;

  const renderPillContent = (item: NavItemDef, active: boolean) => {
    const color = active ? "currentColor" : "currentColor";
    return (
      <>
        <ShellMaterialIcon
          name={item.materialIcon}
          size={22}
          color={color}
          className="home-bottom-nav__tab-icon"
        />
        <span className="mt-0.5 text-[10.5px] leading-tight font-semibold tracking-tight">
          {itemLabel(item)}
        </span>
      </>
    );
  };

  const renderIconLink = (item: NavItemDef) => {
    const active = item.match(pathname);
    const label = itemLabel(item);
    if (item.key === "read" && readChapterRoute !== null) {
      return (
        <button
          key={item.key}
          type="button"
          title={label}
          aria-current={active ? "page" : undefined}
          aria-label={label}
          className={`appearance-none border-0 bg-transparent p-0 ${iconLinkClass(active)}`}
          onClick={() => setReadCatalogOpen((value) => !value)}
        >
          {renderPillContent(item, active)}
        </button>
      );
    }
    if (item.key === "read") {
      return (
        <Link
          key={item.key}
          href={item.href}
          title={label}
          aria-current={active ? "page" : undefined}
          aria-label={label}
          className={iconLinkClass(active)}
          onClick={(event) => {
            if (!active) return;
            event.preventDefault();
            if (isReadBibleHomeRoute(pathname)) return;
            router.replace(shellHref("/read", shellRoot));
          }}
        >
          {renderPillContent(item, active)}
        </Link>
      );
    }
    if (item.key === "study") {
      return (
        <Link
          key={item.key}
          href={item.href}
          title={label}
          aria-current={active ? "page" : undefined}
          aria-label={label}
          className={iconLinkClass(active)}
          onClick={(event) => {
            if (!active) return;
            event.preventDefault();
            if (isExploreHomeRoute(pathname)) return;
            router.replace(shellHref("/explore", shellRoot));
          }}
        >
          {renderPillContent(item, active)}
        </Link>
      );
    }
    if (item.key === "today") {
      return (
        <Link
          key={item.key}
          href={shellRoot ? item.href : readPlanPlayHref()}
          title={label}
          aria-current={active ? "page" : undefined}
          aria-label={label}
          className={iconLinkClass(active)}
        >
          {renderPillContent(item, active)}
        </Link>
      );
    }
    return (
      <Link
        key={item.key}
        href={item.href}
        title={label}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        className={iconLinkClass(active)}
      >
        {renderPillContent(item, active)}
      </Link>
    );
  };

  const readCatalogSheet =
    readChapterRoute !== null ? (
      <ReadChapterCatalogQuickPicker
        bookId={readChapterRoute.bookId}
        chapter={readChapterRoute.chapter}
        open={readCatalogOpen}
        onOpenChange={setReadCatalogOpen}
      />
    ) : null;

  const isVideoStage = placement === "videoStage";

  return (
    <div className={outer}>
      {showFullScriptureDock ? (
        <ReadScriptureAudioDockStrip placement={placement} />
      ) : (
        <ScriptureAudioDockStrip placement={placement} />
      )}
      <ReadChapterActionChrome />
      <nav
        className={[
          "home-bottom-nav__bar pointer-events-auto",
          isVideoStage ? "home-bottom-nav__bar--scenery" : "home-bottom-nav__bar--parchment",
        ].join(" ")}
        aria-label={t("nav.mainLabel")}
      >
        {navItems.map(renderIconLink)}
      </nav>
      {readCatalogSheet}
    </div>
  );
}
