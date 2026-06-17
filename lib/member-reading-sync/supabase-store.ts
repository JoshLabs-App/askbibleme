import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { MemberReadingSyncDocumentV1, MemberReadingSyncPushV1 } from "./schema";
import { mergeMemberReadingSyncDocuments } from "./merge";

type Row = {
  user_id: string;
  schema_version: number;
  revision: string;
  updated_at: string;
  blobs: Record<string, unknown>;
};

function rowToDocument(row: Row): MemberReadingSyncDocumentV1 {
  return {
    schemaVersion: 1,
    userId: row.user_id,
    revision: row.revision,
    updatedAt: row.updated_at,
    blobs: (row.blobs ?? {}) as MemberReadingSyncDocumentV1["blobs"],
  };
}

export function memberReadingSyncSupabaseConfigured(): boolean {
  return getSupabaseAdmin() != null;
}

export async function readMemberReadingSyncDocumentFromSupabase(
  userId: string,
): Promise<MemberReadingSyncDocumentV1 | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("member_reading_sync_documents")
    .select("user_id, schema_version, revision, updated_at, blobs")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToDocument(data as Row);
}

export async function upsertMemberReadingSyncDocumentToSupabase(
  userId: string,
  push: MemberReadingSyncPushV1,
): Promise<MemberReadingSyncDocumentV1 | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const existing = await readMemberReadingSyncDocumentFromSupabase(userId);
  const merged = mergeMemberReadingSyncDocuments(userId, existing, push);
  const { error } = await admin.from("member_reading_sync_documents").upsert(
    {
      user_id: userId,
      schema_version: 1,
      revision: merged.revision,
      updated_at: merged.updatedAt,
      blobs: merged.blobs,
    },
    { onConflict: "user_id" },
  );
  if (error) return null;
  return merged;
}
