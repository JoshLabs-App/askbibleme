import { NextResponse } from "next/server";
import { readMobileContentFlagsSync } from "@/lib/admin/mobile-content-flags-store";
import { resolveMemberIdentityFromRequest } from "@/lib/member-reading-sync/resolve-member-identity";
import {
  memberReadingSyncConfigured,
  readMemberReadingSyncDocument,
  upsertMemberReadingSyncDocument,
} from "@/lib/member-reading-sync/store";
import {
  isMemberReadingSyncBlobKey,
  MEMBER_READING_SYNC_SCHEMA_VERSION,
  type MemberReadingSyncPushV1,
} from "@/lib/member-reading-sync/schema";

function authDisabledResponse() {
  return NextResponse.json(
    {
      ok: false,
      schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
      error: "会员功能尚未开放。",
      code: "auth_disabled",
    },
    { status: 503 },
  );
}

function storageUnavailableResponse() {
  return NextResponse.json(
    {
      ok: false,
      schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
      error: "读经同步暂不可用，请稍后再试。",
      code: "sync_not_configured",
    },
    { status: 503 },
  );
}

function unauthorizedResponse() {
  return NextResponse.json(
    {
      ok: false,
      schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
      error: "请先登录。",
      code: "unauthorized",
    },
    { status: 401 },
  );
}

function normalizePush(body: unknown): MemberReadingSyncPushV1 | null {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  if (data.schemaVersion !== MEMBER_READING_SYNC_SCHEMA_VERSION) return null;
  if (!data.blobs || typeof data.blobs !== "object") return null;
  const blobs: MemberReadingSyncPushV1["blobs"] = {};
  for (const [key, blob] of Object.entries(data.blobs as Record<string, unknown>)) {
    if (!isMemberReadingSyncBlobKey(key)) continue;
    if (!blob || typeof blob !== "object") continue;
    const updatedAt = (blob as { updatedAt?: unknown }).updatedAt;
    if (typeof updatedAt !== "string" || !updatedAt.trim()) continue;
    blobs[key] = {
      updatedAt: updatedAt.trim(),
      value: (blob as { value?: unknown }).value ?? null,
    };
  }
  return { schemaVersion: 1, blobs };
}

export async function handleMemberReadingSyncGet(req: Request) {
  const flags = readMobileContentFlagsSync(process.cwd()).flags;
  if (!flags.memberRegisterEnabled) return authDisabledResponse();
  if (!memberReadingSyncConfigured()) return storageUnavailableResponse();

  const member = await resolveMemberIdentityFromRequest(req);
  if (!member) return unauthorizedResponse();

  const doc =
    (await readMemberReadingSyncDocument(member.id)) ??
    ({
      schemaVersion: 1,
      userId: member.id,
      revision: "0",
      updatedAt: new Date(0).toISOString(),
      blobs: {},
    } as const);

  return NextResponse.json({
    ok: true,
    schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
    revision: doc.revision,
    updatedAt: doc.updatedAt,
    blobs: doc.blobs,
  });
}

export async function handleMemberReadingSyncPost(req: Request) {
  const flags = readMobileContentFlagsSync(process.cwd()).flags;
  if (!flags.memberRegisterEnabled) return authDisabledResponse();
  if (!memberReadingSyncConfigured()) return storageUnavailableResponse();

  const member = await resolveMemberIdentityFromRequest(req);
  if (!member) return unauthorizedResponse();

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
        error: "Invalid JSON",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  const push = normalizePush(body);
  if (!push) {
    return NextResponse.json(
      {
        ok: false,
        schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
        error: "Invalid sync payload",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  const merged = await upsertMemberReadingSyncDocument(member.id, push);
  if (!merged) return storageUnavailableResponse();

  return NextResponse.json({
    ok: true,
    schemaVersion: MEMBER_READING_SYNC_SCHEMA_VERSION,
    revision: merged.revision,
    updatedAt: merged.updatedAt,
    blobs: merged.blobs,
  });
}
