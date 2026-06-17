import type { MemberReadingSyncBlobKey } from "./schema";
import type { MemberReadingSyncOutcome } from "./runMemberReadingSync";

export type MemberReadingSyncDebugEvent = {
  at: string;
  phase: "request" | "start" | "end" | "error";
  reason?: string;
  outcome?: MemberReadingSyncOutcome;
  detail?: string;
  blobKeys?: MemberReadingSyncBlobKey[];
  blobCount?: number;
  durationMs?: number;
  errorCount?: number;
};

const MAX_EVENTS = 40;

let events: MemberReadingSyncDebugEvent[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function isMemberReadingSyncDebugEnabled(): boolean {
  if (__DEV__) return true;
  return process.env.EXPO_PUBLIC_MEMBER_SYNC_DEBUG?.trim() === "1";
}

export function recordMemberReadingSyncDebug(event: Omit<MemberReadingSyncDebugEvent, "at">): void {
  if (!isMemberReadingSyncDebugEnabled()) return;
  events = [{ ...event, at: new Date().toISOString() }, ...events].slice(0, MAX_EVENTS);
  emit();
}

export function subscribeMemberReadingSyncDebug(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getMemberReadingSyncDebugEvents(): MemberReadingSyncDebugEvent[] {
  return events;
}

export function clearMemberReadingSyncDebugEvents(): void {
  events = [];
  emit();
}
