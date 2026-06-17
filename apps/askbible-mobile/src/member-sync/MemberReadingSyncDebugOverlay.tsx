import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  clearMemberReadingSyncDebugEvents,
  getMemberReadingSyncDebugEvents,
  isMemberReadingSyncDebugEnabled,
  subscribeMemberReadingSyncDebug,
  type MemberReadingSyncDebugEvent,
} from "./memberReadingSyncDebug";
import { readMemberSession } from "../auth/memberSession";
import { flushMemberReadingSyncNow } from "./runMemberReadingSync";

function formatEventTime(iso: string): string {
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

function zhBlobKeys(keys: string[] | undefined): string | undefined {
  if (!keys?.length) return undefined;
  return keys.map((k) => BLOB_KEY_ZH[k] ?? k).join("、");
}
function eventLine(event: MemberReadingSyncDebugEvent): string {
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

export function MemberReadingSyncDebugOverlay() {
  const insets = useSafeAreaInsets();
  const enabled = isMemberReadingSyncDebugEnabled();
  const [events, setEvents] = useState(() => getMemberReadingSyncDebugEvents());
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    return subscribeMemberReadingSyncDebug(() => {
      setEvents(getMemberReadingSyncDebugEvents());
    });
  }, [enabled]);

  const summary = useMemo(() => {
    const latest = events[0];
    if (!latest) return "等待同步…";
    return eventLine(latest);
  }, [events]);

  if (!enabled) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 8,
        right: 8,
        top: insets.top + 4,
        zIndex: 9999,
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(20, 18, 16, 0.88)",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        <Pressable
          onPress={() => setCollapsed((v) => !v)}
          style={{ paddingHorizontal: 10, paddingVertical: 8 }}
        >
          <Text style={{ color: "#f5f0e6", fontSize: 11, fontWeight: "600" }}>读经同步</Text>
          <Text style={{ color: "#c8bfb0", fontSize: 10, marginTop: 2 }} numberOfLines={collapsed ? 2 : 1}>
            {summary}
          </Text>
        </Pressable>
        {!collapsed ? (
          <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
            {events.map((event, index) => (
              <View
                key={`${event.at}:${index}`}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: "rgba(255,255,255,0.06)",
                }}
              >
                <Text style={{ color: "#8f8678", fontSize: 9 }}>{formatEventTime(event.at)}</Text>
                <Text style={{ color: "#e8e0d4", fontSize: 10 }}>{eventLine(event)}</Text>
                {event.blobKeys?.length ? (
                  <Text style={{ color: "#a09888", fontSize: 9 }} numberOfLines={2}>
                    {zhBlobKeys(event.blobKeys) ?? event.blobKeys.join("、")}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Pressable
            onPress={() => {
              clearMemberReadingSyncDebugEvents();
            }}
            style={{ flex: 1, paddingVertical: 8, alignItems: "center" }}
          >
            <Text style={{ color: "#c8bfb0", fontSize: 10 }}>清空</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              void (async () => {
                const session = await readMemberSession();
                if (!session?.sessionToken) return;
                await flushMemberReadingSyncNow(session.sessionToken, "manual-debug");
              })();
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: "center",
              borderLeftWidth: 1,
              borderLeftColor: "rgba(255,255,255,0.08)",
            }}
          >
            <Text style={{ color: "#d4c4a8", fontSize: 10 }}>立即同步</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
