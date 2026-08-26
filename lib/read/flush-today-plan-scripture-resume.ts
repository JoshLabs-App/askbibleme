import { normalizeMusicResumeSec } from "@/lib/music/music-resume-sec";
import { readPlanFlowActive } from "@/lib/read/plan-flow-session";
import { resolveLocalTodayReadingScopeKey } from "@/lib/read/today-reading-done";
import { writeTodayPlanScriptureResume } from "@/lib/read/today-plan-scripture-resume";

type FlushArgs = {
  bookId?: string;
  chapter?: number;
  positionSec?: number;
  durationSec?: number;
};

/** 暂停 / 切后台：写入今日 planFlow 播放进度。 */
export function flushTodayPlanScriptureResume(args: FlushArgs = {}): void {
  if (!readPlanFlowActive()) return;

  const bookId = args.bookId?.trim().toUpperCase();
  const chapter = args.chapter;
  if (!bookId || chapter == null || chapter < 1) return;

  const positionSec = normalizeMusicResumeSec(
    args.positionSec ?? 0,
    args.durationSec,
  );

  writeTodayPlanScriptureResume({
    scopeKey: resolveLocalTodayReadingScopeKey(),
    bookId,
    chapter,
    positionSec,
  });
}
