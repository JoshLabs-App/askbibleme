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
  if (chars <= 24) return "min(5.6vw, 9vh)";
  if (chars <= 48) return "min(4.6vw, 7.4vh)";
  if (chars <= 80) return "min(3.9vw, 6.2vh)";
  return "min(3.2vw, 5vh)";
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

  const entries = entriesByLocale[locale] ?? entriesByLocale["zh-CN"] ?? [];
  const entry = entries.length ? entries[activeIndex % entries.length] : null;
  const verseText = entry ? entry.lines.join(locale === "en" ? " " : "") : "";
  const video = videos.length ? videos[((sceneIdx % videos.length) + videos.length) % videos.length] : null;

  const say = useCallback((t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 3000);
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
      albumRef.current = album;
      a.src = src;
      void a.play().then(
        () => say(`正在播放：${label}`),
        () => say("按遥控器任意键开始播放"),
      );
    },
    [say],
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
    void musicRef.current?.play().catch(() => {});
  }, []);

  const playPlanChapter = useCallback(
    (i: number) => {
      const st = planRef.current;
      const a = planAudioRef.current;
      if (!st || !a) return;
      const ch = st.chapters[i];
      if (!ch) {
        planRef.current = null;
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
      void a.play().then(
        () => say(`今日读经：${name}（${i + 1}/${st.chapters.length}）`),
        () => say("读经播放失败"),
      );
    },
    [say],
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
    musicRef.current?.pause();
    planAudioRef.current?.pause();
    v.src = src;
    void v.play().then(
      () => say("金句朗读"),
      () => say("朗读失败"),
    );
  }, [activeIndex, locale, say, verseKeys]);

  const live = useRef({ playAlbum, playVerseAudio, startPlan });
  live.current = { playAlbum, playVerseAudio, startPlan };

  useEffect(() => {
    showLegend();
    const onKey = (e: KeyboardEvent) => {
      showLegend();
      const m = musicRef.current;
      const va = verseAudioRef.current;
      const pa = planAudioRef.current;
      const k = e.key;
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
  }, [showLegend]);

  const fontSize = useMemo(() => verseFontSize(verseText.length), [verseText]);

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "#000", overflow: "hidden", color: "#fff" }}
    >
      {video ? (
        <video
          key={video.id}
          src={video.src}
          autoPlay
          muted
          loop
          playsInline
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
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
          <p style={{ margin: 0, fontSize, lineHeight: 1.45, fontWeight: 700 }}>{verseText}</p>
          <p style={{ margin: "3vh 0 0", fontSize: "min(2.6vw, 4.2vh)", fontWeight: 600, opacity: 0.92 }}>{entry.ref}</p>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: "3vw", bottom: "3vh", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
        {toast ? <p style={{ margin: "0 0 1vh", fontSize: "min(2.4vw, 4vh)", fontWeight: 600 }}>{toast}</p> : null}
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
              fontSize: "min(1.7vw, 2.9vh)",
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
      <audio ref={musicRef} onEnded={onMusicEnded} preload="none" />
      <audio ref={planAudioRef} onEnded={onPlanEnded} preload="none" />
      <audio ref={verseAudioRef} onEnded={onVerseAudioEnded} preload="none" />
    </div>
  );
}
