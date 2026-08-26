import type { TelemetryEventProperties } from "./types";

/** Web App Router pathname → 稳定 screen 名 */
export function webPathnameToScreen(pathname: string): TelemetryEventProperties | null {
  const p = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";

  if (p === "/" || p === "/nature") return { screen: "home" };
  if (p === "/scenes" || p.startsWith("/scenes/")) return { screen: "scenes" };
  if (p === "/relax") return { screen: "relax" };
  if (p === "/music") return { screen: "music" };
  if (p === "/explore" || p.startsWith("/explore/")) {
    return { screen: "explore" };
  }
  if (p === "/read/search") return { screen: "read.search" };
  if (p === "/read/translations") return { screen: "read.translations" };
  if (p === "/read/favorites") return { screen: "read.favorites" };
  if (p === "/read/plan-play") return { screen: "read.plan-play" };
  if (p === "/read/read" || p === "/read/catalog") return { screen: "read.catalog.standalone" };
  if (p === "/read/plans" || p.startsWith("/read/plans/")) return { screen: "read.plans" };
  if (p === "/read" || p === "/read/") return { screen: "read.catalog" };

  const chapter = /^\/read\/([A-Za-z0-9_]+)\/(\d+)\/?$/.exec(p);
  if (chapter) {
    return {
      screen: "read.chapter",
      book_id: chapter[1]!.toUpperCase(),
      chapter: Number(chapter[2]),
    };
  }

  if (p.startsWith("/read")) return { screen: "read.catalog" };
  return null;
}

/** Expo Router segments → screen（mobile） */
export function mobileSegmentsToScreen(segments: string[]): TelemetryEventProperties | null {
  const parts = segments.filter((s) => s && !s.startsWith("(") && s !== "index");
  if (parts.length === 0) return { screen: "home" };

  const head = parts[0];
  if (head === "music") return { screen: "music" };
  if (head === "explore") {
    return { screen: "explore" };
  }
  if (head === "scenes" || head === "scenes.tsx") return { screen: "scenes" };
  if (head === "relax") return { screen: "relax" };

  if (head === "read") {
    if (parts.includes("search")) return { screen: "read.search" };
    if (parts.includes("translations")) return { screen: "read.translations" };
    if (parts.includes("favorites")) return { screen: "read.favorites" };
    if (parts.includes("plan-play")) return { screen: "read.plan-play" };
    if (parts.includes("plans")) return { screen: "read.plans" };
    if (parts.includes("catalog")) return { screen: "read.catalog.standalone" };
    const bookIdx = parts.findIndex((p) => /^[A-Za-z0-9_]+$/.test(p) && p !== "read");
    const chapterPart = parts[bookIdx + 1];
    if (bookIdx >= 0 && chapterPart && /^\d+$/.test(chapterPart)) {
      return {
        screen: "read.chapter",
        book_id: parts[bookIdx]!.toUpperCase(),
        chapter: Number(chapterPart),
      };
    }
    return { screen: "read.catalog" };
  }

  if (head === "index" || head === "(tabs)") return { screen: "home" };

  return null;
}
