import { getActiveReadChapterPlayback } from "./read-chapter-playback-store";
import { getScripturePlaybackSecSnapshot } from "../music/scripturePlaybackSec";
import { scriptureChapterPool } from "../music/scripture-chapter-pool";
import { isPlanFlowSessionActive } from "./read-plan-flow-autoplay";
import {
  resolveLocalTodayReadingScopeKey,
} from "./reading-plan/today-reading-done";
import { writeTodayPlanScriptureResume } from "./today-plan-scripture-resume";
import { normalizeMusicResumeSec } from "../music/music-playback-prefs";

type FlushArgs = {
  bookId?: string;
  chapter?: number;
  positionSec?: number;
  durationSec?: number;
};

/** 暂停 / 切后台 / 杀进程前：写入今日 planFlow 播放进度（仅池或 planFlow 会话 active 时）。 */
export async function flushTodayPlanScriptureResume(args: FlushArgs = {}): Promise<void> {
  if (!scriptureChapterPool.isActive() && !isPlanFlowSessionActive()) return;

  const rc = getActiveReadChapterPlayback();
  const bookId = (args.bookId ?? rc?.bookId)?.trim().toUpperCase();
  const chapter = args.chapter ?? rc?.chapter;
  if (!bookId || chapter == null || chapter < 1) return;

  const positionSec = normalizeMusicResumeSec(
    args.positionSec ?? getScripturePlaybackSecSnapshot(),
    args.durationSec,
  );

  const scopeKey = await resolveLocalTodayReadingScopeKey();
  await writeTodayPlanScriptureResume({
    scopeKey,
    bookId,
    chapter,
    positionSec,
  });
}
