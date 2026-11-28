import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { AudioStateSnapshot, ShellTabId } from "./bridge/contracts";
import { isNativeShell, platformBridge } from "./bridge/platform-adapter";
import { ShellLayout } from "./components/ShellLayout";
import {
  consumeRestoredViewState,
  setCurrentViewSnapshotProvider,
} from "./updater/silent-updater";

const HomePage = lazy(() => import("./pages/HomePage"));
const PanoramaPage = lazy(() => import("./pages/PanoramaPage"));
const ReaderPage = lazy(() => import("./pages/ReaderPage"));
const PlanPage = lazy(() => import("./pages/PlanPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const FiguresPage = lazy(() => import("./pages/FiguresPage"));
const ExLibrisPage = lazy(() => import("./pages/ExLibrisPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

type RouteState =
  | { page: "home" }
  | { page: "panorama" }
  | { page: "plan" }
  | { page: "read"; bookId: string; chapter: number }
  | { page: "explore" }
  | { page: "figures" }
  | { page: "ex-libris" }
  | { page: "settings" };

const TAB_TO_PATH: Record<ShellTabId, string> = {
  home: "/",
  panorama: "/panorama",
  plan: "/plan",
  read: "/read/JHN/1",
  explore: "/explore",
};

function parseRoute(pathname: string, fallbackRead: { bookId: string; chapter: number }): RouteState {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/") return { page: "home" };
  if (clean === "/panorama") return { page: "panorama" };
  if (clean === "/plan") return { page: "plan" };
  if (clean === "/explore") return { page: "explore" };
  if (clean === "/figures") return { page: "figures" };
  if (clean === "/ex-libris") return { page: "ex-libris" };
  if (clean === "/settings") return { page: "settings" };
  if (clean.startsWith("/read")) {
    const parts = clean.split("/").filter(Boolean);
    const bookId = (parts[1] || fallbackRead.bookId).toUpperCase();
    const ch = Number(parts[2] || fallbackRead.chapter);
    return { page: "read", bookId, chapter: Number.isFinite(ch) && ch > 0 ? ch : 1 };
  }
  return { page: "home" };
}

function tabForRoute(route: RouteState): ShellTabId {
  switch (route.page) {
    case "home":
      return "home";
    case "panorama":
      return "panorama";
    case "plan":
      return "plan";
    case "read":
      return "read";
    case "explore":
    case "figures":
    case "ex-libris":
    case "settings":
      return "explore";
  }
}

export function App() {
  const [nativeShell] = useState(() => isNativeShell());
  const [translationId, setTranslationId] = useState("cuv-simp");
  const [lastRead, setLastRead] = useState({ bookId: "JHN", chapter: 1, translationId: "cuv-simp" });
  const [routePath, setRoutePath] = useState(() => {
    const restored = consumeRestoredViewState();
    if (restored?.route) {
      window.history.replaceState(null, "", restored.route);
      if (restored.scrollY > 0) {
        window.requestAnimationFrame(() => window.scrollTo(0, restored.scrollY));
      }
      return restored.route;
    }
    return window.location.pathname || "/";
  });
  const [audioState, setAudioState] = useState<AudioStateSnapshot | null>(null);

  const route = parseRoute(routePath, lastRead);
  const activeTab = tabForRoute(route);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
    setRoutePath(path);
    window.scrollTo(0, 0);
  }, []);

  const openReader = useCallback(
    (bookId: string, chapter: number, nextTranslation?: string) => {
      const t = nextTranslation || translationId;
      if (nextTranslation) setTranslationId(nextTranslation);
      setLastRead({ bookId, chapter, translationId: t });
      navigate(`/read/${bookId}/${chapter}`);
    },
    [navigate, translationId],
  );

  const selectTab = useCallback(
    (tab: ShellTabId) => {
      void platformBridge.call("shell.haptic", { style: "light" });
      const targetPath =
        tab === "read" ? `/read/${lastRead.bookId}/${lastRead.chapter}` : TAB_TO_PATH[tab];
      if (nativeShell) {
        void platformBridge.call("shell.setTab", { tab, route: targetPath });
      }
      navigate(targetPath);
    },
    [lastRead.bookId, lastRead.chapter, nativeShell, navigate],
  );

  useEffect(() => {
    setCurrentViewSnapshotProvider(() => ({
      route: routePath,
      bookId: route.page === "read" ? route.bookId : lastRead.bookId,
      chapter: route.page === "read" ? route.chapter : lastRead.chapter,
      translationId,
    }));
  }, [routePath, route, lastRead.bookId, lastRead.chapter, translationId]);

  useEffect(() => {
    const onPop = () => setRoutePath(window.location.pathname || "/");
    window.addEventListener("popstate", onPop);

    const offTab = platformBridge.on("shell.tabSelected", ({ tab, route: nextRoute }) => {
      const dest = nextRoute || (tab === "read" ? `/read/${lastRead.bookId}/${lastRead.chapter}` : TAB_TO_PATH[tab]);
      if (dest && window.location.pathname !== dest) {
        window.history.pushState(null, "", dest);
        setRoutePath(dest);
      }
    });

    const offBack = platformBridge.on("shell.backPressed", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        navigate("/");
      }
    });

    const offAudio = platformBridge.on("audio.state", (snapshot) => {
      setAudioState(snapshot);
    });

    return () => {
      window.removeEventListener("popstate", onPop);
      offTab();
      offBack();
      offAudio();
    };
  }, [lastRead.bookId, lastRead.chapter, navigate]);

  async function toggleAudioPause(stream: "music" | "scripture" | "verse") {
    await platformBridge.call("audio.intent", {
      stream,
      action: "pause",
      origin: "kernel-dock",
    });
  }

  return (
    <ShellLayout
      activeTab={activeTab}
      isNative={nativeShell}
      audioState={audioState}
      onSelectTab={selectTab}
      onNavigate={navigate}
      onToggleAudioPause={toggleAudioPause}
    >
      <Suspense fallback={<div className="ab-loading">正在展开页面…</div>}>
        {route.page === "home" && (
          <HomePage
            audioState={audioState}
            lastRead={lastRead}
            onOpenReader={(b, c) => openReader(b, c)}
            onNavigate={navigate}
          />
        )}
        {route.page === "panorama" && (
          <PanoramaPage onOpenReader={(b, c) => openReader(b, c)} />
        )}
        {route.page === "plan" && (
          <PlanPage onOpenReader={(b, c) => openReader(b, c)} />
        )}
        {route.page === "read" && (
          <ReaderPage
            bookId={route.bookId}
            chapter={route.chapter}
            translationId={translationId}
            onChangeChapter={(b, c, t) => openReader(b, c, t)}
          />
        )}
        {route.page === "explore" && (
          <ExplorePage
            onNavigate={navigate}
            onOpenReader={(b, c) => openReader(b, c)}
          />
        )}
        {route.page === "figures" && (
          <FiguresPage onOpenReader={(b, c) => openReader(b, c)} />
        )}
        {route.page === "ex-libris" && <ExLibrisPage />}
        {route.page === "settings" && <SettingsPage />}
      </Suspense>
    </ShellLayout>
  );
}

export default App;
