import { scriptureBooks } from "@/lib/bible/scripture-books";
import type { MusicAlbumRepeatMode } from "@/lib/music/album-playback";
import type { MusicCompanionStore } from "@/lib/music-companion/types";

/** 和合本整章经朗读结束后的行为（仅对 CUV 章节 MP3 生效） */
export type ScriptureAudioRepeatMode = "off" | "chapter" | "book";

/** 全局定时停止：0 为关闭；墙钟到时暂停壳层音乐（不关屏、不锁机），并调用已注册的额外暂停（历史：自然混音等） */
export type MusicShellSleepTimerMinutes = 0 | 15 | 30 | 60 | 120;

export type DeviceLibraryPlaybackInfo = {
  trackId: string;
  /** 导入曲库可跨页恢复；仅本次打开的本地文件不写入恢复存储 */
  persistResume: boolean;
};

export type DevicePlaybackCell = {
  trackId: string;
  objectUrl: string;
  persistResume: boolean;
};

export type ShellPlaybackRestorePlan = {
  targetSrc: string;
  timeSec: number;
  tryPlay: boolean;
};

export type ScriptureListenTarget = {
  bookId: string;
  chapter: number;
  src: string;
};

export type MusicShellPlaybackValue = {
  /** 壳层曲库是否有可播音乐（与是否正在播经文无关） */
  canPlayMusic: boolean;
  canPlay: boolean;
  playing: boolean;
  loading: boolean;
  /** 读经章快捷栏：整章朗读 */
  togglePlayScripture: () => void;
  /** 章页 / 计划坞：按书卷章开播 */
  playScriptureChapter: (target: {
    bookId: string;
    chapter: number;
    bookName?: string;
    translationId?: string;
    startAtSec?: number;
  }) => Promise<void>;
  /** 下一章（经朗读） */
  skipScriptureNext: () => Promise<void>;
  /** 暂停经朗读（保留会话，便于续播） */
  pauseScripturePlayback: () => void;
  /** 经朗读倍速 */
  scripturePlaybackRate: number;
  setScripturePlaybackRate: (rate: number) => void;
  /** 底栏播放钮 / 首页：仅背景音乐 */
  togglePlayMusic: () => void;
  pausePlayback: () => void;
  /** 非空时表示正在播放本机导入/打开的音频（不入站方服务器） */
  deviceLibraryPlayback: DeviceLibraryPlaybackInfo | null;
  /** 用本地 Blob 接管壳层 `<audio>`；会撤销上一段本机播放的 object URL */
  attachDeviceLibraryFromBlob: (trackId: string, blob: Blob, opts: { persistResume: boolean }) => void;
  /** 停止本机播放并释放 object URL；不影响曲库默认源 */
  clearDeviceLibraryPlayback: () => void;
  /** 桌面 Chromium：可选文件夹批量导入 */
  canPickLocalAudioFolder: boolean;
  /** 当前实际播放地址（全屏页 override 或默认池内随机曲） */
  effectiveSrc: string;
  /** 壳层默认播放 URL（多曲时在池内随机；单曲为唯一一条） */
  shellDefaultSrc: string;
  /** 非空时覆盖默认播放源（全屏选曲或持久化恢复） */
  shellOverrideSrc: string | null;
  /** 全屏音乐页切曲时设置；与当前默认场景曲相同时传 null 清除 override */
  setPlaybackSrc: (src: string | null, opts?: { autoPlay?: boolean }) => void;
  /** 再次请求 `/api/music/companion` 并更新壳层曲库 */
  refetchCompanionStore: () => Promise<{ ok: true } | { ok: false; status?: number; message?: string }>;
  currentSec: number;
  durationSec: number;
  seekRatio: (ratio: number) => void;
  /** 壳层曲库（曲目元数据等） */
  musicStore: MusicCompanionStore | null;
  /** 壳层唯一 `<audio>`，供音乐驱动视觉等扩展 */
  getAudioElement: () => HTMLAudioElement | null;
  sleepTimerMinutes: MusicShellSleepTimerMinutes;
  sleepTimerDeadlineAt: number | null;
  setSleepTimerMinutes: (minutes: MusicShellSleepTimerMinutes) => void;
  /** 定时到时在 `pausePlayback` 之后调用；用于自然页混音等其它 `<audio>` */
  registerSleepPauseHandler: (handler: () => void) => () => void;
  /** 壳层 `play()` 之前调用（电视：先短暂暂停背景视频） */
  registerBeforeShellPlayHandler: (handler: () => void | Promise<void>) => () => void;
  /** 壳层 `play()` 尝试之后调用（电视：恢复静音背景视频） */
  registerAfterShellPlayHandler: (handler: () => void | Promise<void>) => () => void;
  /** 壳层 `<audio>` 静音（首页顶栏铃铛）；不改变播放/暂停状态 */
  shellAudioMuted: boolean;
  setShellAudioMuted: (muted: boolean) => void;
  /** 整章经朗读：重复本章 / 重复本卷（离开该音源时自动复位为 off） */
  scriptureAudioRepeatMode: ScriptureAudioRepeatMode;
  setScriptureAudioRepeatMode: (mode: ScriptureAudioRepeatMode) => void;
  /** 音乐页覆盖壳层「曲末 / 下一首」循环策略；null 表示按专辑默认 */
  setMusicAlbumRepeatModeOverride: (mode: MusicAlbumRepeatMode | null) => void;
  /** 读经首页：今日读经是否可壳层播放 */
  readHomeScripturePlaybackReady: boolean;
  setReadHomeScripturePlaybackReady: (ready: boolean) => void;
};

export function audioUrlEquals(el: HTMLAudioElement, candidate: string): boolean {
  const c = candidate.trim();
  if (!c) return false;
  if (typeof window === "undefined") return (el.currentSrc || el.src) === c;
  try {
    const next = new URL(c, window.location.href).href;
    const curSrc = (el.currentSrc || "").trim();
    if (curSrc) {
      const cur = new URL(curSrc, window.location.href).href;
      if (cur === next) return true;
    }
    const prop = (el.src || "").trim();
    if (prop) {
      const curp = new URL(prop, window.location.href).href;
      if (curp === next) return true;
    }
    return false;
  } catch {
    return (el.currentSrc || el.src) === c;
  }
}

export function isMusicShellPath(p: string): boolean {
  return p === "/music" || p.startsWith("/music/");
}

const READ_CHAPTER_PATH = /^\/read\/([A-Za-z0-9]{2,8})\/(\d+)$/;

export function parseReadChapterPath(p: string): { bookId: string; chapter: number } | null {
  const m = p.match(READ_CHAPTER_PATH);
  if (!m) return null;
  const bookId = m[1].toUpperCase();
  const chapter = Number(m[2]);
  if (!Number.isInteger(chapter) || chapter < 1) return null;
  const meta = scriptureBooks.find((b) => b.bookId === bookId);
  if (!meta || chapter > meta.chapters) return null;
  return { bookId, chapter };
}

let defaultTranslationCatalogPromise: Promise<string | null> | null = null;

export async function fetchDefaultTranslationIdCached(): Promise<string | null> {
  if (!defaultTranslationCatalogPromise) {
    defaultTranslationCatalogPromise = (async () => {
      try {
        const res = await fetch("/api/home/bible-translations-catalog", { cache: "default" });
        if (!res.ok) return null;
        const j = (await res.json()) as { defaultTranslationId?: unknown };
        const raw = j.defaultTranslationId;
        return typeof raw === "string" && raw.trim() ? raw.trim() : null;
      } catch {
        return null;
      }
    })();
  }
  return defaultTranslationCatalogPromise;
}
