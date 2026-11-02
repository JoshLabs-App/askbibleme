"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TvScriptureDisplay } from "./TvScriptureDisplay";
import { useHomePrayerVerseFeedContext } from "@/components/home/HomePrayerVerseFeedContext";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { buildGoldenVerseAudioRemoteSrc } from "@/lib/bible/golden-verse-audio";
import { parseVerseKey } from "@/lib/bible/parse-verse-key";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type { AppLocale } from "@/lib/i18n/config";
import { resolveChapterAudioPlayableSrc, translationSupportsChapterAudio } from "@/lib/bible/read-chapter-audio";
import { parseCuvChapterVerseTimingsPayload, verseNumberAtChapterAudioTime } from "@/lib/bible/cuv-chapter-verse-timings";

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
const LEGEND_EN = ["1 Quiet music", "2 Verse audio", "3 Afternoon tea", "4 Piano", "5 Hymns", "6 Sleep", "7 TovCore", "8 Today’s reading", "9 Pause / resume", "↑↓ Next track", "← → Next scene", "0 Change scene"];
const LEGEND_MS = 10_000;

type PlanChapter = { bookId: string; chapter: number };

function pickTrack(album: string, avoid?: string): string | null {
  const tracks = (shippedPublicMusicCompanionStore.audioTracks ?? []).filter(
    (t) => inferTrackAlbumFromCompanionTrack(t) === album && t.src !== avoid,
  );
  if (tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)].src;
}

type Translation = { id: string; labelZh: string; labelEn: string; language: string };
export function TvScreen({ videos, translations }: { videos: Video[]; translations: Translation[] }) {
  const { locale, setLocale } = useLocale();
  const [selectedVersion, setSelectedVersion] = useState("");
  const [fontStep, setFontStep] = useState(1);
  const version = selectedVersion || (locale === "en" ? "web-en" : locale === "zh-TW" ? "cuv-trad" : "cuv-simp");
  const scale = [0.8, 1, 1.2, 1.4][fontStep];
  const copy = useCallback((zh: string, en: string) => locale === "en" ? en : locale === "zh-TW" ? toZhTwText(zh) : zh, [locale]);
  const noAudio = copy("此版本暂不支持朗读", "Audio is unavailable for this version");
  const goldenVersion = version === "cuv-simp" || version === "cuv-trad" ? "cuv-simp" : version === "web-en" ? "web-en" : null;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("askbible-tv-reading") || "{}");
      if (translations.some((t) => t.id === saved.version && (locale === "en" ? t.language.startsWith("en") : t.language.startsWith("zh")))) setSelectedVersion(saved.version);
      if ([0, 1, 2, 3].includes(saved.fontStep)) setFontStep(saved.fontStep);
    } catch { /* storage may be unavailable on TV */ }
  }, [translations, locale]);
  const saveSettings = (nextVersion: string, nextSize: number) => {
    try { localStorage.setItem("askbible-tv-reading", JSON.stringify({ version: nextVersion, fontStep: nextSize })); } catch { /* optional persistence */ }
  };
  const { user, bootstrapped, logout } = useAskbibleUser();
  const [planLoading, setPlanLoading] = useState(false);
  const planRequestRef = useRef(0);
  useEffect(() => () => { planRequestRef.current += 1; }, []);
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
  const chapterCacheRef = useRef<Record<string, { verse: number; text: string }[]>>({});
  const loadChapter = useCallback(async (bookId: string, chapter: number) => {
    const key = `${version}:${bookId}:${chapter}`;
    if (chapterCacheRef.current[key]) return chapterCacheRef.current[key];
    const query = new URLSearchParams({ translationId: version, bookId, chapter: String(chapter) });
    const response = await fetch(`/api/read/chapter?${query}`);
    const body = await response.json();
    if (!response.ok || !body.ok || body.data.translationId !== version) throw new Error("chapter unavailable");
    const rows = body.data.verses as { verse: number; text: string }[];
    chapterCacheRef.current[key] = rows;
    return rows;
  }, [version]);
  const [translatedVerse, setTranslatedVerse] = useState<{ identity: string; text: string } | null>(null);
  const verseKey = verseKeys?.[activeIndex] || "";
  const verseIdentity = `${version}:${verseKey}`;
  useEffect(() => {
    let cancelled = false;
    const start = parseVerseKey(verseKey);
    if (!start) return;
    const end = parseVerseKey(verseKey.split("-")[1] || verseKey);
    void loadChapter(start.bookId, start.chapter).then((rows) => {
      const text = rows.filter((r) => r.verse >= start.verse && r.verse <= (end?.verse || start.verse)).map((r) => r.text).join(" ");
      if (!cancelled) setTranslatedVerse({ identity: verseIdentity, text: text || copy("此版本暂无这段经文", "This passage is unavailable in this version") });
    }).catch(() => { if (!cancelled) setTranslatedVerse({ identity: verseIdentity, text: copy("经文加载失败，请切换版本重试", "Could not load this passage. Please select a version again.") }); });
    return () => { cancelled = true; };
  }, [verseKey, verseIdentity, loadChapter, copy]);
  const resetReading = () => {
    planRequestRef.current += 1;
    planAudioRef.current?.pause();
    planAudioRef.current?.removeAttribute("src");
    verseAudioRef.current?.pause();
    stopVerseSequence();
    planRef.current = null;
    planTimingsRef.current = null;
    resumeAtRef.current = 0;
    setPlanView(null);
    setPlanLoading(false);
    if (musicRef.current) musicRef.current.volume = 1;
  };
  const changeVersion = (id: string) => { resetReading(); setSelectedVersion(id); saveSettings(id, fontStep); };
  const changeLanguage = (next: AppLocale) => {
    resetReading();
    setLocale(next);
    const id = next === "en" ? "web-en" : next === "zh-TW" ? "cuv-trad" : "cuv-simp";
    setSelectedVersion(id); saveSettings(id, fontStep);
  };

  const entries = entriesByLocale[locale] ?? entriesByLocale["zh-CN"] ?? [];
  const entry = entries.length ? entries[activeIndex % entries.length] : null;
  const verseText = translatedVerse?.identity === verseIdentity ? translatedVerse.text : copy("正在加载经文…", "Loading passage…");
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
    legendTimerRef.current = window.setTimeout(() => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.closest("[data-tv-controls]")) focused.blur();
      setLegendOn(false);
    }, LEGEND_MS);
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
      const rows = await loadChapter(bookId, chapter);
      const verses = Array.from({ length: Math.max(...rows.map((r) => r.verse)) }, (_, i) => rows.find((r) => r.verse === i + 1)?.text || "");
      if (!isCurrent()) return;
      setPlanView({ title, verses, cur: 0 });
      for (const u of (version === "cuv-simp" || version === "cuv-trad" ? [`/verse-timings/cuv-v20/${bookId}-${chapter}.json`] : [])) {
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
      if (isCurrent()) say(copy("经文加载失败", "Could not load passage"));
    }
  }, [loadChapter, version, say, copy]);

  const planDbgRef = useRef(0);
  const onPlanTime = useCallback(() => {
    const a = planAudioRef.current;
    if (!a) return;
    const ch = planRef.current?.chapters[planRef.current.i];
    if (ch && a.getAttribute("src") && a.currentTime > 0) writeTodayPlanScriptureResume({ ...ch, scopeKey: resolveLocalTodayReadingScopeKey(), positionSec: a.currentTime });
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
      if (!tm?.length || a.paused) return pv;
      cur = (verseNumberAtChapterAudioTime(t, tm) ?? 1) - 1;
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
    async (i: number) => {
      const st = planRef.current;
      const a = planAudioRef.current;
      if (!st || !a) return;
      const ch = st.chapters[i];
      if (!ch) {
        planRef.current = null;
        setPlanView(null);
        say(copy("今日读经读完了", "Today’s reading is complete"));
        if (musicRef.current) void playAudio(musicRef.current).catch(() => {});
        return;
      }
      a.pause();
      a.removeAttribute("src");
      st.i = i;
      musicRef.current?.pause();
      stopVerseSequence();
      verseAudioRef.current?.pause();
      const request = ++planRequestRef.current;
      const name = `${getScriptureBookDisplayName(ch.bookId, locale)} ${ch.chapter}`;
      void loadPlanChapterText(ch.bookId, ch.chapter, name);
      if (!translationSupportsChapterAudio(version)) { say(noAudio); return; }
      let result;
      try { result = await resolveChapterAudioPlayableSrc({ translationId: version, bookName: getScriptureBookDisplayName(ch.bookId, "zh-CN"), ...ch }); }
      catch { if (request === planRequestRef.current) say(copy("这一章音频暂不可用", "Audio is unavailable for this chapter")); return; }
      if (request !== planRequestRef.current) return;
      if (!result.ok) { say(copy("这一章音频暂不可用", "Audio is unavailable for this chapter")); return; }
      a.src = result.src;
      void playAudio(a).then(
        () => say(`${copy("今日读经", "Today’s reading")}: ${name} (${i + 1}/${st.chapters.length})`),
        () => say(copy("读经播放失败", "Could not play chapter audio")),
      );
    },
    [say, loadPlanChapterText, playAudio, stopVerseSequence, version, locale, noAudio, copy],
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
      resumeAtRef.current = (version === "cuv-simp" || version === "cuv-trad") && resume && index >= 0 && resume.target.bookId === target?.bookId && resume.target.chapter === target?.chapter ? resume.startAtSec : 0;
      playPlanChapter(planRef.current.i);
    } catch { say("读经进度加载失败，请重试"); }
    finally { setPlanLoading(false); }
  }, [bootstrapped, user, planLoading, playPlanChapter, say, version]);

  const onPlanEnded = useCallback(() => {
    const st = planRef.current;
    if (!st?.chapters.length) return;
    resumeAtRef.current = 0;
    void playPlanChapter((st.i + 1) % st.chapters.length);
  }, [playPlanChapter]);

  const playVerseAudio = useCallback(() => {
    const key = verseKeys?.[activeIndex];
    const src = key && goldenVersion ? buildGoldenVerseAudioRemoteSrc(key, goldenVersion) : null;
    const v = verseAudioRef.current;
    if (!v || !src) {
      stopVerseSequence();
      say(copy("此版本暂无金句音频", "Verse audio is unavailable for this version"));
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
  }, [activeIndex, goldenVersion, copy, say, verseKeys, playAudio, setVerseAudioSequenceActive, stopVerseSequence]);

  useEffect(() => {
    if (!verseSequenceRef.current || versePausedRef.current) return;
    const key = verseKeys?.[activeIndex];
    const src = key && goldenVersion ? buildGoldenVerseAudioRemoteSrc(key, goldenVersion) : null;
    if (src !== verseSourceRef.current) playVerseAudio();
  }, [activeIndex, goldenVersion, verseKeys, playVerseAudio]);

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
          const src = key && goldenVersion ? buildGoldenVerseAudioRemoteSrc(key, goldenVersion) : null;
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
  }, [showLegend, playAlbum, playVerseAudio, startPlan, playAudio, verseKeys, activeIndex, goldenVersion, advanceVerseAudioNow]);
  const live = useRef(runAction);
  live.current = runAction;
  useEffect(() => {
    showLegend();
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.getAttribute("aria-label") === "Passage" || (e.target as HTMLElement)?.getAttribute("aria-label") === "经文" || (e.target as HTMLElement)?.getAttribute("aria-label") === "經文") { if (e.key.startsWith("Arrow")) return; }
      const interactive = (e.target as HTMLElement)?.closest("button, a, input, select, textarea");
      if (interactive?.tagName === "SELECT") return;
      if (interactive && (e.key === "Enter" || e.key === " ")) return;
      if (interactive && e.key.startsWith("Arrow")) {
        const controls = Array.from(document.querySelectorAll<HTMLElement>("[data-tv-controls] button, [data-tv-controls] a, [data-tv-controls] select"));
        const at = controls.indexOf(interactive as HTMLElement);
        controls[(at + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + controls.length) % controls.length]?.focus();
        e.preventDefault(); return;
      }
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

  return (
    <div
      onPointerMove={showLegend}
      onClick={showLegend}
      onFocusCapture={showLegend}
      onKeyDownCapture={showLegend}
      onChangeCapture={showLegend}
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "linear-gradient(160deg, #3b6f8f 0%, #5b8a6a 55%, #b0884a 100%)", overflow: "hidden", color: "#fff" }}
    >
      {video?.posterSrc ? (
        // 普通 img 不占媒体解码器，电视音频播放期间仍能显示风景。
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.posterSrc} alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : null}
      {entry ? (
        <TvScriptureDisplay
          label={copy("经文", "Passage")}
          text={planView?.verses.length ? planView.verses[planView.cur] : verseText}
          nextText={planView?.verses[planView.cur + 1]}
          reference={planView?.verses.length
            ? `${planView.title} · ${planView.cur + 1}`
            : `${entry.ref} · ${translations.find((t) => t.id === version)?.[locale === "en" ? "labelEn" : "labelZh"] ?? ""}`}
          scale={scale}
        />
      ) : null}
      <div style={{ position: "absolute", left: "3vw", bottom: "3vh", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
        {toast ? <p style={{ margin: "0 0 1vh", fontSize: "min(1.8vw, 2.8vh)", fontWeight: 600 }}>{toast}</p> : null}
        {legendOn ? (
          <div data-tv-controls
            style={{
              margin: 0,
              padding: "1.6vh 2vw",
              width: "94vw",
              boxSizing: "border-box",
              fontSize: "min(1.3vw, 2.2vh)",
              background: "rgba(0,0,0,0.45)",
              borderRadius: 16,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1vh 1.6vw", marginBottom: "1.2vh" }}>
              <label>{copy("语言", "Language")} <select aria-label={copy("语言", "Language")} value={locale} onChange={(e) => changeLanguage(e.target.value as AppLocale)} style={{ color: "white", background: "#26332c", font: "inherit" }}><option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option><option value="en">English</option></select></label>
              <label>{copy("圣经版本", "Bible version")} <select aria-label={copy("圣经版本", "Bible version")} value={version} onChange={(e) => changeVersion(e.target.value)} style={{ color: "white", background: "#26332c", font: "inherit", maxWidth: "36vw" }}>{translations.filter((t) => locale === "en" ? t.language.startsWith("en") : t.language.startsWith("zh")).map((t) => <option key={t.id} value={t.id}>{locale === "en" ? t.labelEn : locale === "zh-TW" ? toZhTwText(t.labelZh) : t.labelZh} · {translationSupportsChapterAudio(t.id) ? copy("可朗读", "Audio") : copy("不能朗读", "No audio")}</option>)}</select></label>
              <label>{copy("字号", "Text size")} <select aria-label={copy("字号", "Text size")} value={fontStep} onChange={(e) => { const step = Number(e.target.value); setFontStep(step); saveSettings(version, step); }} style={{ color: "white", background: "#26332c", font: "inherit" }}>{[copy("小", "Small"), copy("标准", "Standard"), copy("大", "Large"), copy("特大", "Extra large")].map((label, i) => <option key={i} value={i}>{label}</option>)}</select></label>
              <span role="status" style={{ opacity: 0.8 }}>{!translationSupportsChapterAudio(version) ? noAudio : !goldenVersion ? copy("整章可朗读 · 金句暂无音频", "Chapter audio available · No verse audio") : copy("整章与金句均可朗读", "Chapter and verse audio available")}</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", columnGap: "2.4vw", rowGap: "0.6vh" }}>
            {LEGEND.map((l, index) => (
              <li key={l}><button type="button" onClick={() => runAction(l.startsWith("↑") ? "ArrowUp" : l.startsWith("←") ? "ArrowRight" : l[0])} style={{ color: "inherit", background: "transparent", border: 0, font: "inherit", padding: "0.5vh 0", cursor: "pointer", textShadow: "inherit" }}>{l === "8 今日读经" && planLoading ? copy("8 同步进度中…", "8 Syncing…") : copy(l, LEGEND_EN[index])}</button></li>
            ))}
            </ul>
            {planView ? <div><button onClick={() => setPlanView((p) => p ? { ...p, cur: Math.max(0, p.cur - 1) } : p)}>{copy("上一节经文", "Previous verse")}</button> <button onClick={() => setPlanView((p) => p ? { ...p, cur: Math.min(p.verses.length - 1, p.cur + 1) } : p)}>{copy("下一节经文", "Next verse")}</button></div> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6vh 2.4vw", marginTop: "0.6vh", overflowWrap: "anywhere" }}>
            <span>{user ? <button type="button" onClick={() => void logout().catch(() => say("退出失败，请重试"))} style={{ color: "inherit", background: "transparent", border: 0, font: "inherit", cursor: "pointer" }}>已登录 · {user.name || "我的账号"}（退出）</button> : <a href="/login?next=/tv" style={{ color: "inherit" }}>{copy("登录", "Sign in")}</a>}</span>
            <a href="/tv-check.html" style={{ color: "inherit" }}>{copy("检查页", "Diagnostics")}</a>
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
