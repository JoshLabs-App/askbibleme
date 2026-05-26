import { NextResponse } from "next/server";
import {
  readMobileContentFlagsSync,
  type MobileLocalizedField,
  writeMobileContentFlagsSync,
  type MobileContentAnnouncement,
  type MobileContentFlags,
} from "@/lib/admin/mobile-content-flags-store";
import { isStudioDiskSaveAllowed } from "@/lib/studio-disk-save";

function disk403() {
  return NextResponse.json(
    {
      error:
        "未允许读/写磁盘：开发环境默认可用；生产请设置 STUDIO_ALLOW_DISK_SAVE=1、STUDIO_WRITE_SECRET，并携带 Authorization: Bearer …",
    },
    { status: 403 },
  );
}

function normalizeFlags(raw: unknown, fallback: MobileContentFlags): MobileContentFlags {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  return {
    memberRegisterEnabled:
      typeof o.memberRegisterEnabled === "boolean" ? o.memberRegisterEnabled : fallback.memberRegisterEnabled,
    remoteContentManifestEnabled:
      typeof o.remoteContentManifestEnabled === "boolean"
        ? o.remoteContentManifestEnabled
        : fallback.remoteContentManifestEnabled,
    exploreCategoriesRemoteEnabled:
      typeof o.exploreCategoriesRemoteEnabled === "boolean"
        ? o.exploreCategoriesRemoteEnabled
        : fallback.exploreCategoriesRemoteEnabled,
  };
}

function normalizeAnnouncement(
  raw: unknown,
  fallback: MobileContentAnnouncement | null,
): MobileContentAnnouncement | null {
  if (raw === null) return null;
  if (raw === undefined) return fallback;
  if (!raw || typeof raw !== "object") return fallback;
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
  if (!announcementId || !title) return fallback;
  const level = o.level === "important" || o.level === "critical" ? o.level : "normal";
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

export async function GET(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  const file = readMobileContentFlagsSync(process.cwd());
  return NextResponse.json(
    {
      ok: true,
      version: file.version,
      flags: file.flags,
      announcement: file.announcement ?? null,
      updatedAt: file.updatedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  if (!isStudioDiskSaveAllowed(req)) return disk403();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "请求体需为 JSON。" }, { status: 400 });
  }
  const current = readMobileContentFlagsSync(process.cwd());
  const next = normalizeFlags((body as Record<string, unknown>)?.flags, current.flags);
  const nextAnnouncement = normalizeAnnouncement(
    (body as Record<string, unknown>)?.announcement,
    current.announcement ?? null,
  );
  const saved = writeMobileContentFlagsSync(process.cwd(), {
    flags: next,
    announcement: nextAnnouncement,
  });
  return NextResponse.json({
    ok: true,
    version: saved.version,
    flags: saved.flags,
    announcement: saved.announcement ?? null,
    updatedAt: saved.updatedAt,
  });
}
