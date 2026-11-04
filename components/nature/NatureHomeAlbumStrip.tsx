"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { MusicAlbumGlyph } from "@/components/music/MusicAlbumGlyph";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import { ShellMaterialIcon } from "@/components/shell/ShellMaterialIcon";
import { isShellMusicOnWeb, resolveCurrentMusicAlbumWeb, startHomeAlbumPlaybackWeb } from "@/lib/home/home-nature-album-playback";
import { musicAlbumShortLabelEn } from "@/lib/music/music-album-catalog-ui";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

const ALBUMS = ["安静", "下午茶", "专注工作", "睡眠", "钢琴", "赞美诗"];
type Props = {
  goldenVersePlaying: boolean;
  goldenVerseAudible?: boolean;
  goldenVersePreparing?: boolean;
  onToggleGoldenVerse: () => void;
  onPauseVerseTransport?: () => void;
  onResumeVerseTransport?: () => void;
  optionsOnly?: boolean;
  onOptionsOpenChange?: (open: boolean) => void;
};

/** 短按播放，长按选择专辑；选专辑保持原来的播放/暂停意图。 */
export function NatureHomeAlbumStrip({ goldenVersePlaying, goldenVersePreparing, onToggleGoldenVerse, onResumeVerseTransport, optionsOnly = false, onOptionsOpenChange }: Props) {
  const { locale } = useLocale();
  const playback = useMusicShellPlayback();
  const playing = isShellMusicOnWeb(playback);
  const currentAlbum = resolveCurrentMusicAlbumWeb(playback);
  const [selected, setSelected] = useState("安静");
  const priorAlbum = useRef(currentAlbum);
  useEffect(() => {
    try { const saved = localStorage.getItem("askbible-home-music-album"); if (saved && ALBUMS.includes(saved)) setSelected(saved); } catch {}
  }, []);
  useEffect(() => {
    if (currentAlbum && (playing || currentAlbum !== priorAlbum.current)) setSelected(currentAlbum);
    priorAlbum.current = currentAlbum;
  }, [currentAlbum, playing]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const start = useRef<{x: number; y: number} | null>(null);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { onOptionsOpenChange?.(open); }, [open, onOptionsOpenChange]);
  const text = (zh: string, en: string) => locale === "en" ? en : locale === "zh-TW" ? toZhTwText(zh) : zh;
  const choose = (album: string) => {
    setSelected(album);
    try { localStorage.setItem("askbible-home-music-album", album); } catch {}
    startHomeAlbumPlaybackWeb(playback, album, { duckForVerse: goldenVersePlaying, autoPlay: playing });
    if (goldenVersePlaying) onResumeVerseTransport?.();
    setOpen(false);
  };
  const options = <div className="nature-home-album-options" aria-label={text("音乐专辑", "Music albums")}>
    {ALBUMS.map(album => <button type="button" key={album} aria-pressed={selected === album} onClick={() => choose(album)}>
      <MusicAlbumGlyph album={album} size={28} color={selected === album ? "var(--brand-logo-background)" : "currentColor"} />
      <span>{text(album, musicAlbumShortLabelEn(album))}</span>
    </button>)}
  </div>;
  if (optionsOnly) return options;
  return <div className="nature-home-sound-controls" data-shell-swipe-nav-exclude>
    {open && <div className="nature-home-album-popup">{options}<button type="button" onClick={() => setOpen(false)}>{text("关闭", "Close")}</button></div>}
    <div className="nature-home-album-strip">
      <button type="button" className="nature-home-album-strip__btn" aria-label={text("音乐", "Music")} aria-pressed={playing}
        aria-haspopup="true" aria-expanded={open}
        onPointerDown={e => { cancel(); held.current = false; start.current = {x:e.clientX,y:e.clientY}; timer.current = setTimeout(() => { held.current = true; setOpen(true); }, 500); }}
        onPointerMove={e => { if (start.current && Math.hypot(e.clientX-start.current.x,e.clientY-start.current.y)>12) { cancel(); held.current=true; } }}
        onPointerUp={cancel} onPointerCancel={() => { cancel(); held.current=true; }} onPointerLeave={cancel}
        onContextMenu={e => { e.preventDefault(); cancel(); held.current = true; setOpen(true); }}
        onKeyDown={e => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }}
        onClick={() => { if (held.current) { held.current = false; return; } if (playing) playback.pausePlayback(); else startHomeAlbumPlaybackWeb(playback, selected, {duckForVerse:goldenVersePlaying}); if (goldenVersePlaying) onResumeVerseTransport?.(); }}>
        <MusicAlbumGlyph album={selected} size={28} color={playing ? "var(--brand-logo-background)" : "white"} />
        <span>{text("音乐", "Music")}</span>
      </button>
      <button type="button" className="nature-home-album-strip__btn" aria-label={text("朗读", "Read aloud")} aria-pressed={goldenVersePlaying} onClick={onToggleGoldenVerse}>
        {goldenVersePreparing ? <span className="nature-home-verse-spinner" /> : <ShellMaterialIcon name="volume-up" size={28} color={goldenVersePlaying ? "var(--brand-logo-background)" : "white"} legibilityShadow />}
        <span>{text("朗读", "Read aloud")}</span>
      </button>
    </div>
  </div>;
}
