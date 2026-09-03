import type { MemberReadingSyncMeta } from "@/lib/member-reading-sync/schema";

/**
 * Native (iOS/Android) stub. The web sync module pulls in `@supabase/ssr`,
 * a browser-only client the mobile app doesn't depend on and doesn't use —
 * mobile has its own sync path under apps/askbible-mobile/src/member-sync.
 * Metro resolves this `.native.ts` file instead of the `.ts` counterpart for
 * native platforms, so the shared lib/read/* callers stay no-ops here.
 */

export type MemberReadingSyncOutcome = "ok" | "offline" | "skipped" | "unauthorized";

export const MEMBER_READING_SYNC_META_UPDATED_EVENT = "askbible:member-reading-sync-meta-updated";

export async function readMemberReadingSyncMetaWeb(): Promise<MemberReadingSyncMeta> {
  return { revision: null, lastSyncedAt: null };
}

export async function runMemberReadingSyncWeb(): Promise<MemberReadingSyncOutcome> {
  return "skipped";
}

export function scheduleMemberReadingSyncWeb(): void {}

export function flushMemberReadingSyncWebNow(): void {}

export function syncMemberReadingAfterLoginWeb(): void {}

export async function markMemberReadingSyncPullOnlyWeb(): Promise<void> {}
