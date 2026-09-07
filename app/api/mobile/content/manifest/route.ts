import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  readMobileContentFlagsSync,
  type MobileContentAnnouncement,
} from "@/lib/admin/mobile-content-flags-store";
import { isMemberAuthBackendConfigured } from "@/lib/member-auth-backend";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export const runtime = "nodejs";

const SCHEMA_VERSION = 1;

type ManifestItem = {
  id: string;
  kind: "api-json";
  schemaVersion: number;
  url: string;
  ttlSec: number;
  fallback: "bundled" | "cache";
  optional?: boolean;
};

function buildItems(): ManifestItem[] {
  return [
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
    {
      id: "explore-featured-articles",
      kind: "api-json",
      schemaVersion: 1,
      url: "/api/mobile/explore/featured-articles",
      ttlSec: 86400,
      fallback: "bundled",
    },
    {
      id: "explore-legacy-figures",
      kind: "api-json",
      schemaVersion: 2,
      url: "/api/mobile/explore/legacy-figures",
      ttlSec: 86400,
      fallback: "bundled",
    },
    {
      id: "explore-modules",
      kind: "api-json",
      schemaVersion: 1,
      url: "/api/mobile/explore/modules",
      ttlSec: 86400,
      fallback: "bundled",
    },
    {
      id: "mobile-content-flags",
      kind: "api-json",
      schemaVersion: 1,
      url: "/api/mobile/content/flags",
      ttlSec: 30,
      fallback: "cache",
    },
  ];
}

function manifestVersion(
  items: ManifestItem[],
  flags: Record<string, boolean>,
  announcement: MobileContentAnnouncement | null,
): string {
  const h = createHash("sha256");
  h.update(JSON.stringify({ schemaVersion: SCHEMA_VERSION, items, flags, announcement }));
  return `mcm-v1-${h.digest("hex").slice(0, 16)}`;
}

export async function GET() {
  const cfg = readMobileContentFlagsSync(process.cwd());
  const enabled = cfg.flags.remoteContentManifestEnabled;
  const infoEditionDiskSaveEnabled =
    process.env.INFO_EDITION_DISK_SAVE === "1" &&
    ((process.env.DATA_ROOT?.trim()?.length ?? 0) > 0 ||
      (process.env.INFO_EDITION_DATA_DIR?.trim()?.length ?? 0) > 0);
  const flags = {
    remoteContentManifestEnabled: enabled,
    exploreCategoriesRemoteEnabled: cfg.flags.exploreCategoriesRemoteEnabled,
  };

  const items = buildItems();
  const payload = {
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    manifestVersion: manifestVersion(items, flags, cfg.announcement ?? null),
    flags,
    serverCapabilities: {
      /**
       * 反馈与内容纠错都由客户端直写 Supabase（insert-only RLS），与 Render 持久盘无关。
       * 此处原先按 DATA_ROOT 是否存在判断，磁盘退役后会误报 false 而让 App 收起反馈入口。
       */
      feedbackEnabled: isSupabaseAuthConfigured(),
      telemetryEnabled: false,
      memberRegisterEnabled:
        cfg.flags.memberRegisterEnabled && isMemberAuthBackendConfigured(),
      infoEditionDiskSaveEnabled,
    },
    items,
    announcement: cfg.announcement ?? null,
    updatedAt: cfg.updatedAt,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}
