import type { MemberReadingSyncDebugEvent } from "./memberReadingSyncDebug";

export function formatMemberReadingSyncEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const PHASE_ZH: Record<MemberReadingSyncDebugEvent["phase"], string> = {
  request: "请求",
  start: "开始",
  end: "结束",
  error: "出错",
};

const OUTCOME_ZH: Record<string, string> = {
  ok: "成功",
  offline: "离线",
  skipped: "跳过",
  unauthorized: "未登录",
};

const REASON_ZH: Record<string, string> = {
  foreground: "回到前台",
  "local-change": "本地变更",
  todayReadingDone: "今日读经",
  tripleLoopProgress: "三遍循环",
  readingPlanPrefs: "读经计划",
  todayReadingFraction: "今日进度",
  chapterCompletion: "章完成",
  habitStats: "习惯统计",
  "manual-debug": "手动同步",
};

const DETAIL_ZH: Record<string, string> = {
  "push+apply": "上传并应用",
  "pull failed": "拉取失败",
  "pull+merge+push": "拉取、合并、上传",
  "pull+merge (confirm push skipped)": "拉取合并（确认上传未成功）",
};

const API_CODE_ZH: Record<string, string> = {
  sync_not_configured: "服务端未配置同步存储",
  unauthorized: "登录已失效",
  auth_disabled: "会员功能未开放",
  invalid_request: "请求无效",
};

const BLOB_KEY_ZH: Record<string, string> = {
  todayReadingDone: "今日读经",
  todayReadingFraction: "今日进度",
  tripleLoopProgress: "三遍循环",
  readingPlanPrefs: "读经计划",
  chapterCompletion: "章完成",
  habitStats: "习惯统计",
  bookmarks: "书签",
  highlights: "高亮",
  lastPosition: "上次位置",
  recentSearches: "最近搜索",
};

function zhReason(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  return REASON_ZH[reason] ?? reason;
}

function zhDetail(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  if (DETAIL_ZH[detail]) return DETAIL_ZH[detail];
  for (const [code, label] of Object.entries(API_CODE_ZH)) {
    if (detail.includes(`[${code}]`)) {
      return detail.replace(`[${code}]`, `[${label}]`);
    }
  }
  return detail;
}

export function zhMemberReadingSyncBlobKeys(keys: string[] | undefined): string | undefined {
  if (!keys?.length) return undefined;
  return keys.map((k) => BLOB_KEY_ZH[k] ?? k).join("、");
}

export function formatMemberReadingSyncEventLine(event: MemberReadingSyncDebugEvent): string {
  const parts = [PHASE_ZH[event.phase] ?? event.phase];
  const reason = zhReason(event.reason);
  if (reason) parts.push(reason);
  if (event.outcome) {
    parts.push(`→ ${OUTCOME_ZH[event.outcome] ?? event.outcome}`);
  }
  const detail = zhDetail(event.detail);
  if (detail) parts.push(`（${detail}）`);
  if (event.blobCount != null) parts.push(`数据块:${event.blobCount}`);
  if (event.errorCount) parts.push(`错误:${event.errorCount}`);
  if (event.durationMs != null) parts.push(`${event.durationMs}毫秒`);
  return parts.join(" ");
}

export function summarizeMemberReadingSyncEvents(events: MemberReadingSyncDebugEvent[]): string {
  const latest = events[0];
  if (!latest) return "等待同步…";
  return formatMemberReadingSyncEventLine(latest);
}

export function formatMemberReadingSyncMetaTime(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
