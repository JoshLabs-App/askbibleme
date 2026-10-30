"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHomePrayerVerseFeedContext } from "@/components/home/HomePrayerVerseFeedContext";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { useNatureGoldenVerseAudioControl } from "@/hooks/useNatureGoldenVerseAudioControl";
import { isTvBrowser } from "@/lib/dom/is-tv-browser";
import { inferTrackAlbumFromCompanionTrack } from "@/lib/music/album-playback";

/** 遥控器数字键 → 内容。改这里，屏幕上的说明也跟着变。 */
const ALBUM_KEYS: Record<string, { album: string; label: string }> = {
  "1": { album: "安静", label: "轻音乐" },
  "3": { album: "下午茶", label: "下午茶轻快" },
  "4": { album: "钢琴", label: "钢琴" },
  "5": { album: "赞美诗", label: "圣诗" },
  "6": { album: "睡眠", label: "睡眠" },
  "7": { album: "专注工作", label: "专注" },
};
const LEGEND = ["1 轻音乐", "2 金句朗读", "3 下午茶轻快", "4 钢琴", "5 圣诗", "6 睡眠", "7 专注", "8 暂停/继续", "9 换一首", "0 检查页"];
const LEGEND_SHOW_MS = 15_000;

export function TvRemoteKeys() {
  const [isTv, setIsTv] = useState(false);
  useEffect(() => setIsTv(isTvBrowser()), []);
  return isTv ? <TvRemoteKeysInner /> : null;
}

function TvRemoteKeysInner() {
  const music = useMusicShellPlayback();
  const { verseKeys, activeIndex } = useHomePrayerVerseFeedContext();
  const verse = useNatureGoldenVerseAudioControl(verseKeys?.[activeIndex] ?? null);
  const [legendOn, setLegendOn] = useState(true);
  const [toast, setToast] = useState("");
  const albumRef = useRef("安静");
  const startedRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);

  // 回调放 ref：键盘监听只挂一次，不随播放状态反复重挂
  const live = useRef({ music, verse });
  live.current = { music, verse };

  const showLegend = useCallback(() => {
    setLegendOn(true);
    if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setLegendOn(false), LEGEND_SHOW_MS);
  }, []);

  const playAlbum = useCallback((album: string, label: string) => {
    const { music: m, verse: v } = live.current;
    const tracks = (m.musicStore?.audioTracks ?? []).filter((t) => inferTrackAlbumFromCompanionTrack(t) === album);
    if (tracks.length === 0) {
      setToast(`${label}：没有曲目`);
      return;
    }
    if (v.active) v.pauseVerseTransport();
    albumRef.current = album;
    const pick = tracks[Math.floor(Math.random() * tracks.length)];
    m.setPlaybackSrc(pick.src, { autoPlay: true });
    setToast(`正在播放：${label}`);
  }, []);

  // 打开就自动放轻音乐（浏览器拦自动播放时，遥控器第一次按键会补一次）
  const musicReady = Boolean(music.musicStore?.audioTracks?.length);
  useEffect(() => {
    if (startedRef.current || !musicReady) return;
    startedRef.current = true;
    playAlbum("安静", "轻音乐");
  }, [musicReady, playAlbum]);

  useEffect(() => {
    showLegend();
    const onKey = (e: KeyboardEvent) => {
      showLegend();
      const { music: m, verse: v } = live.current;
      // 自动播放被拦时：任意键都先补一次
      if (!m.playing && !v.active && startedRef.current && e.key !== "8" && !/^[0-9]$/.test(e.key)) {
        m.togglePlayMusic();
        return;
      }
      if (ALBUM_KEYS[e.key]) {
        playAlbum(ALBUM_KEYS[e.key].album, ALBUM_KEYS[e.key].label);
      } else if (e.key === "2") {
        m.pausePlayback();
        v.toggle();
        setToast("金句朗读");
      } else if (e.key === "8") {
        if (v.active) v.toggle();
        else m.togglePlayMusic();
      } else if (e.key === "9") {
        playAlbum(albumRef.current, "换一首");
      } else if (e.key === "0") {
        window.location.href = "/tv-check.html";
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current);
    };
  }, [playAlbum, showLegend]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-[95] text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
      {toast ? <p className="mb-2 text-[28px] font-semibold">{toast}</p> : null}
      {legendOn ? (
        <ul className="grid grid-cols-2 gap-x-8 gap-y-1 rounded-2xl bg-black/45 px-6 py-4 text-[22px] leading-snug">
          {LEGEND.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
