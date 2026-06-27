import { readMemberSession } from "../auth/memberSession";
import { isApplyingRemoteMemberSync } from "./readingSyncLocal";
import { recordMemberReadingSyncDebug } from "./memberReadingSyncDebug";
import { flushMemberReadingSyncNow } from "./runMemberReadingSync";

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
