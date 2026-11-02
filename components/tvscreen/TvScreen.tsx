"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHomePrayerVerseFeedContext } from "@/components/home/HomePrayerVerseFeedContext";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { buildGoldenVerseAudioRemoteSrc } from "@/lib/bible/golden-verse-audio";
import type { StaticScriptureVerse } from "@/lib/bible/static-scripture-shape";
import { parseCuvChapterVerseTimingsPayload, verseNumberAtChapterAudioTime } from "@/lib/bible/cuv-chapter-verse-timings";
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

type Video = { id: string; src: string; title: string; posterSrc?: string };

/** 遥控器数字键 → 专辑。改这里，屏幕上的说明跟着变。 */
const ALBUM_KEYS: Record<string, { album: string; label: string }> = {
  "1": { album: "安静", label: "轻音乐" },
  "3": { album: "下午茶", label: "下午茶轻快" },
  "4": { album: "钢琴", label: "钢琴" },
  "5": { album: "赞美诗", label: "圣诗" },
  "6": { album: "睡眠", label: "睡眠" },
};
const LEGEND = ["1 轻音乐", "2 金句朗读", "3 下午茶轻快", "4 钢琴", "5 圣诗", "6 睡眠", "7 TovCore", "8 今日读经", "9 暂停/继续", "↑↓ 换一首", "← → 换场景", "0 切换场景"];
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
  const { entriesByLocale, verseKeys, activeIndex, setVerseAudioSequenceActive, advanceVerseAudioNow } = useHomePrayerVerseFeedContext();
  const [sceneIdx, setSceneIdx] = useState(0);
  const [legendOn, setLegendOn] = useState(true);
  const [toast, setToast] = useState("");
  const verseSequenceRef = useRef(false);
  const versePausedRef = useRef(false);
  const verseSourceRef = useRef("");
  const stopVerseSequence = useCallback(() => {
    verseSequenceRef.current = false;
    versePausedRef.current = false;
    setVerseAudioSequenceActive(false);
  }, [setVerseAudioSequenceActive]);
  useEffect(() => () => setVerseAudioSequenceActive(false), [setVerseAudioSequenceActive]);
  const musicRef = useRef<HTMLAudioElement>(null);
  const verseAudioRef = useRef<HTMLAudioElement>(null);
  const albumRef = useRef("安静");
  const legendTimerRef = useRef<number | null>(null);
  const planRef = useRef<{ chapters: PlanChapter[]; i: number } | null>(null);
  const planAudioRef = useRef<HTMLAudioElement>(null);
  // TV keeps a still background across playback, pauses, and track transitions.
  const playAudio = useCallback((a: HTMLAudioElement) => a.play(), []);
  useEffect(() => {
    planRequestRef.current += 1;
    planAudioRef.current?.pause();
    planRef.current = null;
    setPlanView(null);
  }, [user?.id]);

  // 今日读经：当前章的经文与朗读进度
  const [planView, setPlanView] = useState<{ title: string; verses: string[]; cur: number } | null>(null);
  const planTimingsRef = useRef<{ verse: number; start: number; end: number }[] | null>(null);
  const bookCacheRef = useRef<Record<string, Record<string, StaticScriptureVerse[]>>>({});

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
    (album: string, label: string, avoid?: string) => {
      const a = musicRef.current;
      if (!a) return;
      const src = pickTrack(album, avoid);
      if (!src) {
        say(`${label}：没有曲目`);
        return;
      }
      stopVerseSequence();
      verseAudioRef.current?.pause();
      planAudioRef.current?.pause();
      planRequestRef.current += 1;
      planRef.current = null;
      setPlanView(null);
      albumRef.current = album;
      a.volume = 1;
      a.src = src;
      void playAudio(a).then(
        () => say(`正在播放：${label}`),
        (err) => {
          say("按遥控器任意键开始播放");
          beacon({ what: "music-play-rejected", name: err?.name, msg: String(err?.message ?? "").slice(0, 120), src });
        },
      );
    },
    [say, beacon, playAudio, stopVerseSequence],
  );

  // 一首放完接同专辑的下一首
  const onMusicEnded = useCallback(() => {
    const a = musicRef.current;
    if (!a) return;
    const src = pickTrack(albumRef.current, a.getAttribute("src") ?? undefined);
    if (!src) return;
    a.src = src;
    void playAudio(a).catch(() => say("音乐播放失败"));
  }, [playAudio, say]);

  // 金句结束后推进共用经文池；轮播计时在连续朗读期间暂停。
  const onVerseAudioEnded = useCallback(() => {
    if (verseSequenceRef.current && !versePausedRef.current) advanceVerseAudioNow();
  }, [advanceVerseAudioNow]);

  const loadPlanChapterText = useCallback(async (bookId: string, chapter: number, title: string) => {
    const request = planRequestRef.current;
    const isCurrent = () => request === planRequestRef.current && planRef.current?.chapters[planRef.current.i]?.bookId === bookId && planRef.current?.chapters[planRef.current.i]?.chapter === chapter;
    planTimingsRef.current = null;
    setPlanView({ title, verses: [], cur: 0 });
    try {
      let book = bookCacheRef.current[bookId];
      if (!book) {
        const r = await fetch(`/scripture/cuv-simp/${bookId}.json`);
        book = ((await r.json()) as { c: Record<string, StaticScriptureVerse[]> }).c;
        bookCacheRef.current[bookId] = book;
      }
      const verses = (book[String(chapter)] ?? []).map((v) => typeof v === "string" ? v : v.t);
      if (!isCurrent()) return;
      setPlanView({ title, verses, cur: 0 });
      for (const u of [`/verse-timings/cuv-v20/${bookId}-${chapter}.json`]) {
        try {
          const r = await fetch(u);
          if (!r.ok) continue;
          const timings = parseCuvChapterVerseTimingsPayload(await r.json());
          if (!isCurrent()) return;
          planTimingsRef.current = timings;
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
      // Only the timing track aligned to this recording can drive highlighting.
      if (tm?.length) cur = (verseNumberAtChapterAudioTime(t, tm) ?? 1) - 1;
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
    (i: number) => {
      const st = planRef.current;
      const a = planAudioRef.current;
      if (!st || !a) return;
      const ch = st.chapters[i];
      if (!ch) {
        planRef.current = null;
        setPlanView(null);
        say("今日读经读完了");
        if (musicRef.current) void playAudio(musicRef.current).catch(() => {});
        return;
      }
      const src = buildExternalCuvChapterAudioUrl(ch.bookId, ch.chapter);
      if (!src) {
        say("这一章暂无朗读");
        return;
      }
      st.i = i;
      musicRef.current?.pause();
      stopVerseSequence();
      verseAudioRef.current?.pause();
      planRequestRef.current += 1;
      a.src = src;
      const name = `${getScriptureBookDisplayName(ch.bookId, "zh-CN")} ${ch.chapter} 章`;
      void loadPlanChapterText(ch.bookId, ch.chapter, name);
      void playAudio(a).then(
        () => say(`今日读经：${name}（${i + 1}/${st.chapters.length}）`),
        () => say("读经播放失败"),
      );
    },
    [say, loadPlanChapterText, playAudio, stopVerseSequence],
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

  const playVerseAudio = useCallback(() => {
    const key = verseKeys?.[activeIndex];
    const src = key ? buildGoldenVerseAudioRemoteSrc(key, locale === "en" ? "web-en" : "cuv-simp") : null;
    const v = verseAudioRef.current;
    if (!v || !src) {
      stopVerseSequence();
      say("这句暂无朗读");
      return;
    }
    verseSequenceRef.current = true;
    versePausedRef.current = false;
    verseSourceRef.current = src;
    setVerseAudioSequenceActive(true);
    // 音乐不停，压低音量，和金句朗读同时出声
    const m = musicRef.current;
    if (m) m.volume = 0.25;
    planRequestRef.current += 1;
    planAudioRef.current?.pause();
    planRef.current = null;
    setPlanView(null);
    v.src = src;
    void playAudio(v).catch(
      () => {
        if (m) m.volume = 1;
        stopVerseSequence();
        say("朗读失败");
      },
    );
  }, [activeIndex, locale, say, verseKeys, playAudio, setVerseAudioSequenceActive, stopVerseSequence]);

  useEffect(() => {
    if (!verseSequenceRef.current || versePausedRef.current) return;
    const key = verseKeys?.[activeIndex];
    const src = key ? buildGoldenVerseAudioRemoteSrc(key, locale === "en" ? "web-en" : "cuv-simp") : null;
    if (src !== verseSourceRef.current) playVerseAudio();
  }, [activeIndex, locale, verseKeys, playVerseAudio]);

  const reportAudio = useCallback(
    (which: string) => (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const a = e.currentTarget;
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
    [say],
  );

  const runAction = useCallback((k: string) => {
    showLegend();
    if (ALBUM_KEYS[k]) playAlbum(ALBUM_KEYS[k].album, ALBUM_KEYS[k].label);
    else if (k === "7") window.location.assign("https://tovcore.com/radio?tv=1");
    else if (k === "2") playVerseAudio();
    else if (k === "8") void startPlan();
    else if (k === "9") {
      const m = musicRef.current;
      if (verseSequenceRef.current) {
        const v = verseAudioRef.current;
        if (!versePausedRef.current) {
          versePausedRef.current = true;
          v?.pause();
          if (m) m.volume = 1;
        } else {
          versePausedRef.current = false;
          const key = verseKeys?.[activeIndex];
          const src = key ? buildGoldenVerseAudioRemoteSrc(key, locale === "en" ? "web-en" : "cuv-simp") : null;
          if (src !== verseSourceRef.current) playVerseAudio();
          else if (v?.ended) advanceVerseAudioNow();
          else if (v) { if (m) m.volume = 0.25; void playAudio(v).catch(() => {}); }
        }
        return;
      }
      const cur = [planAudioRef.current, verseAudioRef.current, m].find((x) => x && !x.paused) ?? (planRef.current ? planAudioRef.current : m);
      if (cur && !cur.paused) cur.pause();
      else if (cur?.getAttribute("src")) void playAudio(cur).catch(() => {});
      else playAlbum("安静", "轻音乐");
    } else if (k === "ArrowUp" || k === "ArrowDown") playAlbum(albumRef.current, "换一首", musicRef.current?.getAttribute("src") ?? undefined);
    else if (k === "0" || k === "ArrowRight") setSceneIdx((i) => i + 1);
    else if (k === "ArrowLeft") setSceneIdx((i) => i - 1);
  }, [showLegend, playAlbum, playVerseAudio, startPlan, playAudio, verseKeys, activeIndex, locale, advanceVerseAudioNow]);
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

  const planPage = useMemo(() => {
    if (!planView) return { start: 0, end: 0 };
    let start = 0;
    while (start < planView.verses.length) {
      let end = start;
      let chars = 0;
      while (end < planView.verses.length && (end === start || (end - start < 4 && chars + planView.verses[end].length <= 160))) {
        chars += planView.verses[end].length;
        end += 1;
      }
      if (planView.cur < end) return { start, end };
      start = end;
    }
    return { start: 0, end: 0 };
  }, [planView]);

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
              <p style={{ margin: 0, width: "100%", maxHeight: "55vh", overflow: "hidden", textAlign: "left", fontSize: "min(2.6vw, 4.2vh)", lineHeight: 1.65, fontWeight: 500 }}>
                {planView.verses.slice(planPage.start, planPage.end).map((t, i) => (
                  <span key={planPage.start + i} aria-current={planPage.start + i === planView.cur ? "true" : undefined} style={{ color: planPage.start + i === planView.cur ? "#ffe4a3" : "#fff" }}>
                    <sup style={{ fontSize: "0.55em", marginRight: "0.3em" }}>{planPage.start + i + 1}</sup>{t}{" "}
                  </span>
                ))}
              </p>
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
          <div data-tv-controls
            style={{
              margin: 0,
              padding: "1.6vh 2vw",
              width: "max-content",
              maxWidth: "94vw",
              fontSize: "min(1.3vw, 2.2vh)",
              background: "rgba(0,0,0,0.45)",
              borderRadius: 16,
            }}
          >
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(3, auto)", columnGap: "2.4vw", rowGap: "0.6vh" }}>
            {LEGEND.map((l) => (
              <li key={l}><button type="button" onClick={() => runAction(l.startsWith("↑") ? "ArrowUp" : l.startsWith("←") ? "ArrowRight" : l[0])} style={{ color: "inherit", background: "transparent", border: 0, font: "inherit", padding: "0.5vh 0", cursor: "pointer", textShadow: "inherit" }}>{l === "8 今日读经" && planLoading ? "8 同步进度中…" : l}</button></li>
            ))}
            </ul>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6vh 2.4vw", marginTop: "0.6vh", width: 0, minWidth: "100%", overflowWrap: "anywhere" }}>
            <span>{user ? <button type="button" onClick={() => void logout().catch(() => say("退出失败，请重试"))} style={{ color: "inherit", background: "transparent", border: 0, font: "inherit", cursor: "pointer" }}>已登录 · {user.name || "我的账号"}（退出）</button> : <a href="/login?next=/tv" style={{ color: "inherit" }}>登录</a>}</span>
            <a href="/tv-check.html" style={{ color: "inherit" }}>检查页</a>
            </div>
          </div>
        ) : null}
      </div>
      <audio ref={musicRef} onEnded={onMusicEnded} onError={reportAudio("音乐")} preload="none" />
      <audio ref={planAudioRef} onLoadedMetadata={(e) => { if (resumeAtRef.current > 0) { e.currentTarget.currentTime = resumeAtRef.current; resumeAtRef.current = 0; } }} onEnded={onPlanEnded} onTimeUpdate={onPlanTime} onPlaying={onPlanTime} onError={reportAudio("读经")} preload="none" />
      <audio ref={verseAudioRef} onEnded={onVerseAudioEnded} onError={(e) => { stopVerseSequence(); if (musicRef.current) musicRef.current.volume = 1; reportAudio("金句")(e); }} preload="none" />
    </div>
  );
}
