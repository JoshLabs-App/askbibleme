import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { AudioStateSnapshot, ShellTabId } from "./bridge/contracts";
import { isNativeShell, platformBridge } from "./bridge/platform-adapter";
import { registerKernelAgentBridge } from "./bridge/agent-bridge";
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
  | { page: "explore"; slug?: string }
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

function normalizeRoutePath(raw: string): string {
  let clean = raw.trim();
  if (!clean) return "/";
  if (clean.startsWith("#")) clean = clean.slice(1);
  const qIdx = clean.indexOf("?");
  if (qIdx >= 0) {
    const queryPart = clean.slice(qIdx + 1);
    const params = new URLSearchParams(queryPart);
    const nested = params.get("route");
    if (nested) return normalizeRoutePath(nested);
    clean = clean.slice(0, qIdx);
  }
  if (!clean.startsWith("/")) clean = `/${clean}`;
  clean = clean.replace(/\/+$/, "") || "/";
  return clean;
}

function resolveRouteFromLocation(): string {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  const queryRoute = params.get("route");
  if (queryRoute) return normalizeRoutePath(queryRoute);

  if (window.location.hash && window.location.hash.length > 1) {
    return normalizeRoutePath(window.location.hash);
  }

  return normalizeRoutePath(window.location.pathname || "/");
}

function parseRoute(pathname: string, fallbackRead: { bookId: string; chapter: number }): RouteState {
  const clean = normalizeRoutePath(pathname);
  if (clean === "/") return { page: "home" };
  if (clean === "/panorama") return { page: "panorama" };
  if (clean === "/plan") return { page: "plan" };
  if (clean === "/figures") return { page: "figures" };
  if (clean === "/ex-libris") return { page: "ex-libris" };
  if (clean === "/settings") return { page: "settings" };
  if (clean === "/explore") return { page: "explore" };
  if (clean.startsWith("/explore/")) {
    const slug = decodeURIComponent(clean.slice("/explore/".length)).trim();
    return slug ? { page: "explore", slug } : { page: "explore" };
  }
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
      const normalized = normalizeRoutePath(restored.route);
      try {
        window.history.replaceState(null, "", normalized);
      } catch {
        // Ignore non-HTTP origin restrictions
      }
      if (restored.scrollY > 0) {
        window.requestAnimationFrame(() => window.scrollTo(0, restored.scrollY));
      }
      return normalized;
    }
    return resolveRouteFromLocation();
  });
  const [audioState, setAudioState] = useState<AudioStateSnapshot | null>(null);
  const historyStackRef = useRef<string[]>([routePath]);
  const routePathRef = useRef<string>(routePath);
  routePathRef.current = routePath;

  const route = parseRoute(routePath, lastRead);
  const activeTab = tabForRoute(route);

  const commitRoute = useCallback((rawPath: string, pushHistory = true) => {
    const path = normalizeRoutePath(rawPath);
    if (pushHistory) {
      const stack = historyStackRef.current;
      if (stack[stack.length - 1] !== path) {
        stack.push(path);
        if (stack.length > 30) stack.shift();
      }
      try {
        if (window.location.pathname !== path || window.location.search || window.location.hash) {
          window.history.pushState(null, "", path);
        }
      } catch {
        // Ignore restricted WebView origin pushState errors
      }
    }
    setRoutePath(path);
    window.scrollTo(0, 0);
  }, []);

  const navigate = useCallback(
    (path: string) => {
      commitRoute(path, true);
    },
    [commitRoute],
  );

  const openReader = useCallback(
    (bookId: string, chapter: number, nextTranslation?: string) => {
      const t = nextTranslation || translationId;
      if (nextTranslation) setTranslationId(nextTranslation);
      setLastRead({ bookId, chapter, translationId: t });
      const targetPath = `/read/${bookId}/${chapter}`;
      void platformBridge.call("shell.haptic", { style: "light" });
      if (nativeShell) {
        void platformBridge.call("shell.setTab", { tab: "read", route: targetPath });
      }
      commitRoute(targetPath, true);
    },
    [commitRoute, nativeShell, translationId],
  );

  const selectTab = useCallback(
    (tab: ShellTabId) => {
      void platformBridge.call("shell.haptic", { style: "light" });
      const targetPath =
        tab === "read" ? `/read/${lastRead.bookId}/${lastRead.chapter}` : TAB_TO_PATH[tab];
      if (nativeShell) {
        void platformBridge.call("shell.setTab", { tab, route: targetPath });
      }
      commitRoute(targetPath, true);
    },
    [commitRoute, lastRead.bookId, lastRead.chapter, nativeShell],
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
    if (typeof window !== "undefined") {
      const tParam = new URLSearchParams(window.location.search).get("t");
      if (tParam && tParam.trim()) {
        setTranslationId(tParam.trim());
      }
    }
    return registerKernelAgentBridge({
      getRoutePath: () => routePathRef.current,
      getTranslationId: () => translationId,
      navigate: (path) => commitRoute(path, true),
      setTranslationId,
    });
  }, [commitRoute, translationId]);

  useEffect(() => {
    const syncFromBrowser = () => {
      const next = resolveRouteFromLocation();
      historyStackRef.current.push(next);
      setRoutePath(next);
    };
    window.addEventListener("popstate", syncFromBrowser);
    window.addEventListener("hashchange", syncFromBrowser);

    const offTab = platformBridge.on("shell.tabSelected", ({ tab, route: nextRoute }) => {
      const dest = normalizeRoutePath(
        nextRoute || (tab === "read" ? `/read/${lastRead.bookId}/${lastRead.chapter}` : TAB_TO_PATH[tab]),
      );
      commitRoute(dest, true);
    });

    const offBack = platformBridge.on("shell.backPressed", () => {
      const stack = historyStackRef.current;
      if (stack.length > 1) {
        stack.pop();
        const prev = stack[stack.length - 1] || "/";
        commitRoute(prev, false);
        try {
          window.history.replaceState(null, "", prev);
        } catch {
          // Ignore
        }
        return;
      }
      const cur = routePathRef.current;
      if (cur.startsWith("/explore/")) {
        commitRoute("/explore", false);
      } else if (cur === "/figures" || cur === "/ex-libris" || cur === "/settings") {
        commitRoute("/explore", false);
      } else if (cur !== "/") {
        commitRoute("/", false);
      }
    });

    const offAudio = platformBridge.on("audio.state", (snapshot) => {
      setAudioState(snapshot);
    });

    return () => {
      window.removeEventListener("popstate", syncFromBrowser);
      window.removeEventListener("hashchange", syncFromBrowser);
      offTab();
      offBack();
      offAudio();
    };
  }, [commitRoute, lastRead.bookId, lastRead.chapter]);

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
            selectedSlug={route.slug}
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
