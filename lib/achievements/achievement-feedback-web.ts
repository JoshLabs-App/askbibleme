/**
 * 成就的「听觉 + 触觉」反馈（网页版）。与 iOS `AchievementFeedback.swift` /
 * 安卓 `AchievementFeedback.kt` 对等三写。
 *
 * 三个音效是本机合成的钟声（非谐波分音 + 指数衰减），不是游戏的电子 ding ——
 * 和羊皮卷 / 修道院的语气对齐。生成脚本见 `tools/gen-achievement-sfx.py`。
 *
 * 浏览器的两个坑：
 * - **自动播放策略**：页面还没被用户交互过时 `play()` 会被拒绝，这是正常的，
 *   吞掉即可，不要抛错也不要重试。成就都发生在用户操作之后，实际上很少撞上。
 * - **同一个 Audio 元素连播会互相掐断**：每个音效预留两个元素轮换。
 */

/**
 * `chapter` = 读完一章：木与钟之间的一记小钵。GPT 2026-09-20：
 * 「我读完这一章了」比「我获得了 200 XP」重要得多，这该是全 App 最完整的一次反馈。
 */
export type AchievementCue = "xp" | "chapter" | "earn" | "levelUp";

const SRC: Record<AchievementCue, string> = {
  xp: "/sfx/xp.m4a",
  chapter: "/sfx/chapter.m4a",
  earn: "/sfx/earn.m4a",
  levelUp: "/sfx/levelup.m4a",
};

// GPT 2026-09-20 建议木叩从 0.45 压到 0.30–0.35，免得久了变成「游戏奖励音」
const VOLUME: Record<AchievementCue, number> = {
  xp: 0.34,
  chapter: 0.72,
  earn: 0.85,
  levelUp: 0.85,
};

export const ACHIEVEMENT_SOUND_KEY = "askbible-achievement-sound-v1";

/** 默认开。读不到（隐私模式 / 禁了站点数据）也当开。 */
export function achievementSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ACHIEVEMENT_SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAchievementSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(ACHIEVEMENT_SOUND_KEY, on ? "1" : "0");
  } catch {
    /* 隐私模式下存不住就算了，不影响本次会话 */
  }
}

const pools = new Map<AchievementCue, HTMLAudioElement[]>();
const cursors = new Map<AchievementCue, number>();
/** 两次 +XP 之间的最小间隔：连读会密集触发，太密就成噪音了 */
let lastXpAt = 0;

function element(cue: AchievementCue): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  let pool = pools.get(cue);
  if (!pool) {
    pool = [0, 1].map(() => {
      const a = new Audio(SRC[cue]);
      a.preload = "auto";
      a.volume = VOLUME[cue];
      return a;
    });
    pools.set(cue, pool);
    cursors.set(cue, 0);
  }
  const i = (cursors.get(cue) ?? 0) % pool.length;
  cursors.set(cue, i + 1);
  return pool[i] ?? null;
}

/**
 * +XP 的反馈分两档（2026-09-20）：**声音标记里程碑，触感标记增量。**
 * 小额 XP（读几节、听一小段）几十秒就来一次，连着几十分钟都在响，再轻也累；
 * 但完全没反馈又会觉得「读了没记上」。所以小额只给一记轻触感、不出声，
 * 只有整章读完这种大额才出声。
 */
export function playAchievementXp(milestone: boolean): void {
  // 里程碑用小钵而不是木叩：木叩配不上「读完一章」这件事
  if (milestone) playAchievementCue("chapter");
  else playAchievementCue("xp", { silent: true });
}

/** 用户在系统里开了「减弱动态效果」：动效要收，声音不受影响（那是两种偏好） */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function playAchievementCue(
  cue: AchievementCue,
  opts: { silent?: boolean } = {},
): void {
  if (typeof window === "undefined") return;
  vibrate(cue);
  if (opts.silent || !achievementSoundEnabled()) return;
  if (cue === "xp") {
    const now = Date.now();
    if (now - lastXpAt < 280) return;
    lastXpAt = now;
  }
  const el = element(cue);
  if (!el) return;
  try {
    el.currentTime = 0;
    // 自动播放被拒是预期内的，静默吞掉
    void el.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

function vibrate(cue: AchievementCue): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  // iOS Safari 没有 vibrate，安卓 Chrome 有；失败不影响音效
  const pattern =
    cue === "xp" ? 12 : cue === "chapter" ? 22 : cue === "earn" ? 28 : [34, 70, 18, 60, 40];
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/** 预热：首次用户交互后调一次，让浏览器把音频解码好，第一声不至于迟到 */
export function warmAchievementCues(): void {
  if (typeof window === "undefined") return;
  for (const cue of ["xp", "chapter", "earn", "levelUp"] as AchievementCue[]) element(cue);
}
