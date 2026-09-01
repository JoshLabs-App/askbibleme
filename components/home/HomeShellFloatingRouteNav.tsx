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

type NavItemDef = {
  href: string;
  labelKey: string;
  match: (p: string) => boolean;
  materialIcon: ShellTabMaterialIconName;
};

const homeItem: NavItemDef = {
  href: "/",
  labelKey: "nav.home",
  match: (p) => p === "/" || p === "" || p === "/nature" || p.startsWith("/nature/"),
  materialIcon: shellTabMaterialIcon("home"),
};

const musicItem: NavItemDef = {
  href: "/music",
  labelKey: "nav.music",
  match: (p) => p === "/music" || p.startsWith("/music/"),
  materialIcon: shellTabMaterialIcon("music"),
};

const readItem: NavItemDef = {
  href: "/read",
  labelKey: "nav.read",
  match: (p) => p === "/read" || p.startsWith("/read/"),
  materialIcon: shellTabMaterialIcon("read"),
};

const exploreItem: NavItemDef = {
  href: "/explore",
  labelKey: "nav.explore",
  match: (p) => p === "/explore" || p.startsWith("/explore/"),
  materialIcon: shellTabMaterialIcon("explore"),
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
    materialIcon: shellTabMaterialIcon("home"),
  };
  const music: NavItemDef = {
    href: shellHref("/music", shellRoot),
    labelKey: "nav.music",
    match: shellRoot
      ? (p) => p === `${shellRoot}/music` || p.startsWith(`${shellRoot}/music/`)
      : musicItem.match,
    materialIcon: shellTabMaterialIcon("music"),
  };
  const read: NavItemDef = {
    href: shellHref("/read", shellRoot),
    labelKey: "nav.read",
    match: shellRoot
      ? (p) => p === `${shellRoot}/read` || p.startsWith(`${shellRoot}/read/`)
      : readItem.match,
    materialIcon: shellTabMaterialIcon("read"),
  };
  const explore: NavItemDef = {
    href: shellHref("/explore", shellRoot),
    labelKey: "nav.explore",
    match: shellRoot
      ? (p) => p.startsWith(`${shellRoot}/explore`)
      : exploreItem.match,
    materialIcon: shellTabMaterialIcon("explore"),
  };
  return { left: [home, music], right: [read, explore] };
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
  const { t } = useLocale();
  const { canPlayMusic, playing, effectiveSrc, togglePlayMusic, loading } = useMusicShellPlayback();
  const readChapterRoute = useMemo(() => parseReadChapterRoute(pathname), [pathname]);
  const isPlanPlay = isReadPlanPlayPath(pathname);
  const readChapterAudioAvailable = useReadChapterPageAudioAvailable();
  const onChapterPage = parseReadChapterPathname(pathname) !== null;
  const [readCatalogOpen, setReadCatalogOpen] = useState(false);
  const { left: navLeft, right: navRight } = buildNavItems(shellRoot);
  const onReadTab =
    navRight.find((item) => item.labelKey === "nav.read")?.match(pathname) ?? false;
  const readFabUsesScripture = onReadTab;
  const musicActive = playing && !isCuvChapterAudioEffectiveSrc(effectiveSrc);
  const scriptureActive = playing && isCuvChapterAudioEffectiveSrc(effectiveSrc);
  const canPlayFab = readFabUsesScripture ? true : canPlayMusic;
  const fabActive = readFabUsesScripture ? isPlanPlay || scriptureActive : musicActive;

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
      ? "home-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col items-center justify-end gap-1.5 px-3 pb-[max(0.375rem,env(safe-area-inset-bottom,0px))] pt-0"
      : "pointer-events-none absolute inset-x-0 bottom-0 z-[18] flex flex-col items-center justify-end gap-1.5 px-3 pb-[max(0.375rem,env(safe-area-inset-bottom,0px))] pt-0";

  const navTapTarget = (_item: NavItemDef): void => {};

  const renderTabIcon = (item: NavItemDef) => (
    <ShellMaterialIcon
      name={item.materialIcon}
      size={SHELL_TAB_ICON_SIZE_PX}
      color={SHELL_TAB_BAR_ICON}
      className="home-bottom-nav__tab-icon"
    />
  );

  const renderIconLink = (item: NavItemDef) => {
    const active = item.match(pathname);
    if (item.labelKey === "nav.read" && readChapterRoute !== null) {
      return (
        <button
          key={item.href}
          type="button"
          title={t(item.labelKey)}
          aria-current={active ? "page" : undefined}
          aria-label={t(item.labelKey)}
          className={`appearance-none border-0 bg-transparent p-0 ${iconLinkClass(active)}`}
          onClick={() => {
            navTapTarget(item);
            setReadCatalogOpen((value) => !value);
          }}
        >
          {renderTabIcon(item)}
        </button>
      );
    }
    if (item.labelKey === "nav.read") {
      const onReadRoute = active;
      return (
        <Link
          key={item.href}
          href={item.href}
          title={t(item.labelKey)}
          aria-current={active ? "page" : undefined}
          aria-label={t(item.labelKey)}
          className={iconLinkClass(active)}
          onClick={(event) => {
            navTapTarget(item);
            if (!onReadRoute) return;
            event.preventDefault();
            if (isReadBibleHomeRoute(pathname)) return;
            router.replace(shellHref("/read", shellRoot));
          }}
        >
          {renderTabIcon(item)}
        </Link>
      );
    }
    if (item.labelKey === "nav.explore") {
      const onExploreRoute = active;
      return (
        <Link
          key={item.href}
          href={item.href}
          title={t(item.labelKey)}
          aria-current={active ? "page" : undefined}
          aria-label={t(item.labelKey)}
          className={iconLinkClass(active)}
          onClick={(event) => {
            navTapTarget(item);
            if (!onExploreRoute) return;
            event.preventDefault();
            if (isExploreHomeRoute(pathname)) return;
            router.replace(shellHref("/explore", shellRoot));
          }}
        >
          {renderTabIcon(item)}
        </Link>
      );
    }
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
        {renderTabIcon(item)}
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

  return (
    <div className={outer}>
      {showFullScriptureDock ? (
        <ReadScriptureAudioDockStrip placement={placement} />
      ) : (
        <ScriptureAudioDockStrip placement={placement} />
      )}
      <ReadChapterActionChrome />
      <nav className="home-bottom-nav__bar pointer-events-auto" aria-label={t("nav.mainLabel")}>
        <div className="home-bottom-nav__side home-bottom-nav__side--left">
          {navLeft.map(renderIconLink)}
        </div>

        <button
          type="button"
          disabled={!canPlayFab}
          aria-label={
            readFabUsesScripture
              ? isPlanPlay
                ? t("pages.read.planPlayTitle")
                : t("pages.read.planPlayTitle")
              : !canPlayFab
                ? t("playback.noTrack")
                : musicActive
                  ? t("playback.pauseMusic")
                  : t("playback.playMusic")
          }
          onClick={() => {
            if (readFabUsesScripture) {
              if (isPlanPlay) return;
              router.push(readPlanPlayHref());
              return;
            }
            void togglePlayMusic();
          }}
          className={[
            "home-bottom-nav__play",
            fabActive ? "home-bottom-nav__play--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {readFabUsesScripture ? (
            <ShellMaterialIcon
              name="account-voice"
              size={SHELL_PLAY_ICON_SIZE_PX}
              color={fabActive ? "var(--brand-logo-background)" : SHELL_TAB_BAR_ICON}
              className="home-bottom-nav__play-icon"
            />
          ) : (
            <ShellMaterialIcon
              name={fabActive ? "pause" : "play-arrow"}
              size={fabActive ? 28 : SHELL_PLAY_ICON_SIZE_PX}
              color={fabActive ? "var(--brand-logo-background)" : SHELL_TAB_BAR_ICON}
              className="home-bottom-nav__play-icon"
            />
          )}
        </button>

        <div className="home-bottom-nav__side home-bottom-nav__side--right">
          {navRight.map(renderIconLink)}
        </div>
      </nav>
      {readCatalogSheet}
    </div>
  );
}
