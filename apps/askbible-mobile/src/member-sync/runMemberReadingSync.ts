import { isNetworkAvailable } from "../network/isNetworkAvailable";
import { readMemberSession } from "../auth/memberSession";
import { recordMemberReadingSyncDebug } from "./memberReadingSyncDebug";
import { mergeMemberReadingSyncPush } from "./mergeReadingBlobs";
import {
  pullMemberReadingSyncDetailed,
  pullMemberReadingSyncFromSupabase,
  pushMemberReadingSync,
  pushMemberReadingSyncDetailed,
  pushMemberReadingSyncToSupabase,
  readMemberReadingSyncMeta,
  rememberMemberReadingSyncError,
  writeMemberReadingSyncMeta,
} from "./memberReadingSyncApi";
import { applyMemberReadingSyncBlobs, exportLocalReadingBlobs } from "./readingSyncLocal";
import { localHasMemberReadingProgress } from "./readingSyncLocalExport";
import { readReadingPlanPrefs } from "../read/reading-plan/reading-plan-prefs";
import { clearLocalMemberReadingSyncBlobs } from "./readingSyncLocalClear";
import {
  blobsHaveMemberReadingProgress,
  decideMemberReadingSyncPath,
  shouldForcePushMemberReadingSync,
  type MemberReadingSyncPath,
} from "./memberReadingSyncOwnerPolicy";
import { localeValueWithReadingPlan, planIdFromReadingSyncBlobs } from "./readingPlanSyncSidecar";
import type { MemberReadingSyncBlobKey, MemberReadingSyncPushV1, MemberReadingSyncResponseV1 } from "./schema";

/**
 * 会员读经进度（reading plan / progress / locale 等 blob）与云端的同步驱动。
 * 职责：判断本机相对当前登录帐号处于何种“归属”状态（continue/replace/unbound，见
 *   prepareMemberReadingSyncOwner），据此选择「只拉」「只推」或「拉+合并+推」路径，
 *   并对读经计划这类强一致性字段做二次确认回读（confirmRemoteReadingPlan）。
 * 边界：不直接读写具体业务存储，只搬运 blobs；本地读写委托给 readingSyncLocal* 模块，
 *   HTTP/Supabase 调用委托给 memberReadingSyncApi。
 * 交互模块：memberReadingSyncOwnerPolicy（归属判定与路径决策）、mergeReadingBlobs（三方合并）、
 *   memberReadingSyncDebug（结构化调试日志，排障时优先看这里的 phase/outcome/detail）。
 * 模块级可变状态（syncInFlight / lastSyncStartedAt）实现了「同一时刻只跑一份同步 +
 * 30s 节流 + 排队再推一次」的调度策略，见文件尾 scheduleMemberReadingSync /
 * flushMemberReadingSyncNow 及其上方注释。
 */
export type MemberReadingSyncOutcome = "ok" | "offline" | "skipped" | "unauthorized";

function formatSyncApiFailure(
  label: string,
  response: MemberReadingSyncResponseV1 | null,
  httpStatus: number | null,
): string {
  if (response?.error?.trim()) {
    const code = response.code ? `[${response.code}] ` : "";
    return `${label}: ${code}${response.error.trim()}`;
  }
  if (response?.code) return `${label}: [${response.code}]`;
  if (httpStatus != null) return `${label}: HTTP ${httpStatus}`;
  return `${label}: 网络或响应异常`;
}

// 全局单例状态：本文件所有导出函数共享同一份同步任务队列/节流时钟，
// 防止并发触发（如登录 + 前台唤醒同时发起）导致的重复推送/合并竞态。
let syncInFlight: Promise<MemberReadingSyncOutcome> | null = null;
let pendingFlushReason: string | undefined;
let lastSyncStartedAt = 0;
const MIN_SYNC_INTERVAL_MS = 30_000;

async function mergeAndApply(
  remoteBlobs: MemberReadingSyncPushV1["blobs"] | undefined,
  localPush: MemberReadingSyncPushV1,
  _forceLocalPlan = false,
): Promise<MemberReadingSyncPushV1["blobs"]> {
  // 网络往返期间本地可能已改（如 aheadDays）；用最新本地再合并，避免旧快照盖回。
  const freshLocal = await exportLocalReadingBlobs();
  const merged = mergeMemberReadingSyncPush(
    mergeMemberReadingSyncPush(remoteBlobs, localPush),
    freshLocal,
  );
  await applyMemberReadingSyncBlobs(merged);
  return merged;
}

function blobKeys(push: MemberReadingSyncPushV1): MemberReadingSyncBlobKey[] {
  return Object.keys(push.blobs ?? {}) as MemberReadingSyncBlobKey[];
}

function planIdFromBlobs(
  blobs: MemberReadingSyncPushV1["blobs"] | undefined,
): string | null {
  return planIdFromReadingSyncBlobs(blobs);
}

function planPrefsFromBlobs(
  blobs: MemberReadingSyncPushV1["blobs"] | undefined,
): NonNullable<Awaited<ReturnType<typeof readReadingPlanPrefs>>> | null {
  const value = blobs?.readingPlanPrefs?.value;
  if (!value || typeof value !== "object") return null;
  const planId = (value as { planId?: unknown }).planId;
  if (typeof planId !== "string" || !planId.trim()) return null;
  return value as NonNullable<Awaited<ReturnType<typeof readReadingPlanPrefs>>>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stampedReadingPlanPush(
  storedPlan: NonNullable<Awaited<ReturnType<typeof readReadingPlanPrefs>>>,
  locale: unknown = null,
): MemberReadingSyncPushV1 {
  const stampedAt = new Date().toISOString();
  // 不伪造 selectedAt：切换计划才写入该戳。其它设备同步旧计划时若补「现在」，会盖掉真正的切换。
  const value = {
    ...storedPlan,
    chosen: true,
    ...(storedPlan.selectedAt ? { selectedAt: storedPlan.selectedAt } : {}),
    ntDeepRepeatPace: storedPlan.ntDeepRepeatPace ?? 7,
  };
  return {
    schemaVersion: 1,
    blobs: {
      readingPlanPrefs: {
        updatedAt: stampedAt,
        value,
      },
      appLocale: {
        updatedAt: stampedAt,
        value: localeValueWithReadingPlan(locale, value),
      },
    },
  };
}

// 推送后云端未必已经可读到最新计划（写入/CDN 传播延迟）；主动回读确认，
// 若不一致就重推一次并轮询最多 3 次（每次间隔 400ms）等云端收敛，
// 避免用户切换计划后其他设备读到旧计划。
async function confirmRemoteReadingPlan(
  sessionToken: string,
  expectedPlanId: string,
  storedPlan: NonNullable<Awaited<ReturnType<typeof readReadingPlanPrefs>>>,
): Promise<boolean> {
  const readPlan = async () => {
    const fromSupabase = await pullMemberReadingSyncFromSupabase(sessionToken);
    if (fromSupabase.response?.ok) return fromSupabase;
    if (fromSupabase.response?.code === "unauthorized") return fromSupabase;
    return pullMemberReadingSyncDetailed(sessionToken);
  };

  const first = await readPlan();
  if (planIdFromBlobs(first.response?.blobs) === expectedPlanId) return true;

  const retryPush = stampedReadingPlanPush(storedPlan);
  const supabaseWrite = await pushMemberReadingSyncToSupabase(sessionToken, retryPush);
  if (!supabaseWrite.response?.ok) {
    const siteWrite = await pushMemberReadingSync(sessionToken, retryPush);
    if (!siteWrite?.ok) return false;
  }

  for (let i = 0; i < 3; i += 1) {
    await sleep(400);
    const again = await readPlan();
    if (planIdFromBlobs(again.response?.blobs) === expectedPlanId) return true;
  }
  return false;
}

type SyncOwnerMode = "continue" | "replace" | "unbound";

function pullOnlyDetail(path: MemberReadingSyncPath): string {
  if (path === "pull-only-reinstall") return "pull-only (reinstall)";
  if (path === "pull-only-empty") return "pull-only (empty local)";
  return "pull-only (account switch)";
}

/**
 * 绑定本机同步数据到当前会员。
 * - 换帐号：清空上一帐号本地数据，随后只拉云端。拉取成功前不要写成已绑定。
 * - 登出后再次登录：只拉云端；拉取失败时保留 requirePullOnly，避免下次把空默认值推上去。
 * - 未绑定（卸载重装会丢掉 meta）：先看云端，有进度则只拉，禁止把空默认值当「游客升级」推上去。
 * - 已绑定同一帐号：增量合并。
 */
async function prepareMemberReadingSyncOwner(userId: string): Promise<SyncOwnerMode> {
  const meta = await readMemberReadingSyncMeta();
  if (meta.boundUserId === userId && !meta.requirePullOnly) return "continue";

  if (meta.boundUserId != null && meta.boundUserId !== userId) {
    await clearLocalMemberReadingSyncBlobs();
    await writeMemberReadingSyncMeta({
      revision: null,
      lastSyncedAt: null,
      boundUserId: null,
      requirePullOnly: true,
      lastError: null,
    });
    return "replace";
  }

  if (meta.requirePullOnly) return "replace";

  // boundUserId == null：卸载重装或本机首次登录。先不要写成已绑定。
  return "unbound";
}

async function applyPulledReadingSync(
  sessionToken: string,
  userId: string,
  reason: string | undefined,
  started: number,
  pulled: MemberReadingSyncResponseV1,
  detail: string,
): Promise<MemberReadingSyncOutcome> {
  const session = await readMemberSession();
  if (!session || session.sessionToken !== sessionToken || session.user.id !== userId) {
    recordMemberReadingSyncDebug({
      phase: "end",
      reason,
      outcome: "skipped",
      detail: "session changed during pull-only",
      durationMs: Date.now() - started,
      errorCount: 1,
    });
    await rememberMemberReadingSyncError("同步中途登录状态已变化");
    return "skipped";
  }

  await applyMemberReadingSyncBlobs(pulled.blobs ?? {});
  const meta = await readMemberReadingSyncMeta();
  await writeMemberReadingSyncMeta({
    ...meta,
    revision: pulled.revision ?? null,
    lastSyncedAt: new Date().toISOString(),
    boundUserId: userId,
    requirePullOnly: false,
    lastError: null,
  });
  recordMemberReadingSyncDebug({
    phase: "end",
    reason,
    outcome: "ok",
    detail,
    blobKeys: Object.keys(pulled.blobs ?? {}) as MemberReadingSyncBlobKey[],
    blobCount: Object.keys(pulled.blobs ?? {}).length,
    durationMs: Date.now() - started,
    errorCount: 0,
  });
  return "ok";
}

async function pullAndApplyRemoteOnly(
  sessionToken: string,
  userId: string,
  reason: string | undefined,
  started: number,
  detail = "pull-only (account switch)",
): Promise<MemberReadingSyncOutcome> {
  const pullResult = await pullMemberReadingSyncDetailed(sessionToken);
  const pulled = pullResult.response;
  if (!pulled?.ok) {
    recordMemberReadingSyncDebug({
      phase: "end",
      reason,
      outcome: pulled?.code === "unauthorized" ? "unauthorized" : "skipped",
      detail: formatSyncApiFailure("帐号切换后拉取失败", pulled, pullResult.httpStatus),
      durationMs: Date.now() - started,
      errorCount: 1,
    });
    await rememberMemberReadingSyncError(
      formatSyncApiFailure("帐号切换后拉取失败", pulled, pullResult.httpStatus),
    );
    return pulled?.code === "unauthorized" ? "unauthorized" : "skipped";
  }

  return applyPulledReadingSync(sessionToken, userId, reason, started, pulled, detail);
}

export async function runMemberReadingSync(
  sessionToken: string,
  reason?: string,
): Promise<MemberReadingSyncOutcome> {
  const started = Date.now();
  recordMemberReadingSyncDebug({ phase: "start", reason });

  if (!(await isNetworkAvailable())) {
    recordMemberReadingSyncDebug({
      phase: "end",
      reason,
      outcome: "offline",
      durationMs: Date.now() - started,
    });
    await rememberMemberReadingSyncError("当前无网络");
    return "offline";
  }

  try {
    const session = await readMemberSession();
    const userId = session?.user?.id?.trim();
    if (!userId || session?.sessionToken !== sessionToken) {
      recordMemberReadingSyncDebug({
        phase: "end",
        reason,
        outcome: "skipped",
        detail: "missing user session",
        durationMs: Date.now() - started,
        errorCount: 1,
      });
      await rememberMemberReadingSyncError("未找到登录会话");
      return "skipped";
    }

    const ownerMode = await prepareMemberReadingSyncOwner(userId);
    const localHasProgress = await localHasMemberReadingProgress();
    const storedPlan = await readReadingPlanPrefs();
    // forcePush：某些触发原因（如用户刚手动选了计划）必须确保推上去，
    // 即便按归属策略本该是「只拉」，也要在有本地进度/计划时改走推送路径。
    const forcePush = shouldForcePushMemberReadingSync(reason);
    const forcePushPlan = forcePush && Boolean(storedPlan?.planId);

    if (ownerMode === "replace" && !(forcePush && (localHasProgress || forcePushPlan))) {
      return await pullAndApplyRemoteOnly(sessionToken, userId, reason, started);
    }

    if (ownerMode === "unbound") {
      const pullResult = await pullMemberReadingSyncDetailed(sessionToken);
      const pulled = pullResult.response;
      if (!pulled?.ok) {
        recordMemberReadingSyncDebug({
          phase: "end",
          reason,
          outcome: pulled?.code === "unauthorized" ? "unauthorized" : "skipped",
          detail: formatSyncApiFailure("未绑定先拉取失败", pulled, pullResult.httpStatus),
          durationMs: Date.now() - started,
          errorCount: 1,
        });
        await rememberMemberReadingSyncError(
          formatSyncApiFailure("未绑定先拉取失败", pulled, pullResult.httpStatus),
        );
        return pulled?.code === "unauthorized" ? "unauthorized" : "skipped";
      }

      const path = decideMemberReadingSyncPath({
        boundUserId: null,
        requirePullOnly: false,
        userId,
        remoteHasProgress: blobsHaveMemberReadingProgress(pulled.blobs),
        localHasProgress,
        forcePush,
      });
      if (path === "pull-only-reinstall" || path === "pull-only-empty") {
        return applyPulledReadingSync(
          sessionToken,
          userId,
          reason,
          started,
          pulled,
          pullOnlyDetail(path),
        );
      }

      // 云端无进度、本机有进度：游客升级，可以推本地。
      await writeMemberReadingSyncMeta({
        revision: pulled.revision ?? null,
        lastSyncedAt: null,
        boundUserId: userId,
        requirePullOnly: false,
        lastError: null,
      });
    } else if (!localHasProgress && !forcePushPlan) {
      return await pullAndApplyRemoteOnly(
        sessionToken,
        userId,
        reason,
        started,
        "pull-only (empty local)",
      );
    }

    const localPush = await exportLocalReadingBlobs();
    const latestPlan = (await readReadingPlanPrefs()) ?? storedPlan;
    if (forcePushPlan && latestPlan) {
      const stamped = stampedReadingPlanPush(latestPlan, localPush.blobs.appLocale?.value);
      localPush.blobs.readingPlanPrefs = stamped.blobs.readingPlanPrefs;
      localPush.blobs.appLocale = stamped.blobs.appLocale;
    }
    const localKeys = blobKeys(localPush);
    const pushResult = await pushMemberReadingSyncDetailed(sessionToken, localPush);
    const pushed = pushResult.response;

    if (pushed?.ok && pushed.blobs) {
      const merged = await mergeAndApply(pushed.blobs, localPush, forcePush);
      // 首推成功后必须再确认一次（confirm push）：
      // 若同步期间本地又改过，把合并结果再推上去，避免服务端仍留着旧 aheadDays=0
      const confirm = await pushMemberReadingSync(sessionToken, { schemaVersion: 1, blobs: merged });
      if (!confirm?.ok) {
        await rememberMemberReadingSyncError(
          formatSyncApiFailure("合并后再次上传失败", confirm, null),
        );
        recordMemberReadingSyncDebug({
          phase: "end",
          reason,
          outcome: "skipped",
          detail: "push+apply (confirm push failed)",
          blobKeys: localKeys,
          blobCount: localKeys.length,
          durationMs: Date.now() - started,
          errorCount: 1,
        });
        return "skipped";
      }
      const meta = await readMemberReadingSyncMeta();
      await writeMemberReadingSyncMeta({
        ...meta,
        revision: confirm.revision ?? pushed.revision ?? null,
        lastSyncedAt: new Date().toISOString(),
        boundUserId: userId,
        requirePullOnly: false,
        lastError: null,
      });
      const appliedPlan = planPrefsFromBlobs(merged);
      if (forcePushPlan && appliedPlan && !(await confirmRemoteReadingPlan(sessionToken, appliedPlan.planId, appliedPlan))) {
        if (reason !== "sign-out") {
          await rememberMemberReadingSyncError("读经计划尚未上传到云端");
          recordMemberReadingSyncDebug({
            phase: "end",
            reason,
            outcome: "skipped",
            detail: "push+apply (remote plan mismatch)",
            blobKeys: localKeys,
            blobCount: localKeys.length,
            durationMs: Date.now() - started,
            errorCount: 1,
          });
          return "skipped";
        }
      }
      recordMemberReadingSyncDebug({
        phase: "end",
        reason,
        outcome: "ok",
        detail: "push+apply",
        blobKeys: localKeys,
        blobCount: localKeys.length,
        durationMs: Date.now() - started,
        errorCount: 0,
      });
      return "ok";
    }

    if (pushed?.code === "unauthorized") {
      recordMemberReadingSyncDebug({
        phase: "end",
        reason,
        outcome: "unauthorized",
        durationMs: Date.now() - started,
        errorCount: 1,
      });
      await rememberMemberReadingSyncError("登录已失效，请重新登录");
      return "unauthorized";
    }

    const pullResult = await pullMemberReadingSyncDetailed(sessionToken);
    const pulled = pullResult.response;
    if (!pulled?.ok) {
      recordMemberReadingSyncDebug({
        phase: "end",
        reason,
        outcome: pulled?.code === "unauthorized" ? "unauthorized" : "skipped",
        detail: formatSyncApiFailure("拉取失败", pulled, pullResult.httpStatus),
        durationMs: Date.now() - started,
        errorCount: 1,
      });
      await rememberMemberReadingSyncError(
        formatSyncApiFailure("拉取失败", pulled, pullResult.httpStatus),
      );
      return pulled?.code === "unauthorized" ? "unauthorized" : "skipped";
    }

    const merged = await mergeAndApply(pulled.blobs, localPush, forcePush);
    const confirm = await pushMemberReadingSync(sessionToken, { schemaVersion: 1, blobs: merged });
    const meta = await readMemberReadingSyncMeta();
    if (confirm?.ok) {
      const appliedPlan = planPrefsFromBlobs(merged);
      if (forcePushPlan && appliedPlan && !(await confirmRemoteReadingPlan(sessionToken, appliedPlan.planId, appliedPlan))) {
        if (reason !== "sign-out") {
          await rememberMemberReadingSyncError("读经计划尚未上传到云端");
          recordMemberReadingSyncDebug({
            phase: "end",
            reason,
            outcome: "skipped",
            detail: "pull+merge+push (remote plan mismatch)",
            blobKeys: Object.keys(merged) as MemberReadingSyncBlobKey[],
            blobCount: Object.keys(merged).length,
            durationMs: Date.now() - started,
            errorCount: 1,
          });
          return "skipped";
        }
      }
      await writeMemberReadingSyncMeta({
        ...meta,
        revision: confirm.revision ?? pulled.revision ?? null,
        lastSyncedAt: new Date().toISOString(),
        boundUserId: userId,
        requirePullOnly: false,
        lastError: null,
      });
      recordMemberReadingSyncDebug({
        phase: "end",
        reason,
        outcome: "ok",
        detail: "pull+merge+push",
        blobKeys: Object.keys(merged) as MemberReadingSyncBlobKey[],
        blobCount: Object.keys(merged).length,
        durationMs: Date.now() - started,
        errorCount: 0,
      });
      return "ok";
    }

    await rememberMemberReadingSyncError(
      formatSyncApiFailure("合并后再次上传失败", confirm, null),
    );
    recordMemberReadingSyncDebug({
      phase: "end",
      reason,
      outcome: "skipped",
      detail: "pull+merge (confirm push failed)",
      blobKeys: Object.keys(merged) as MemberReadingSyncBlobKey[],
      blobCount: Object.keys(merged).length,
      durationMs: Date.now() - started,
      errorCount: 1,
    });
    return "skipped";
  } catch (err) {
    recordMemberReadingSyncDebug({
      phase: "error",
      reason,
      outcome: "skipped",
      detail: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
      errorCount: 1,
    });
    await rememberMemberReadingSyncError(err instanceof Error ? err.message : String(err));
    return "skipped";
  }
}

export function scheduleMemberReadingSync(sessionToken: string, reason = "foreground"): void {
  const now = Date.now();
  if (syncInFlight || now - lastSyncStartedAt < MIN_SYNC_INTERVAL_MS) return;
  lastSyncStartedAt = now;
  recordMemberReadingSyncDebug({ phase: "request", reason });
  syncInFlight = runMemberReadingSync(sessionToken, reason)
    .catch(() => "skipped" as const)
    .finally(() => {
      syncInFlight = null;
    });
}

/** 登出前等待进行中的同步结束，避免清空后把空默认值推回云端。 */
export async function awaitMemberReadingSyncIdle(): Promise<void> {
  if (!syncInFlight) return;
  try {
    await syncInFlight;
  } catch {
    /* ignore */
  }
}

/** 本地数据变更或手动刷新：跳过 30s 节流；若已有同步在跑，结束后用最新本地再推一次。 */
export async function flushMemberReadingSyncNow(
  sessionToken: string,
  reason = "local-change",
): Promise<MemberReadingSyncOutcome> {
  if (syncInFlight) {
    // 已有同步在跑：记下这次的 reason，等它结束后立即用最新本地状态再跑一轮
    // （递归调用而非排队多次，pendingFlushReason 被消费后清空即代表本轮已处理）。
    pendingFlushReason = reason;
    const inFlight = await syncInFlight;
    if (!pendingFlushReason) return inFlight;
    const again = pendingFlushReason;
    pendingFlushReason = undefined;
    return flushMemberReadingSyncNow(sessionToken, again);
  }
  lastSyncStartedAt = 0;
  const run = runMemberReadingSync(sessionToken, reason).finally(() => {
    if (syncInFlight === run) syncInFlight = null;
    lastSyncStartedAt = Date.now();
  });
  syncInFlight = run;
  return run;
}
