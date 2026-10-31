"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHomePrayerVerseFeedContext } from "@/components/home/HomePrayerVerseFeedContext";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { buildGoldenVerseAudioRemoteSrc } from "@/lib/bible/golden-verse-audio";
import { buildExternalCuvChapterAudioUrl } from "@/lib/bible/cuv-chapter-audio";
import { getScriptureBookDisplayName } from "@/lib/bible/scripture-book-display-name";
import { buildTripleLoopDayPayload } from "@/lib/read/today-reading-plan-payload";
import { shippedPublicMusicCompanionStore } from "@/lib/music-companion/shipped-store";
import { inferTrackAlbumFromCompanionTrack } from "@/lib/music/album-playback";

type Video = { id: string; src: string; title: string };

/** 遥控器数字键 → 专辑。改这里，屏幕上的说明跟着变。 */
const ALBUM_KEYS: Record<string, { album: string; label: string }> = {
  "1": { album: "安静", label: "轻音乐" },
  "3": { album: "下午茶", label: "下午茶轻快" },
  "4": { album: "钢琴", label: "钢琴" },
  "5": { album: "赞美诗", label: "圣诗" },
  "6": { album: "睡眠", label: "睡眠" },
  "7": { album: "专注工作", label: "专注" },
};
const LEGEND = ["1 轻音乐", "2 金句朗读", "3 下午茶轻快", "4 钢琴", "5 圣诗", "6 睡眠", "7 专注", "8 今日读经", "9 暂停/继续", "↑↓ 换一首", "← → 换场景", "0 检查页"];
const LEGEND_MS = 15_000;

/** 按字数定字号：用 vw/vh，旧电视浏览器也认；长经文自动缩小，不会被截断 */
function verseFontSize(chars: number): string {
  if (chars <= 24) return "min(3.8vw, 6.2vh)";
  if (chars <= 48) return "min(3.2vw, 5.2vh)";
  if (chars <= 80) return "min(2.8vw, 4.4vh)";
  return "min(2.3vw, 3.6vh)";
}

type PlanChapter = { bookId: string; chapter: number };

/** 今天读经计划的章列表（电视没有个人计划设置，用默认的轻松循环读经计划） */
function todayPlanChapters(): PlanChapter[] {
  const out: PlanChapter[] = [];
  for (const r of buildTripleLoopDayPayload().day?.readings ?? []) {
    for (let c = r.startChapter; c <= r.endChapter; c += 1) out.push({ bookId: r.bookId, chapter: c });
  }
  return out;
}

function pickTrack(album: string, avoid?: string): string | null {
  const tracks = (shippedPublicMusicCompanionStore.audioTracks ?? []).filter(
    (t) => inferTrackAlbumFromCompanionTrack(t) === album && t.src !== avoid,
  );
  if (tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)].src;
}

export function TvScreen({ videos }: { videos: Video[] }) {
  const { locale } = useLocale();
  const { entriesByLocale, verseKeys, activeIndex } = useHomePrayerVerseFeedContext();
  const [sceneIdx, setSceneIdx] = useState(0);
  const [legendOn, setLegendOn] = useState(true);
  const [toast, setToast] = useState("");
  const musicRef = useRef<HTMLAudioElement>(null);
  const verseAudioRef = useRef<HTMLAudioElement>(null);
  const albumRef = useRef("安静");
  const startedRef = useRef(false);
  const legendTimerRef = useRef<number | null>(null);
  const planRef = useRef<{ chapters: PlanChapter[]; i: number } | null>(null);
  const planAudioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
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
    legendTimerRef.current = window.setTimeout(() => setLegendOn(false), LEGEND_MS);
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
      verseAudioRef.current?.pause();
      planAudioRef.current?.pause();
      planRef.current = null;
      setPlanView(null);
      albumRef.current = album;
      a.volume = 1;
      a.src = src;
      void a.play().then(
        () => say(`正在播放：${label}`),
        (err) => {
          say("按遥控器任意键开始播放");
          beacon({ what: "music-play-rejected", name: err?.name, msg: String(err?.message ?? "").slice(0, 120), src });
        },
      );
    },
    [say, beacon],
  );

  // 打开就放轻音乐
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    playAlbum("安静", "轻音乐");
  }, [playAlbum]);

  // 一首放完接同专辑的下一首
  const onMusicEnded = useCallback(() => {
    const a = musicRef.current;
    playAlbum(albumRef.current, "下一首", a?.getAttribute("src") ?? undefined);
  }, [playAlbum]);

  // 金句读完回到音乐
  const onVerseAudioEnded = useCallback(() => {
    const m = musicRef.current;
    if (m) m.volume = 1;
    void m?.play().catch(() => {});
  }, []);

  const loadPlanChapterText = useCallback(async (bookId: string, chapter: number, title: string) => {
    planTimingsRef.current = null;
    setPlanView({ title, verses: [], cur: 0 });
    try {
      let book = bookCacheRef.current[bookId];
      if (!book) {
        const r = await fetch(`/scripture/cuv-simp/${bookId}.json`);
        book = ((await r.json()) as { c: Record<string, { t: string }[]> }).c;
        bookCacheRef.current[bookId] = book;
      }
      const verses = (book[String(chapter)] ?? []).map((v) => v.t);
      setPlanView({ title, verses, cur: 0 });
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

  const onPlanTime = useCallback(() => {
    const a = planAudioRef.current;
    if (!a) return;
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
  }, []);

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
        void musicRef.current?.play().catch(() => {});
        return;
      }
      const src = buildExternalCuvChapterAudioUrl(ch.bookId, ch.chapter);
      if (!src) {
        say("这一章暂无朗读");
        return;
      }
      st.i = i;
      musicRef.current?.pause();
      verseAudioRef.current?.pause();
      a.src = src;
      const name = `${getScriptureBookDisplayName(ch.bookId, "zh-CN")} ${ch.chapter} 章`;
      void loadPlanChapterText(ch.bookId, ch.chapter, name);
      void a.play().then(
        () => say(`今日读经：${name}（${i + 1}/${st.chapters.length}）`),
        () => say("读经播放失败"),
      );
    },
    [say, loadPlanChapterText],
  );

  const startPlan = useCallback(() => {
    if (!planRef.current) planRef.current = { chapters: todayPlanChapters(), i: 0 };
    playPlanChapter(planRef.current.i);
  }, [playPlanChapter]);

  const onPlanEnded = useCallback(() => {
    const st = planRef.current;
    if (st) playPlanChapter(st.i + 1);
  }, [playPlanChapter]);

  const playVerseAudio = useCallback(() => {
    const key = verseKeys?.[activeIndex];
    const src = key ? buildGoldenVerseAudioRemoteSrc(key, locale === "en" ? "web-en" : "cuv-simp") : null;
    const v = verseAudioRef.current;
    if (!v || !src) {
      say("这句暂无朗读");
      return;
    }
    // 音乐不停，压低音量，和金句朗读同时出声
    const m = musicRef.current;
    if (m) m.volume = 0.25;
    planAudioRef.current?.pause();
    setPlanView(null);
    v.src = src;
    void v.play().then(
      () => say("金句朗读"),
      () => {
        if (m) m.volume = 1;
        say("朗读失败");
      },
    );
  }, [activeIndex, locale, say, verseKeys]);

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

  const kickVideo = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.paused) return;
    void v.play().catch(() => reportVideo("play-rejected"));
  }, [reportVideo]);

  useEffect(() => {
    setVideoPlaying(false);
    kickVideo();
    const t = window.setTimeout(() => reportVideo(videoRef.current?.paused ? "paused-after-3s" : "playing-after-3s"), 3000);
    return () => window.clearTimeout(t);
  }, [video?.id, kickVideo, reportVideo]);

  const live = useRef({ playAlbum, playVerseAudio, startPlan });
  live.current = { playAlbum, playVerseAudio, startPlan };

  useEffect(() => {
    showLegend();
    const onKey = (e: KeyboardEvent) => {
      beacon({ what: "key", key: e.key, code: e.keyCode, musicPaused: musicRef.current?.paused, videoPaused: videoRef.current?.paused });
      showLegend();
      kickVideo();
      const m = musicRef.current;
      const va = verseAudioRef.current;
      const pa = planAudioRef.current;
      let k = e.key;
      if (!/^[0-9]$/.test(k) && e.keyCode >= 48 && e.keyCode <= 57) k = String(e.keyCode - 48);
      else if (!/^[0-9]$/.test(k) && e.keyCode >= 96 && e.keyCode <= 105) k = String(e.keyCode - 96);
      if (ALBUM_KEYS[k]) live.current.playAlbum(ALBUM_KEYS[k].album, ALBUM_KEYS[k].label);
      else if (k === "2") live.current.playVerseAudio();
      else if (k === "8") live.current.startPlan();
      else if (k === "9" || k === "Enter" || k === " ") {
        const cur = [pa, va, m].find((x) => x && !x.paused) ?? (planRef.current ? pa : m);
        if (cur && !cur.paused) cur.pause();
        else void cur?.play().catch(() => {});
      } else if (k === "ArrowUp" || k === "ArrowDown") {
        live.current.playAlbum(albumRef.current, "换一首", m?.getAttribute("src") ?? undefined);
      } else if (k === "0") window.location.href = "/tv-check.html";
      else if (k === "ArrowRight") setSceneIdx((i) => i + 1);
      else if (k === "ArrowLeft") setSceneIdx((i) => i - 1);
      else if (m && m.paused && va?.paused && pa?.paused && !planRef.current) {
        // 其它键：自动播放被拦时补一次
        void m.play().catch(() => {});
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (legendTimerRef.current != null) window.clearTimeout(legendTimerRef.current);
    };
  }, [showLegend, kickVideo, beacon]);

  const fontSize = useMemo(() => verseFontSize(verseText.length), [verseText]);

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "linear-gradient(160deg, #1f3a4d 0%, #3d5a4a 55%, #6b5a3a 100%)", overflow: "hidden", color: "#fff" }}
    >
      {video ? (
        <video
          ref={videoRef}
          key={video.id}
          onPlaying={() => setVideoPlaying(true)}
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
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.45))" }} />
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
          <ul
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
              <li key={l}>{l}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <audio ref={musicRef} onEnded={onMusicEnded} onError={reportAudio("音乐")} preload="none" />
      <audio ref={planAudioRef} onEnded={onPlanEnded} onTimeUpdate={onPlanTime} onError={reportAudio("读经")} preload="none" />
      <audio ref={verseAudioRef} onEnded={onVerseAudioEnded} onError={reportAudio("金句")} preload="none" />
    </div>
  );
}
