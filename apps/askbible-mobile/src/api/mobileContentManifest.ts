import AsyncStorage from "@react-native-async-storage/async-storage";
import { applyMemberRegisterEnabledFromServer } from "../auth/member-register-enabled";
import { getAskBibleBaseUrl, toAbsoluteUrl } from "../config/askbibleBaseUrl";
import { isMobileBundledOnly } from "../config/mobileBundledOnly";
import { fetchWithTimeout } from "./fetchWithTimeout";

const STORAGE_KEY = "askbible.mobile.content-manifest.v1";
const SCHEMA_VERSION = 1;

export type MobileContentManifestItem = {
  id: string;
  kind: "api-json";
  schemaVersion: number;
  url: string;
  ttlSec: number;
  fallback: "bundled" | "cache";
  optional?: boolean;
};

export type MobileContentAnnouncementLevel = "normal" | "important" | "critical";
export type MobileLocalizedField = string | { "zh-CN"?: string; en?: string };

export type MobileContentManifestAnnouncement = {
  announcementId: string;
  level: MobileContentAnnouncementLevel;
  title: MobileLocalizedField;
  body?: MobileLocalizedField;
  actionLabel?: MobileLocalizedField;
  actionUrl?: string;
  allowDismissForever?: boolean;
  snoozeHours?: number;
};

export type MobileContentManifest = {
  ok: true;
  schemaVersion: number;
  manifestVersion: string;
  flags: {
    remoteContentManifestEnabled: boolean;
    exploreCategoriesRemoteEnabled: boolean;
  };
  serverCapabilities?: {
    memberRegisterEnabled?: boolean;
  };
  items: MobileContentManifestItem[];
  announcement?: MobileContentManifestAnnouncement | null;
  generatedAt: string;
};

const bundledManifest: MobileContentManifest = {
  ok: true,
  schemaVersion: SCHEMA_VERSION,
  manifestVersion: "bundled-v1",
  flags: {
    remoteContentManifestEnabled: false,
    exploreCategoriesRemoteEnabled: false,
  },
  items: [
    {
      id: "nature-settings",
      kind: "api-json",
      schemaVersion: 2,
      url: "/api/nature/settings",
      ttlSec: 60,
      fallback: "bundled",
    },
    {
      id: "music-companion",
      kind: "api-json",
      schemaVersion: 1,
      url: "/api/music/companion",
      ttlSec: 60,
      fallback: "bundled",
    },
    {
      id: "reading-plans-registry",
      kind: "api-json",
      schemaVersion: 1,
      url: "/api/read/reading-plans/registry",
      ttlSec: 300,
      fallback: "bundled",
    },
  ],
  announcement: null,
  generatedAt: new Date(0).toISOString(),
};

function normalizeAnnouncement(
  raw: unknown,
): MobileContentManifestAnnouncement | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<MobileContentManifestAnnouncement>;
  const id = typeof data.announcementId === "string" ? data.announcementId.trim() : "";
  if (!id) return null;
  const normalizeLocalized = (field: unknown): MobileLocalizedField | undefined => {
    if (typeof field === "string") {
      const text = field.trim();
      return text.length > 0 ? text : undefined;
    }
    if (!field || typeof field !== "object") return undefined;
    const o = field as Record<string, unknown>;
    const zh = typeof o["zh-CN"] === "string" ? o["zh-CN"].trim() : "";
    const en = typeof o.en === "string" ? o.en.trim() : "";
    if (!zh && !en) return undefined;
    return { "zh-CN": zh || undefined, en: en || undefined };
  };
  const title = normalizeLocalized(data.title);
  if (!title) return null;
  const level: MobileContentAnnouncementLevel =
    data.level === "important" || data.level === "critical" ? data.level : "normal";
  return {
    announcementId: id,
    level,
    title,
    body: normalizeLocalized(data.body),
    actionLabel: normalizeLocalized(data.actionLabel),
    actionUrl:
      typeof data.actionUrl === "string" && data.actionUrl.trim().length > 0 ? data.actionUrl.trim() : undefined,
    allowDismissForever: data.allowDismissForever !== false,
    snoozeHours:
      typeof data.snoozeHours === "number" && Number.isFinite(data.snoozeHours)
        ? Math.max(1, Math.min(24 * 30, Math.floor(data.snoozeHours)))
        : undefined,
  };
}

function normalizeManifest(raw: unknown): MobileContentManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<MobileContentManifest>;
  if (data.ok !== true) return null;
  if (data.schemaVersion !== SCHEMA_VERSION) return null;
  if (!Array.isArray(data.items)) return null;
  const items = data.items.filter(
    (x): x is MobileContentManifestItem =>
      Boolean(
        x &&
          typeof x.id === "string" &&
          x.kind === "api-json" &&
          typeof x.schemaVersion === "number" &&
          typeof x.url === "string",
      ),
  );
  if (!items.length) return null;
  return {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    manifestVersion: typeof data.manifestVersion === "string" ? data.manifestVersion : "remote-v1",
    flags: {
      remoteContentManifestEnabled: Boolean(data.flags?.remoteContentManifestEnabled),
      exploreCategoriesRemoteEnabled: Boolean(data.flags?.exploreCategoriesRemoteEnabled),
    },
    serverCapabilities: {
      memberRegisterEnabled: Boolean(
        (data as { serverCapabilities?: { memberRegisterEnabled?: boolean } }).serverCapabilities
          ?.memberRegisterEnabled,
      ),
    },
    items,
    announcement: normalizeAnnouncement(data.announcement),
    generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : new Date().toISOString(),
  };
}

async function readCachedManifest(): Promise<MobileContentManifest | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw?.trim()) return null;
    return normalizeManifest(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeCachedManifest(m: MobileContentManifest): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    // ignore cache write failures
  }
}

export async function fetchMobileContentManifest(): Promise<MobileContentManifest> {
  if (isMobileBundledOnly()) {
    return bundledManifest;
  }

  const base = getAskBibleBaseUrl();
  try {
    const res = await fetchWithTimeout(toAbsoluteUrl(base, "/api/mobile/content/manifest"), {
      method: "GET",
      headers: { Accept: "application/json" },
      timeoutMs: 10_000,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const manifest = normalizeManifest(await res.json());
    if (!manifest) throw new Error("invalid manifest");
    applyMemberRegisterEnabledFromServer(Boolean(manifest.serverCapabilities?.memberRegisterEnabled));
    await writeCachedManifest(manifest);
    return manifest;
  } catch {
    const cached = await readCachedManifest();
    if (cached) return cached;
    return bundledManifest;
  }
}
