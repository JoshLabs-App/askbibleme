"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHomePrayerVerseFeedContext } from "@/components/home/HomePrayerVerseFeedContext";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { buildGoldenVerseAudioRemoteSrc } from "@/lib/bible/golden-verse-audio";
import { buildExternalCuvChapterAudioUrl } from "@/lib/bible/cuv-chapter-audio";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { resolveTodayReadingAudioStart } from "@/lib/read/today-reading-audio-start";
import { resolveTodayPlanScriptureStartTarget, writeTodayPlanScriptureResume } from "@/lib/read/today-plan-scripture-resume";
import { resolveLocalTodayReadingScopeKey } from "@/lib/read/today-reading-done";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { scheduleMemberReadingSyncWeb } from "@/lib/member-reading-sync/client/run-member-reading-sync-web";
import { readLastReadPosition } from "@/lib/read/read-last-position";
import { shippedPublicMusicCompanionStore } from "@/lib/music-companion/shipped-store";
import { inferTrackAlbumFromCompanionTrack } from "@/lib/music/album-playback";
import { resolveMediaPlaybackPolicyTier } from "@/lib/media/media-playback-policy";
import { useTvRelayReceiver } from "@/lib/tv-relay/useTvRelayReceiver";
import type { TvCommand } from "@/lib/tv-relay/protocol";

type Video = { id: string; src: string; title: string; posterSrc?: string };

/** 遥控器数字键 → 专辑。改这里，屏幕上的说明跟着变。 */
const ALBUM_KEYS: Record<string, { album: string; label: string }> = {
  "1": { album: "安静", label: "轻音乐" },
  "3": { album: "下午茶", label: "下午茶轻快" },
  "4": { album: "钢琴", label: "钢琴" },
  "5": { album: "赞美诗", label: "圣诗" },
  "6": { album: "睡眠", label: "睡眠" },
  "7": { album: "专注工作", label: "专注" },
};
const LEGEND = ["1 轻音乐", "2 金句朗读", "3 下午茶轻快", "4 钢琴", "5 圣诗", "6 睡眠", "7 专注", "8 今日读经", "9 暂停/继续", "↑↓ 换一首", "← → 换场景", "0 切换场景"];
const LEGEND_MS = 15_000;

/** 按字数定字号：用 vw/vh，旧电视浏览器也认；长经文自动缩小，不会被截断 */
function verseFontSize(chars: number): string {
  if (chars <= 24) return "min(3.8vw, 6.2vh)";
  if (chars <= 48) return "min(3.2vw, 5.2vh)";
  if (chars <= 80) return "min(2.8vw, 4.4vh)";
  return "min(2.3vw, 3.6vh)";
}

type PlanChapter = { bookId: string; chapter: number };

function pickTrack(album: string, avoid?: string): string | null {
  const tracks = (shippedPublicMusicCompanionStore.audioTracks ?? []).filter(
    (t) => inferTrackAlbumFromCompanionTrack(t) === album && t.src !== avoid,
  );
  if (tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)].src;
}

export function TvScreen({ videos }: { videos: Video[] }) {
  const { locale } = useLocale();
  const { user, bootstrapped, logout } = useAskbibleUser();
  const [planLoading, setPlanLoading] = useState(false);
  const planRequestRef = useRef(0);
  const resumeAtRef = useRef(0);
  const musicSeekRef = useRef(0);
  const sendStateRef = useRef<(s: Omit<import("@/lib/tv-relay/protocol").TvPlaybackState, "op">) => void>(() => {});
  const { entriesByLocale, verseKeys, activeIndex } = useHomePrayerVerseFeedContext();
  const [sceneIdx, setSceneIdx] = useState(0);
  const [legendOn, setLegendOn] = useState(true);
  const [toast, setToast] = useState("");
  const musicRef = useRef<HTMLAudioElement>(null);
  const verseAudioRef = useRef<HTMLAudioElement>(null);
  const albumRef = useRef("安静");
  const legendTimerRef = useRef<number | null>(null);
  const planRef = useRef<{ chapters: PlanChapter[]; i: number } | null>(null);
  const planAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [audioBlocksVideo, setAudioBlocksVideo] = useState(true);

  const syncAudioBackground = useCallback(() => {
    setAudioBlocksVideo(
      resolveMediaPlaybackPolicyTier() === "tvCoexist" &&
        [musicRef.current, verseAudioRef.current, planAudioRef.current].some(
          (a) => a && !a.paused && !a.ended,
        ),
    );
  }, []);

  // 在 audio.play() 之前释放电视的视频解码器；仅改 opacity 无法释放硬件视频层。
  const playAudio = useCallback((a: HTMLAudioElement) => {
    if (resolveMediaPlaybackPolicyTier() === "tvCoexist") {
      setAudioBlocksVideo(true);
      const v = videoRef.current;
      if (v) {
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
    }
    return a.play().catch((error: unknown) => {
      syncAudioBackground();
      throw error;
    });
  }, [syncAudioBackground]);

  useEffect(() => {
    setMediaReady(true);
    syncAudioBackground();
  }, [syncAudioBackground]);
  const showVideo = mediaReady && !audioBlocksVideo;
  useEffect(() => {
    planRequestRef.current += 1;
    planAudioRef.current?.pause();
    planRef.current = null;
    setPlanView(null);
  }, [user?.id]);

  // 今日读经：当前章的经文与朗读进度
  const [planView, setPlanView] = useState<{ title: string; verses: string[]; cur: number } | null>(null);
  const planTimingsRef = useRef<{ verse: number; start: number; end: number }[] | null>(null);
  const bookCacheRef = useRef<Record<string, Record<string, { t: string }[]>>>({});

  const entries = entriesByLocale[locale] ?? entriesByLocale["zh-CN"] ?? [];
  const entry = entries.length ? entries[activeIndex % entries.length] : null;
  const verseText = entry ? entry.lines.join(locale === "en" ? " " : "") : "";
  const video = videos.length ? videos[((sceneIdx % videos.length) + videos.length) % videos.length] : null;

  const say = useCallback((t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 3000);
  }, []);

  const beacon = useCallback((o: Record<string, unknown>) => {
    try {
      navigator.sendBeacon?.("/api/tv-report", JSON.stringify({ tv: "dbg", ...o }));
    } catch {
      /* ignore */
    }
  }, []);

  const showLegend = useCallback(() => {
    setLegendOn(true);
    if (legendTimerRef.current != null) window.clearTimeout(legendTimerRef.current);
    legendTimerRef.current = window.setTimeout(() => { if (!document.activeElement?.closest("[data-tv-controls]")) setLegendOn(false); }, LEGEND_MS);
  }, []);

  const playAlbum = useCallback(
    (album: string, label: string, avoid?: string, explicitSrc?: string, startSec?: number, ackCmdId?: string) => {
      const a = musicRef.current;
      if (!a) return;
      const src = explicitSrc || pickTrack(album, avoid);
      if (!src) {
        say(`${label}：没有曲目`);
        return;
      }
      verseAudioRef.current?.pause();
      planAudioRef.current?.pause();
      planRequestRef.current += 1;
      planRef.current = null;
      setPlanView(null);
      albumRef.current = album;
      a.volume = 1;
      musicSeekRef.current = startSec && startSec > 0 ? startSec : 0;
      a.src = src;
      void playAudio(a).then(
        () => {
          say(`正在播放：${label}`);
          sendStateRef.current({
            kind: "music",
            title: label,
            playing: true,
            positionSec: a.currentTime || startSec || 0,
            durationSec: a.duration || 0,
            ackCmdId,
          });
        },
        (err) => {
          say("按遥控器任意键开始播放");
          beacon({ what: "music-play-rejected", name: err?.name, msg: String(err?.message ?? "").slice(0, 120), src });
          sendStateRef.current({
            kind: "music",
            title: label,
            playing: false,
            positionSec: startSec || 0,
            durationSec: 0,
            ackCmdId,
            error: "autoplay-blocked",
          });
        },
      );
    },
    [say, beacon, playAudio],
  );

  // 一首放完接同专辑的下一首
  const onMusicEnded = useCallback(() => {
    const a = musicRef.current;
    playAlbum(albumRef.current, "下一首", a?.getAttribute("src") ?? undefined);
  }, [playAlbum]);

  // 金句读完回到音乐
  const onVerseAudioEnded = useCallback(() => {
    const m = musicRef.current;
    if (m) m.volume = 1;
    if (m) void playAudio(m).catch(() => {});
  }, [playAudio]);

  const loadPlanChapterText = useCallback(async (bookId: string, chapter: number, title: string, initialVerse?: number) => {
    planTimingsRef.current = null;
    const initCur = initialVerse && initialVerse > 0 ? initialVerse - 1 : 0;
    setPlanView({ title, verses: [], cur: initCur });
    try {
      let book = bookCacheRef.current[bookId];
      if (!book) {
        const r = await fetch(`/scripture/cuv-simp/${bookId}.json`);
        book = ((await r.json()) as { c: Record<string, { t: string }[]> }).c;
        bookCacheRef.current[bookId] = book;
      }
      const verses = (book[String(chapter)] ?? []).map((v) => v.t);
      setPlanView({ title, verses, cur: Math.max(0, Math.min(verses.length - 1, initCur)) });
      for (const u of [`/verse-timings/cuv-v20/${bookId}-${chapter}.json`, `/verse-timings/${bookId}-${chapter}.json`]) {
        try {
          const r = await fetch(u);
          if (!r.ok) continue;
          planTimingsRef.current = (await r.json()) as { verse: number; start: number; end: number }[];
          break;
        } catch {
          /* 试下一个 */
        }
      }
    } catch {
      /* 取不到经文就只听朗读 */
    }
  }, []);

  const planDbgRef = useRef(0);
  const onPlanTime = useCallback(() => {
    const a = planAudioRef.current;
    if (!a) return;
    const ch = planRef.current?.chapters[planRef.current.i];
    if (ch && a.currentTime > 0) writeTodayPlanScriptureResume({ ...ch, scopeKey: resolveLocalTodayReadingScopeKey(), positionSec: a.currentTime });
    const nowMs = Date.now();
    if (nowMs - planDbgRef.current > 15000) {
      planDbgRef.current = nowMs;
      const st = planRef.current;
      beacon({
        what: "plan-sync",
        ch: st ? `${st.chapters[st.i]?.bookId}-${st.chapters[st.i]?.chapter}` : "",
        t: Math.round(a.currentTime * 10) / 10,
        dur: Math.round((a.duration || 0) * 10) / 10,
        timings: planTimingsRef.current ? planTimingsRef.current.length : 0,
      });
    }
    setPlanView((pv) => {
      if (!pv || pv.verses.length === 0) return pv;
      const t = a.currentTime;
      let cur = 0;
      const tm = planTimingsRef.current;
      if (tm && tm.length) {
        for (let i = 0; i < tm.length; i += 1) if (t >= tm[i].start) cur = tm[i].verse - 1;
      } else if (a.duration > 0) {
        const w = pv.verses.map((x) => Math.max(10, x.length));
        const total = w.reduce((x, y) => x + y, 0);
        let acc = 0;
        const target = (t / a.duration) * total;
        for (let i = 0; i < w.length; i += 1) {
          acc += w[i];
          if (target < acc) {
            cur = i;
            break;
          }
          cur = i;
        }
      }
      cur = Math.max(0, Math.min(pv.verses.length - 1, cur));
      return cur === pv.cur ? pv : { ...pv, cur };
    });
  }, [beacon]);

  // 旧电视的 timeupdate 触发很稀，读经时另用定时器每 0.3 秒对一次时间
  const planActive = planView !== null;
  useEffect(() => {
    if (!planActive) return;
    const id = window.setInterval(onPlanTime, 300);
    return () => window.clearInterval(id);
  }, [planActive, onPlanTime]);

  const playPlanChapter = useCallback(
    (i: number, ackCmdId?: string) => {
      const st = planRef.current;
      const a = planAudioRef.current;
      if (!st || !a) return;
      const ch = st.chapters[i];
      if (!ch) {
        planRef.current = null;
        setPlanView(null);
        say("今日读经读完了");
        sendStateRef.current({ kind: "idle", title: "今日读经读完了", playing: false, positionSec: 0, durationSec: 0 });
        if (musicRef.current) void playAudio(musicRef.current).catch(() => {});
        return;
      }
      const src = buildExternalCuvChapterAudioUrl(ch.bookId, ch.chapter);
      if (!src) {
        say("这一章暂无朗读");
        sendStateRef.current({ kind: "plan", title: `${ch.bookId} ${ch.chapter}`, playing: false, positionSec: 0, durationSec: 0, bookId: ch.bookId, chapter: ch.chapter, ackCmdId, error: "load-failed" });
        return;
      }
      st.i = i;
      musicRef.current?.pause();
      verseAudioRef.current?.pause();
      a.src = src;
      const name = `${getScriptureBookDisplayName(ch.bookId, "zh-CN")} ${ch.chapter} 章`;
      void loadPlanChapterText(ch.bookId, ch.chapter, name);
      void playAudio(a).then(
        () => {
          say(`今日读经：${name}（${i + 1}/${st.chapters.length}）`);
          sendStateRef.current({
            kind: "plan",
            title: name,
            playing: true,
            positionSec: a.currentTime || resumeAtRef.current || 0,
            durationSec: a.duration || 0,
            bookId: ch.bookId,
            chapter: ch.chapter,
            ackCmdId,
          });
        },
        () => {
          say("按遥控器任意键开始播放");
          sendStateRef.current({
            kind: "plan",
            title: name,
            playing: false,
            positionSec: resumeAtRef.current || 0,
            durationSec: 0,
            bookId: ch.bookId,
            chapter: ch.chapter,
            ackCmdId,
            error: "autoplay-blocked",
          });
        },
      );
    },
    [say, loadPlanChapterText, playAudio],
  );

  const startPlan = useCallback(async () => {
    if (!bootstrapped) { say("正在读取登录状态"); return; }
    if (planLoading) return;
    if (planRef.current) { playPlanChapter(planRef.current.i); return; }
    const request = ++planRequestRef.current;
    setPlanLoading(true);
    try {
      if (user) {
        say("正在同步读经进度");
        const outcome = await scheduleMemberReadingSyncWeb();
        if (outcome !== "ok") { say("进度同步失败，请稍后重试"); return; }
      }
      const start = await resolveTodayReadingAudioStart();
      if (request !== planRequestRef.current) return;
      if (!start) { say("暂无今日读经计划"); return; }
      const resume = resolveTodayPlanScriptureStartTarget(start.queue);
      const last = readLastReadPosition();
      const target = resume && resume.startAtSec > 0 ? resume.target : last ?? resume?.target;
      const index = start.queue.findIndex((ch) => ch.bookId === target?.bookId && ch.chapter === target?.chapter);
      planRef.current = { chapters: start.queue, i: Math.max(0, index) };
      resumeAtRef.current = resume && index >= 0 && resume.target.bookId === target?.bookId && resume.target.chapter === target?.chapter ? resume.startAtSec : 0;
      playPlanChapter(planRef.current.i);
    } catch { say("读经进度加载失败，请重试"); }
    finally { setPlanLoading(false); }
  }, [bootstrapped, user, planLoading, playPlanChapter, say]);

  const onPlanEnded = useCallback(() => {
    const st = planRef.current;
    if (st) playPlanChapter(st.i + 1);
  }, [playPlanChapter]);

  const playVerseAudio = useCallback((explicitKey?: string, ackCmdId?: string) => {
    const key = explicitKey || verseKeys?.[activeIndex];
    const src = key ? buildGoldenVerseAudioRemoteSrc(key, locale === "en" ? "web-en" : "cuv-simp") : null;
    const v = verseAudioRef.current;
    if (!v || !src) {
      say("这句暂无朗读");
      sendStateRef.current({ kind: "verse", title: "金句朗读", playing: false, positionSec: 0, durationSec: 0, ackCmdId, error: "load-failed" });
      return;
    }
    // 音乐不停，压低音量，和金句朗读同时出声
    const m = musicRef.current;
    if (m) m.volume = 0.25;
    planRequestRef.current += 1;
    planAudioRef.current?.pause();
    setPlanView(null);
    v.src = src;
    void playAudio(v).then(
      () => {
        say("金句朗读");
        sendStateRef.current({ kind: "verse", title: "金句朗读", playing: true, positionSec: 0, durationSec: v.duration || 0, ackCmdId });
      },
      () => {
        if (m) m.volume = 1;
        say("按遥控器任意键开始播放");
        sendStateRef.current({ kind: "verse", title: "金句朗读", playing: false, positionSec: 0, durationSec: 0, ackCmdId, error: "autoplay-blocked" });
      },
    );
  }, [activeIndex, locale, say, verseKeys, playAudio]);

  // 视频：电视浏览器常拦自动播放，或解码失败。尝试补播，并把状态报到 /api/tv-report（Vercel 日志搜 [tv-report]）
  const reportVideo = useCallback((what: string) => {
    const v = videoRef.current;
    try {
      navigator.sendBeacon?.(
        "/api/tv-report",
        JSON.stringify({
          tv: "video",
          what,
          src: v?.currentSrc ?? "",
          readyState: v?.readyState,
          networkState: v?.networkState,
          errCode: v?.error?.code,
          errMsg: v?.error?.message,
          paused: v?.paused,
          ua: navigator.userAgent,
        }),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const reportAudio = useCallback(
    (which: string) => (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const a = e.currentTarget;
      syncAudioBackground();
      say(`${which}加载失败（错误 ${a.error?.code ?? "?"}）`);
      try {
        navigator.sendBeacon?.(
          "/api/tv-report",
          JSON.stringify({ tv: "audio", which, src: a.currentSrc || a.src, errCode: a.error?.code, errMsg: a.error?.message, networkState: a.networkState, ua: navigator.userAgent }),
        );
      } catch {
        /* ignore */
      }
    },
    [say, syncAudioBackground],
  );

  const kickVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.paused) return;
    if (resolveMediaPlaybackPolicyTier() === "tvCoexist" &&
      [musicRef.current, verseAudioRef.current, planAudioRef.current].some((a) => a && !a.paused && !a.ended)) return;
    void v.play().catch(() => reportVideo("play-rejected"));
  }, [reportVideo]);

  useEffect(() => {
    setVideoPlaying(false);
    if (!showVideo) return;
    kickVideo();
    const t = window.setTimeout(() => reportVideo(videoRef.current?.paused ? "paused-after-3s" : "playing-after-3s"), 3000);
    return () => window.clearTimeout(t);
  }, [video?.id, showVideo, kickVideo, reportVideo]);

  const handleRemoteCommand = useCallback(
    (cmd: TvCommand) => {
      if (cmd.op === "stop") {
        musicRef.current?.pause();
        verseAudioRef.current?.pause();
        planAudioRef.current?.pause();
        planRef.current = null;
        setPlanView(null);
        say("已停止播放");
        sendStateRef.current({ kind: "idle", title: "", playing: false, positionSec: 0, durationSec: 0, ackCmdId: cmd.cmdId });
        return;
      }

      if (cmd.op === "control") {
        if (cmd.action === "play" || cmd.action === "pause") {
          const m = musicRef.current;
          const cur =
            [planAudioRef.current, verseAudioRef.current, m].find((x) => x && !x.paused) ??
            (planRef.current ? planAudioRef.current : m);
          if (cmd.action === "pause") {
            cur?.pause();
            sendStateRef.current({
              kind: planRef.current ? "plan" : "music",
              title: planView?.title || albumRef.current,
              playing: false,
              positionSec: cur?.currentTime || 0,
              durationSec: cur?.duration || 0,
              ackCmdId: cmd.cmdId,
            });
          } else if (cur?.getAttribute("src")) {
            void playAudio(cur).then(
              () =>
                sendStateRef.current({
                  kind: planRef.current ? "plan" : "music",
                  title: planView?.title || albumRef.current,
                  playing: true,
                  positionSec: cur.currentTime || 0,
                  durationSec: cur.duration || 0,
                  ackCmdId: cmd.cmdId,
                }),
              () => {
                say("按遥控器任意键开始播放");
                sendStateRef.current({
                  kind: planRef.current ? "plan" : "music",
                  title: planView?.title || albumRef.current,
                  playing: false,
                  positionSec: cur.currentTime || 0,
                  durationSec: cur.duration || 0,
                  ackCmdId: cmd.cmdId,
                  error: "autoplay-blocked",
                });
              },
            );
          } else {
            playAlbum(albumRef.current, "轻音乐", undefined, undefined, undefined, cmd.cmdId);
          }
          return;
        }
        if (cmd.action === "next") {
          if (planRef.current) playPlanChapter(planRef.current.i + 1, cmd.cmdId);
          else playAlbum(albumRef.current, "下一首", musicRef.current?.getAttribute("src") ?? undefined, undefined, undefined, cmd.cmdId);
          return;
        }
        if (cmd.action === "prev") {
          if (planRef.current) playPlanChapter(Math.max(0, planRef.current.i - 1), cmd.cmdId);
          else playAlbum(albumRef.current, "上一首", musicRef.current?.getAttribute("src") ?? undefined, undefined, undefined, cmd.cmdId);
          return;
        }
        if (cmd.action === "seek" && typeof cmd.value === "number") {
          const cur = [planAudioRef.current, musicRef.current].find((x) => x && x.getAttribute("src"));
          if (cur) cur.currentTime = Math.max(0, cmd.value);
          return;
        }
        if (cmd.action === "sceneNext") {
          setSceneIdx((i) => i + 1);
          return;
        }
        if (cmd.action === "scenePrev") {
          setSceneIdx((i) => i - 1);
          return;
        }
        return;
      }

      if (cmd.op === "handoff") {
        const transitSec = Math.max(0, Math.min(5, (Date.now() - (cmd.sentAt || Date.now())) / 1000));
        const media = cmd.media;
        if (media.kind === "music") {
          const targetSec = (media.positionSec || 0) + transitSec;
          playAlbum(media.album || "安静", media.trackTitle || media.album || "轻音乐", undefined, media.trackSrc, targetSec, cmd.cmdId);
          return;
        }
        if (media.kind === "plan") {
          if (!media.queue?.length) return;
          const idx = Math.max(0, Math.min(media.queue.length - 1, media.index || 0));
          planRequestRef.current += 1;
          planRef.current = { chapters: media.queue, i: idx };
          resumeAtRef.current = (media.positionSec || 0) + transitSec;
          playPlanChapter(idx, cmd.cmdId);
          return;
        }
        if (media.kind === "scripture") {
          const name = `${getScriptureBookDisplayName(media.bookId, "zh-CN")} ${media.chapter} 章`;
          musicRef.current?.pause();
          verseAudioRef.current?.pause();
          planRequestRef.current += 1;
          if (media.audioPlaying) {
            planRef.current = { chapters: [{ bookId: media.bookId, chapter: media.chapter }], i: 0 };
            resumeAtRef.current = (media.positionSec || 0) + transitSec;
            playPlanChapter(0, cmd.cmdId);
          } else {
            planAudioRef.current?.pause();
            planRef.current = null;
            void loadPlanChapterText(media.bookId, media.chapter, name, media.verse);
            say(`正在同步读经：${name}`);
            sendStateRef.current({
              kind: "scripture",
              title: name,
              playing: false,
              positionSec: 0,
              durationSec: 0,
              bookId: media.bookId,
              chapter: media.chapter,
              verse: media.verse,
              ackCmdId: cmd.cmdId,
            });
          }
          return;
        }
        if (media.kind === "verse") {
          playVerseAudio(media.verseKey, cmd.cmdId);
        }
      }
    },
    [playAlbum, playAudio, playPlanChapter, playVerseAudio, loadPlanChapterText, planView?.title, say],
  );

  const relay = useTvRelayReceiver(handleRemoteCommand);
  sendStateRef.current = relay.sendState;

  const runAction = useCallback((k: string) => {
    showLegend();
    if (ALBUM_KEYS[k]) playAlbum(ALBUM_KEYS[k].album, ALBUM_KEYS[k].label);
    else if (k === "2") playVerseAudio();
    else if (k === "8") void startPlan();
    else if (k === "9") {
      const m = musicRef.current;
      const cur = [planAudioRef.current, verseAudioRef.current, m].find((x) => x && !x.paused) ?? (planRef.current ? planAudioRef.current : m);
      if (cur && !cur.paused) cur.pause();
      else if (cur?.getAttribute("src")) void playAudio(cur).catch(() => {});
      else playAlbum("安静", "轻音乐");
    } else if (k === "ArrowUp" || k === "ArrowDown") playAlbum(albumRef.current, "换一首", musicRef.current?.getAttribute("src") ?? undefined);
    else if (k === "0" || k === "ArrowRight") setSceneIdx((i) => i + 1);
    else if (k === "ArrowLeft") setSceneIdx((i) => i - 1);
  }, [showLegend, playAlbum, playVerseAudio, startPlan, playAudio]);
  const live = useRef(runAction);
  live.current = runAction;
  useEffect(() => {
    showLegend();
    const onKey = (e: KeyboardEvent) => {
      const interactive = (e.target as HTMLElement)?.closest("button, a, input, select, textarea");
      if (interactive && (e.key === "Enter" || e.key === " ")) return;
      let k = e.key;
      if (!/^[0-9]$/.test(k) && e.keyCode >= 48 && e.keyCode <= 57) k = String(e.keyCode - 48);
      else if (!/^[0-9]$/.test(k) && e.keyCode >= 96 && e.keyCode <= 105) k = String(e.keyCode - 96);
      if (k === "Enter" || k === " ") k = "9";
      if (/^[0-9]$/.test(k) || k.startsWith("Arrow")) { e.preventDefault(); live.current(k); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (legendTimerRef.current != null) window.clearTimeout(legendTimerRef.current);
    };
  }, [showLegend]);

  const fontSize = useMemo(() => verseFontSize(verseText.length), [verseText]);

  return (
    <div
      onPointerMove={showLegend}
      onClick={showLegend}
      onFocusCapture={showLegend}
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "linear-gradient(160deg, #3b6f8f 0%, #5b8a6a 55%, #b0884a 100%)", overflow: "hidden", color: "#fff" }}
    >
      {video?.posterSrc ? (
        // 普通 img 不占媒体解码器，电视音频播放期间仍能显示风景。
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.posterSrc} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}
      {video && showVideo ? (
        <video
          ref={videoRef}
          key={video.id}
          onPlaying={() => setVideoPlaying(true)}
          onPause={() => setVideoPlaying(false)}
          onError={() => reportVideo("error")}
          onStalled={() => reportVideo("stalled")}
          src={video.src}
          autoPlay
          muted
          loop
          playsInline
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", opacity: videoPlaying ? 1 : 0 }}
        />
      ) : null}
      {entry ? (
        <div
          style={{
            position: "absolute",
            left: "8vw",
            right: "8vw",
            top: "8vh",
            bottom: "22vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            overflow: "hidden",
            textShadow: "0 2px 12px rgba(0,0,0,0.7)",
          }}
        >
          {planView && planView.verses.length > 0 ? (
            <>
              {planView.verses.slice(planView.cur, planView.cur + 3).map((t, i) => (
                <p
                  key={planView.cur + i}
                  style={{ margin: "0 0 2vh", fontSize: i === 0 ? "min(3vw, 4.8vh)" : "min(2.3vw, 3.7vh)", lineHeight: 1.5, fontWeight: i === 0 ? 700 : 500, opacity: i === 0 ? 1 : 0.6 }}
                >
                  {planView.cur + i + 1} {t}
                </p>
              ))}
              <p style={{ margin: "1vh 0 0", fontSize: "min(1.9vw, 3vh)", fontWeight: 600, opacity: 0.92 }}>{planView.title}</p>
            </>
          ) : (
            <>
              <p style={{ margin: 0, fontSize, lineHeight: 1.45, fontWeight: 700 }}>{verseText}</p>
              <p style={{ margin: "3vh 0 0", fontSize: "min(1.9vw, 3vh)", fontWeight: 600, opacity: 0.92 }}>{entry.ref}</p>
            </>
          )}
        </div>
      ) : null}
      <div style={{ position: "absolute", left: "3vw", bottom: "3vh", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
        {toast ? <p style={{ margin: "0 0 1vh", fontSize: "min(1.8vw, 2.8vh)", fontWeight: 600 }}>{toast}</p> : null}
        {legendOn ? (
          <ul data-tv-controls
            style={{
              margin: 0,
              padding: "1.6vh 2vw",
              listStyle: "none",
              display: "grid",
              gridTemplateColumns: "repeat(3, auto)",
              columnGap: "2.4vw",
              rowGap: "0.6vh",
              fontSize: "min(1.3vw, 2.2vh)",
              background: "rgba(0,0,0,0.45)",
              borderRadius: 16,
            }}
          >
            {LEGEND.map((l) => (
              <li key={l}><button type="button" onClick={() => runAction(l.startsWith("↑") ? "ArrowUp" : l.startsWith("←") ? "ArrowRight" : l[0])} style={{ color: "inherit", background: "transparent", border: 0, font: "inherit", padding: "0.5vh 0", cursor: "pointer", textShadow: "inherit" }}>{l === "8 今日读经" && planLoading ? "8 同步进度中…" : l}</button></li>
            ))}
            <li>{user ? <button type="button" onClick={() => void logout().catch(() => say("退出失败，请重试"))} style={{ color: "inherit", background: "transparent", border: 0, font: "inherit", cursor: "pointer" }}>已登录 · {user.name || "我的账号"}（退出）</button> : <a href="/login?next=/tv" style={{ color: "inherit" }}>登录</a>}</li>
            <li>
              {relay.pairing ? (
                <button type="button" onClick={() => relay.unpairLocal()} style={{ color: "inherit", background: "transparent", border: 0, font: "inherit", cursor: "pointer" }}>
                  {relay.connected ? `已连手机 · ${relay.pairing.tvName}` : `重连手机中 · ${relay.pairing.tvName}`}（解绑）
                </button>
              ) : (
                <button type="button" onClick={() => void relay.startPairing()} style={{ color: "inherit", background: "transparent", border: 0, font: "inherit", cursor: "pointer" }}>
                  连接手机控制
                </button>
              )}
            </li>
            <li><a href="/tv-check.html" style={{ color: "inherit" }}>检查页</a></li>
          </ul>
        ) : null}
      </div>
      {relay.pairing && !legendOn ? (
        <div style={{ position: "absolute", right: "3vw", top: "3vh", fontSize: "min(1.2vw, 2vh)", opacity: 0.72, textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
          {relay.connected ? `● 已连手机 · ${relay.pairing.tvName}` : "○ 等待手机连接…"}
        </div>
      ) : null}
      {relay.pairSession ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(18, 16, 14, 0.82)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 20,
          }}
        >
          <div style={{ background: "rgba(38, 32, 26, 0.96)", borderRadius: 24, padding: "4vh 4vw", maxWidth: "60vw", textAlign: "center", boxShadow: "0 12px 48px rgba(0,0,0,0.5)" }}>
            <p style={{ margin: 0, fontSize: "min(2.2vw, 3.6vh)", fontWeight: 700 }}>连接手机控制这台电视</p>
            <p style={{ margin: "2vh 0 0", fontSize: "min(1.4vw, 2.4vh)", opacity: 0.85 }}>
              在 AskBible 手机 App 侧边栏点「连接电视」，或手机浏览器打开 <strong>askbible.me/tv/pair</strong>，输入下方 6 位配对码：
            </p>
            <p style={{ margin: "3vh 0", fontSize: "min(5.2vw, 8.4vh)", fontWeight: 800, letterSpacing: "0.28em", color: "#ffd36b" }}>
              {relay.pairSession.code}
            </p>
            <p style={{ margin: "0 0 3vh", fontSize: "min(1.2vw, 2vh)", opacity: 0.7 }}>
              授权一次后，这台电视开机即自动上线，手机播放的音乐、读经页和读经计划可直接投到电视接续播放。
            </p>
            <button
              type="button"
              onClick={() => relay.cancelPairing()}
              style={{ padding: "1.2vh 3vw", fontSize: "min(1.4vw, 2.3vh)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", cursor: "pointer" }}
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}
      {relay.pairError ? (
        <div style={{ position: "absolute", right: "3vw", bottom: "3vh", background: "rgba(180,35,24,0.88)", padding: "1vh 1.6vw", borderRadius: 10, fontSize: "min(1.3vw, 2.1vh)" }}>
          {relay.pairError}
        </div>
      ) : null}
      <audio
        onPlay={syncAudioBackground}
        onPause={syncAudioBackground}
        onLoadedMetadata={(e) => {
          if (musicSeekRef.current > 0) {
            e.currentTarget.currentTime = musicSeekRef.current;
            musicSeekRef.current = 0;
          }
        }}
        ref={musicRef}
        onEnded={() => { syncAudioBackground(); onMusicEnded(); }}
        onError={reportAudio("音乐")}
        preload="none"
      />
      <audio onPlay={syncAudioBackground} onPause={syncAudioBackground} ref={planAudioRef} onLoadedMetadata={(e) => { if (resumeAtRef.current > 0) { e.currentTarget.currentTime = resumeAtRef.current; resumeAtRef.current = 0; } }} onEnded={() => { syncAudioBackground(); onPlanEnded(); }} onTimeUpdate={onPlanTime} onPlaying={onPlanTime} onError={reportAudio("读经")} preload="none" />
      <audio onPlay={syncAudioBackground} onPause={syncAudioBackground} ref={verseAudioRef} onEnded={() => { syncAudioBackground(); onVerseAudioEnded(); }} onError={reportAudio("金句")} preload="none" />
    </div>
  );
}
