import { readMemberSession } from "../auth/memberSession";
import { isApplyingRemoteMemberSync } from "./readingSyncLocal";
import { recordMemberReadingSyncDebug } from "./memberReadingSyncDebug";
import {
  flushMemberReadingSyncNow,
  type MemberReadingSyncOutcome,
} from "./runMemberReadingSync";

const LOCAL_CHANGE_DEBOUNCE_MS = 1_500;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingReason: string | undefined;

/** 本地读经数据变更后请求上传（登录用户、有网时）。 */
export function notifyMemberReadingLocalChanged(reason: string): void {
  if (isApplyingRemoteMemberSync()) return;
  pendingReason = reason;
  recordMemberReadingSyncDebug({ phase: "request", reason });
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const syncReason = pendingReason;
    pendingReason = undefined;
    void (async () => {
      const session = await readMemberSession();
      if (!session?.sessionToken) return;
      await flushMemberReadingSyncNow(session.sessionToken, syncReason);
    })();
  }, LOCAL_CHANGE_DEBOUNCE_MS);
}

/** 登出前先把未发出的本地变更推上去，避免轻松读经还在 1.5s 节流里就被清掉。 */
export async function flushPendingMemberReadingLocalChanges(
  reason = "sign-out",
): Promise<MemberReadingSyncOutcome> {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingReason = undefined;
  const session = await readMemberSession();
  if (!session?.sessionToken) return "skipped";
  return flushMemberReadingSyncNow(session.sessionToken, reason);
}
