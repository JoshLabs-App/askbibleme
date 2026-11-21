import {
  purgeOfflineCachesForBuildUpdate,
  refreshServiceWorkerRegistration,
  skipWaitingServiceWorker,
} from "@/lib/pwa/sw-client";

export const ASKBIBLE_MANUAL_CHECK_EVENT = "askbible:manual-check-updates";
export const ASKBIBLE_UPDATE_APPLIED_EVENT = "askbible:trigger-update-reload";

export type RemoteBuildMeta = {
  id: string;
  builtAt?: string;
};

/** 本地开发或未写入构建 id 时跳过强制刷新，避免误报 */
export function shouldSkipBuildId(id: string | null | undefined): boolean {
  const v = (id ?? "").trim();
  return v.length === 0 || v === "development" || v === "unknown";
}

export function formatShortBuildId(raw: string | null | undefined): string {
  const id = (raw ?? "").trim();
  if (!id || id === "development" || id === "unknown") return "Web · dev";
  if (id.length <= 10) return `Web · ${id}`;
  return `Web · ${id.slice(0, 8)}`;
}

export function formatLocalDateTime(input?: string | Date | null): string {
  const date =
    input instanceof Date
      ? input
      : typeof input === "string" && input.trim().length > 0
        ? new Date(input)
        : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatBuildVersionWithTime(
  rawId: string | null | undefined,
  builtAt?: string | null,
): string {
  const short = formatShortBuildId(rawId);
  const timeText = builtAt ? formatLocalDateTime(builtAt) : "";
  return timeText ? `${short} · ${timeText}` : short;
}

export function getLoadedBuildId(): string {
  if (typeof document === "undefined") return "";
  return document.body?.getAttribute("data-app-build")?.trim() ?? "";
}

export function getLoadedBuiltAt(): string {
  if (typeof document === "undefined") return "";
  return document.body?.getAttribute("data-app-built-at")?.trim() ?? "";
}

export async function fetchRemoteBuildMeta(
  fetchImpl: typeof fetch = fetch,
): Promise<RemoteBuildMeta | null> {
  try {
    const r1 = await fetchImpl("/app-build.json", { cache: "no-store" });
    if (r1.ok) {
      const j = (await r1.json()) as { id?: string; builtAt?: string };
      const v = j.id?.trim() ?? "";
      if (v) return { id: v, builtAt: j.builtAt?.trim() || undefined };
    }
  } catch {
    /* ignore */
  }
  try {
    const r2 = await fetchImpl("/api/app-build", { cache: "no-store" });
    if (!r2.ok) return null;
    const data = (await r2.json()) as { id?: string; builtAt?: string };
    const v = data.id?.trim() ?? "";
    return v ? { id: v, builtAt: data.builtAt?.trim() || undefined } : null;
  } catch {
    return null;
  }
}

export async function fetchRemoteBuildId(
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const meta = await fetchRemoteBuildMeta(fetchImpl);
  return meta?.id ?? null;
}

export type WebUpdateCheckOutcome =
  | { status: "update-available"; remoteId: string; loadedId: string; builtAt?: string }
  | { status: "up-to-date"; buildId: string; builtAt?: string }
  | { status: "failed" };

export async function checkWebBuildUpdate(options?: {
  loadedId?: string;
  fetchImpl?: typeof fetch;
}): Promise<WebUpdateCheckOutcome> {
  void refreshServiceWorkerRegistration();
  const loaded = (options?.loadedId ?? getLoadedBuildId()).trim();
  const remote = await fetchRemoteBuildMeta(options?.fetchImpl);
  if (!remote) {
    return { status: "failed" };
  }
  if (!shouldSkipBuildId(loaded) && !shouldSkipBuildId(remote.id) && remote.id !== loaded) {
    return {
      status: "update-available",
      remoteId: remote.id,
      loadedId: loaded,
      builtAt: remote.builtAt,
    };
  }
  return {
    status: "up-to-date",
    buildId: remote.id || loaded || "development",
    builtAt: remote.builtAt || getLoadedBuiltAt() || undefined,
  };
}

export function triggerWebBuildReload(delayMs = 900): void {
  void purgeOfflineCachesForBuildUpdate();
  void skipWaitingServiceWorker();
  void refreshServiceWorkerRegistration();
  if (typeof window === "undefined") return;
  const handled = !window.dispatchEvent(
    new CustomEvent(ASKBIBLE_UPDATE_APPLIED_EVENT, {
      cancelable: true,
      detail: { delayMs },
    }),
  );
  if (!handled) {
    window.setTimeout(() => {
      window.location.reload();
    }, delayMs);
  }
}
