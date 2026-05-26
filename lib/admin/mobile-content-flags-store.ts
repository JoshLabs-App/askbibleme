import "server-only";
import fs from "node:fs";
import path from "node:path";

export type MobileContentFlags = {
  memberRegisterEnabled: boolean;
  remoteContentManifestEnabled: boolean;
  exploreCategoriesRemoteEnabled: boolean;
};

export type MobileContentAnnouncementLevel = "normal" | "important" | "critical";
export type MobileLocalizedField = string | { "zh-CN"?: string; en?: string };

export type MobileContentAnnouncement = {
  announcementId: string;
  level: MobileContentAnnouncementLevel;
  title: MobileLocalizedField;
  body?: MobileLocalizedField;
  actionLabel?: MobileLocalizedField;
  actionUrl?: string;
  allowDismissForever?: boolean;
  snoozeHours?: number;
};

type MobileContentFlagsFile = {
  version: 1;
  flags: MobileContentFlags;
  announcement?: MobileContentAnnouncement | null;
  updatedAt: string;
};

const REL = path.join("data", "admin", "mobile-content-flags.json");

function envOn(name: string, fallback = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function defaultsFromEnv(): MobileContentFlags {
  return {
    memberRegisterEnabled: envOn("MEMBER_REGISTER_ENABLED", false),
    remoteContentManifestEnabled: envOn("MOBILE_REMOTE_CONTENT_MANIFEST_ENABLED", true),
    exploreCategoriesRemoteEnabled: envOn("MOBILE_EXPLORE_CATEGORIES_REMOTE_ENABLED", true),
  };
}

function filePath(cwd: string): string {
  return path.join(cwd, REL);
}

function normalizeAnnouncement(raw: unknown): MobileContentAnnouncement | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const normalizeLocalized = (field: unknown): MobileLocalizedField | undefined => {
    if (typeof field === "string") {
      const text = field.trim();
      return text.length > 0 ? text : undefined;
    }
    if (!field || typeof field !== "object") return undefined;
    const data = field as Record<string, unknown>;
    const zh = typeof data["zh-CN"] === "string" ? data["zh-CN"].trim() : "";
    const en = typeof data.en === "string" ? data.en.trim() : "";
    if (!zh && !en) return undefined;
    return { "zh-CN": zh || undefined, en: en || undefined };
  };
  const announcementId = typeof o.announcementId === "string" ? o.announcementId.trim() : "";
  const title = normalizeLocalized(o.title);
  if (!announcementId || !title) return null;
  const level: MobileContentAnnouncementLevel =
    o.level === "important" || o.level === "critical" ? o.level : "normal";
  return {
    announcementId,
    level,
    title,
    body: normalizeLocalized(o.body),
    actionLabel: normalizeLocalized(o.actionLabel),
    actionUrl: typeof o.actionUrl === "string" && o.actionUrl.trim().length > 0 ? o.actionUrl.trim() : undefined,
    allowDismissForever: o.allowDismissForever !== false,
    snoozeHours:
      typeof o.snoozeHours === "number" && Number.isFinite(o.snoozeHours)
        ? Math.max(1, Math.min(24 * 30, Math.floor(o.snoozeHours)))
        : undefined,
  };
}

function normalize(raw: unknown): MobileContentFlagsFile {
  const defaults = defaultsFromEnv();
  if (!raw || typeof raw !== "object") {
    return { version: 1, flags: defaults, announcement: null, updatedAt: new Date(0).toISOString() };
  }
  const o = raw as Record<string, unknown>;
  const inFlags = (o.flags ?? {}) as Record<string, unknown>;
  return {
    version: 1,
    flags: {
      memberRegisterEnabled:
        typeof inFlags.memberRegisterEnabled === "boolean"
          ? inFlags.memberRegisterEnabled
          : defaults.memberRegisterEnabled,
      remoteContentManifestEnabled:
        typeof inFlags.remoteContentManifestEnabled === "boolean"
          ? inFlags.remoteContentManifestEnabled
          : defaults.remoteContentManifestEnabled,
      exploreCategoriesRemoteEnabled:
        typeof inFlags.exploreCategoriesRemoteEnabled === "boolean"
          ? inFlags.exploreCategoriesRemoteEnabled
          : defaults.exploreCategoriesRemoteEnabled,
    },
    announcement: normalizeAnnouncement(o.announcement),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
  };
}

export function readMobileContentFlagsSync(cwd: string): MobileContentFlagsFile {
  const file = filePath(cwd);
  if (!fs.existsSync(file)) {
    return { version: 1, flags: defaultsFromEnv(), announcement: null, updatedAt: new Date(0).toISOString() };
  }
  try {
    return normalize(JSON.parse(fs.readFileSync(file, "utf8")) as unknown);
  } catch {
    return { version: 1, flags: defaultsFromEnv(), announcement: null, updatedAt: new Date(0).toISOString() };
  }
}

export function writeMobileContentFlagsSync(
  cwd: string,
  payload: { flags: MobileContentFlags; announcement?: MobileContentAnnouncement | null },
): MobileContentFlagsFile {
  const next: MobileContentFlagsFile = {
    version: 1,
    flags: {
      memberRegisterEnabled: Boolean(payload.flags.memberRegisterEnabled),
      remoteContentManifestEnabled: Boolean(payload.flags.remoteContentManifestEnabled),
      exploreCategoriesRemoteEnabled: Boolean(payload.flags.exploreCategoriesRemoteEnabled),
    },
    announcement: normalizeAnnouncement(payload.announcement ?? null),
    updatedAt: new Date().toISOString(),
  };
  const file = filePath(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export const MOBILE_CONTENT_FLAGS_REL = REL;
