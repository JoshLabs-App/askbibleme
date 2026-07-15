import type { HomeVersePoolMenuScopeId } from "@/lib/home-prayer-pools/home-verse-pool-menu-scopes";

export const HOME_LISTENING_PROGRESS_STORAGE_KEY = "askbible-home-listening-progress-v1";
export const HOME_LISTENING_PROGRESS_UPDATED_EVENT = "selah:home-listening-progress-updated";

export type HomeListeningScopeProgress = {
  cursor: number;
  completedPlays: number;
};

export type HomeListeningProgress = {
  version: 1;
  totalListeningSeconds: number;
  progressByScope: Partial<Record<HomeVersePoolMenuScopeId, HomeListeningScopeProgress>>;
  listenedVerseKeys: string[];
  earnedHonors: string[];
};

const EMPTY: HomeListeningProgress = {
  version: 1,
  totalListeningSeconds: 0,
  progressByScope: {},
  listenedVerseKeys: [],
  earnedHonors: [],
};

const TIME_HONORS = [
  { seconds: 60 * 60, id: "listen-1h" },
  { seconds: 7 * 60 * 60, id: "listen-7h" },
  { seconds: 21 * 60 * 60, id: "listen-21h" },
  { seconds: 49 * 60 * 60, id: "listen-49h" },
  { seconds: 100 * 60 * 60, id: "listen-100h" },
] as const;

let cache: HomeListeningProgress | null = null;
const listeners = new Set<() => void>();

function sanitize(raw: unknown): HomeListeningProgress {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const value = raw as Partial<HomeListeningProgress>;
  const progressByScope = value.progressByScope && typeof value.progressByScope === "object"
    ? value.progressByScope
    : {};
  return {
    version: 1,
    totalListeningSeconds: Math.max(0, Number(value.totalListeningSeconds) || 0),
    progressByScope,
    listenedVerseKeys: Array.isArray(value.listenedVerseKeys)
      ? value.listenedVerseKeys.filter((key): key is string => typeof key === "string")
      : [],
    earnedHonors: Array.isArray(value.earnedHonors)
      ? value.earnedHonors.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function readHomeListeningProgress(): HomeListeningProgress {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    cache = sanitize(JSON.parse(window.localStorage.getItem(HOME_LISTENING_PROGRESS_STORAGE_KEY) ?? "null"));
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

function write(next: HomeListeningProgress): HomeListeningProgress {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(HOME_LISTENING_PROGRESS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* localStorage 不可用时仍保留本会话内进度 */
    }
    window.dispatchEvent(new Event(HOME_LISTENING_PROGRESS_UPDATED_EVENT));
  }
  listeners.forEach((listener) => listener());
  return next;
}

function withEarnedHonors(progress: HomeListeningProgress): HomeListeningProgress {
  const honors = new Set(progress.earnedHonors);
  for (const honor of TIME_HONORS) {
    if (progress.totalListeningSeconds >= honor.seconds) honors.add(honor.id);
  }
  const completedGroups = Object.values(progress.progressByScope).reduce(
    (total, row) => total + Math.floor((row?.cursor ?? 0) / 28),
    0,
  );
  const completedStages = Object.values(progress.progressByScope).reduce(
    (total, row) => total + Math.floor((row?.cursor ?? 0) / (28 * 7)),
    0,
  );
  if (completedGroups >= 1) honors.add("journey-group-1");
  if (completedStages >= 1) honors.add("journey-stage-1");
  if (completedStages >= 3) honors.add("journey-stage-3");
  if (completedStages >= 7) honors.add("journey-stage-7");
  return { ...progress, earnedHonors: Array.from(honors) };
}

export function addHomeListeningSeconds(seconds: number): HomeListeningProgress {
  const delta = Math.max(0, Math.min(60, Number(seconds) || 0));
  if (delta <= 0) return readHomeListeningProgress();
  const current = readHomeListeningProgress();
  return write(withEarnedHonors({
    ...current,
    totalListeningSeconds: current.totalListeningSeconds + delta,
  }));
}

export function completeHomeListeningVerse(
  scope: HomeVersePoolMenuScopeId,
  verseKey: string,
  nextCursor: number,
): HomeListeningProgress {
  const current = readHomeListeningProgress();
  const previous = current.progressByScope[scope];
  const listened = new Set(current.listenedVerseKeys);
  if (verseKey) listened.add(verseKey);
  return write(withEarnedHonors({
    ...current,
    progressByScope: {
      ...current.progressByScope,
      [scope]: {
        cursor: Math.max(previous?.cursor ?? 0, Math.max(0, Math.floor(nextCursor))),
        completedPlays: (previous?.completedPlays ?? 0) + 1,
      },
    },
    listenedVerseKeys: Array.from(listened),
  }));
}

export function homeListeningCursor(scope: HomeVersePoolMenuScopeId): number {
  return Math.max(0, readHomeListeningProgress().progressByScope[scope]?.cursor ?? 0);
}

export function subscribeHomeListeningProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHomeListeningProgressSnapshot(): HomeListeningProgress {
  return readHomeListeningProgress();
}

export function getHomeListeningProgressServerSnapshot(): HomeListeningProgress {
  return EMPTY;
}
