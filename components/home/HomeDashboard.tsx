"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MusicCompanionStore } from "@/lib/music-companion/types";
import {
  HOME_ATMOSPHERE_PRESETS,
  getMusicVisualAtmospherePresetForHome,
  type HomeAtmospherePresetId,
  useHomeAtmosphereVisual,
  useMusicVisualTuning,
} from "@/music-visual";
import { MUSIC_VISUAL_TUNING_LIMITS as TL } from "@/music-visual/tuning/schema";
import { HomeVerseRotator } from "@/components/home/HomeVerseRotator";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { AppShellModal } from "@/components/ui/AppShellModal";

const SacredAtmosphereCanvas = dynamic(
  () =>
    import("@/music-visual/components/sacred-atmosphere/SacredAtmosphereCanvas").then((m) => ({
      default: m.SacredAtmosphereCanvas,
    })),
  { ssr: false },
);

const HOME_BACKDROP_STORAGE_KEY = "selah-home-backdrop-mode";

type HomeBackdropMode = "atmosphere" | "image";

/** 深色氛围底：前景改用与「图像」模式一致的浅色字与控件 */
const DARK_ATMOSPHERE_PRESETS = new Set<HomeAtmospherePresetId>(["dusk", "mist", "ember"]);

function AtmosphereLayers({ preset }: { preset: HomeAtmospherePresetId }) {
  switch (preset) {
    case "lagoon":
      return (
        <>
          <div className="absolute inset-0 bg-canvas" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-br from-sky-200/40 via-transparent to-cyan-100/28"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[34%] bg-gradient-to-br from-sky-300/45 via-sky-100/18 to-teal-100/30 motion-safe:animate-amb-home-aurora-drift-a will-change-transform"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_88%_56%_at_12%_88%,rgba(56,189,248,0.22),transparent_54%)] motion-safe:animate-amb-home-aurora-bokeh-1 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_88%_12%,rgba(45,212,191,0.18),transparent_56%)] motion-safe:animate-amb-home-float-2 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[26%] mix-blend-soft-light bg-gradient-to-tl from-cyan-100/30 via-transparent to-sky-200/22 motion-safe:animate-amb-home-aurora-sheen will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-sand/[0.08] via-transparent to-transparent"
            aria-hidden
          />
        </>
      );
    case "parchment":
      return (
        <>
          <div className="absolute inset-0 bg-canvas" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-br from-slate-200/30 via-transparent to-sand/[0.1]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[32%] bg-[radial-gradient(ellipse_68%_52%_at_28%_22%,rgba(148,163,184,0.2),transparent_56%)] blur-2xl motion-safe:animate-amb-home-parchment-drift will-change-transform"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_52%_at_50%_-8%,rgba(184,148,90,0.14),transparent_54%)] motion-safe:animate-amb-home-float-1 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[22%] bg-gradient-to-r from-transparent via-white/14 to-transparent motion-safe:animate-amb-home-sweep will-change-transform"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-border/35 via-transparent to-transparent"
            aria-hidden
          />
        </>
      );
    case "dawn":
      return (
        <>
          <div className="absolute inset-0 bg-[#d8e4f2]" aria-hidden />
          <div
            className="pointer-events-none absolute -inset-[36%] bg-gradient-to-br from-sky-200/50 via-cyan-100/22 to-indigo-100/38 motion-safe:animate-amb-home-aurora-drift-a will-change-transform"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_92%_58%_at_10%_90%,rgba(96,165,250,0.26),transparent_52%)] motion-safe:animate-amb-home-aurora-bokeh-1 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_78%_50%_at_90%_10%,rgba(147,197,253,0.22),transparent_54%)] motion-safe:animate-amb-home-float-2 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[28%] mix-blend-soft-light bg-gradient-to-tl from-rose-100/35 via-transparent to-sky-100/28 motion-safe:animate-amb-home-aurora-sheen will-change-[transform,opacity]"
            aria-hidden
          />
        </>
      );
    case "dusk":
      return (
        <>
          <div className="absolute inset-0 bg-[#06060a]" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-b from-indigo-950/55 via-[#0f0a18]/92 to-black"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[42%] rounded-full bg-[radial-gradient(ellipse_56%_46%_at_68%_32%,rgba(99,102,241,0.38),transparent_60%)] blur-3xl motion-safe:animate-amb-home-float-1 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[38%] rounded-full bg-[radial-gradient(ellipse_52%_44%_at_24%_68%,rgba(168,85,247,0.26),transparent_58%)] blur-3xl motion-safe:animate-amb-home-float-2 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_96%_62%_at_50%_102%,rgba(30,27,64,0.72),transparent_50%)] motion-safe:animate-amb-home-glow-pulse will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[32%] bg-violet-400/[0.12] motion-safe:animate-amb-home-ember-drift-a will-change-transform"
            aria-hidden
          />
        </>
      );
    case "mist":
      return (
        <>
          <div className="absolute inset-0 bg-[#070d10]" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-b from-emerald-950/45 via-slate-950/85 to-black"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[40%] rounded-full bg-[radial-gradient(ellipse_58%_48%_at_16%_40%,rgba(45,212,191,0.22),transparent_60%)] blur-3xl motion-safe:animate-amb-home-aurora-drift-b will-change-transform"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[44%] rounded-full bg-[radial-gradient(ellipse_54%_46%_at_84%_60%,rgba(148,163,184,0.24),transparent_56%)] blur-3xl motion-safe:animate-amb-home-float-1 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_58%_at_50%_-6%,rgba(94,234,212,0.14),transparent_48%)] motion-safe:animate-amb-home-calm-bokeh-2 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[22%] bg-gradient-to-r from-transparent via-teal-200/14 to-transparent motion-safe:animate-amb-home-sweep will-change-transform"
            aria-hidden
          />
        </>
      );
    case "ember":
      return (
        <>
          <div className="absolute inset-0 bg-[#0a0807]" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-t from-red-950/40 via-[#140d0a] to-[#050403]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[48%] rounded-full bg-[radial-gradient(ellipse_50%_40%_at_50%_108%,rgba(234,88,12,0.5),transparent_58%)] blur-3xl motion-safe:animate-amb-home-ember-bokeh-1 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[42%] rounded-full bg-[radial-gradient(ellipse_44%_38%_at_76%_26%,rgba(251,146,60,0.24),transparent_56%)] blur-3xl motion-safe:animate-amb-home-ember-drift-b will-change-transform"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_72%_42%_at_18%_16%,rgba(220,38,38,0.16),transparent_52%)] motion-safe:animate-amb-home-ember-bokeh-2 will-change-[transform,opacity]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -inset-[18%] bg-gradient-to-br from-orange-500/18 via-transparent to-transparent motion-safe:animate-amb-home-ember-sheen will-change-[transform,opacity]"
            aria-hidden
          />
        </>
      );
    default:
      return null;
  }
}

function pickThumbUrl(store: MusicCompanionStore): string | null {
  const img = store.backgroundVisuals.find((b) => b.type === "image" && b.imageSrc?.trim());
  return img?.imageSrc?.trim() ?? null;
}

function IconMenu(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 18"
      fill="none"
      className={props.className}
      aria-hidden
    >
      <path d="M1 1.25h22M1 9h22M1 16.75h22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconUserAvatar(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function MusicVisualTuneRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
  decimals?: number;
  dark: boolean;
}) {
  const d = props.decimals ?? 2;
  return (
    <label
      className={`flex items-center gap-2 py-1.5 text-[11px] ${props.dark ? "text-canvas/78" : "text-ink/58"}`}
    >
      <span className="w-[5.5rem] shrink-0 leading-snug">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className={`min-w-0 flex-1 ${props.dark ? "accent-white/45" : "accent-ink/30"}`}
      />
      <span
        className={`w-10 shrink-0 text-right tabular-nums text-[10px] ${props.dark ? "text-canvas/48" : "text-ink/42"}`}
      >
        {props.value.toFixed(d)}
      </span>
    </label>
  );
}

export function HomeDashboard() {
  const { t } = useLocale();
  const [store, setStore] = useState<MusicCompanionStore | null>(null);
  const [backdropMode, setBackdropMode] = useState<HomeBackdropMode>("atmosphere");
  const { homeAtmospherePresetId, setHomeAtmospherePresetId } = useHomeAtmosphereVisual();
  const atmospherePreset = homeAtmospherePresetId;
  const [atmospherePickerOpen, setAtmospherePickerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [musicVisualPanelOpen, setMusicVisualPanelOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const atmosphereControlsRef = useRef<HTMLDivElement>(null);
  const { tuning, setTuning, resetTuning } = useMusicVisualTuning();
  const engineAtmosphere = useMemo(
    () => getMusicVisualAtmospherePresetForHome(homeAtmospherePresetId),
    [homeAtmospherePresetId],
  );
  const dismissMusicVisualPanel = useCallback(() => setMusicVisualPanelOpen(false), []);

  useEffect(() => {
    try {
      const v = localStorage.getItem(HOME_BACKDROP_STORAGE_KEY);
      if (v === "image" || v === "atmosphere") setBackdropMode(v);
    } catch {
      /* ignore */
    }
  }, []);

  const setBackdropModePersist = (mode: HomeBackdropMode) => {
    setBackdropMode(mode);
    if (mode === "image") setAtmospherePickerOpen(false);
    try {
      localStorage.setItem(HOME_BACKDROP_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const setAtmospherePresetPersist = (id: HomeAtmospherePresetId) => {
    setHomeAtmospherePresetId(id);
    setAtmospherePickerOpen(false);
  };

  const onAtmosphereModeTabClick = () => {
    if (backdropMode === "atmosphere") {
      setAtmospherePickerOpen((o) => !o);
      return;
    }
    setBackdropModePersist("atmosphere");
    setAtmospherePickerOpen(true);
  };

  useEffect(() => {
    if (!userMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  useEffect(() => {
    if (!atmospherePickerOpen || backdropMode !== "atmosphere") return;
    const onDown = (e: MouseEvent) => {
      if (atmosphereControlsRef.current?.contains(e.target as Node)) return;
      setAtmospherePickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAtmospherePickerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [atmospherePickerOpen, backdropMode]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/music/companion", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const next = (await res.json()) as MusicCompanionStore | { error?: string };
        if ("error" in next && next.error) return;
        if (!cancelled) setStore(next as MusicCompanionStore);
      } catch {
        /* ignore */
      }
    };
    void load();
  }, []);

  const thumbUrl = useMemo(() => (store ? pickThumbUrl(store) : null), [store]);
  const isImage = backdropMode === "image";
  const homeDarkAtmosphere = !isImage && DARK_ATMOSPHERE_PRESETS.has(atmospherePreset);
  const useCanvasChrome = isImage || homeDarkAtmosphere;

  return (
    <main className="relative flex min-h-full w-full min-w-0 flex-1 flex-col overflow-x-hidden bg-transparent">
      {/* 音乐呼吸仅作用在背景层；顶栏、经文、控件不随 scale 变形 */}
      <div className="relative isolate flex min-h-0 w-full flex-1 shrink-0 flex-col overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden music-reactive-home-shell"
          aria-hidden
        >
        {isImage && thumbUrl ? (
          <Image
            src={thumbUrl}
            alt=""
            fill
            className="object-cover object-center"
            sizes="100vw"
            unoptimized
            priority
          />
        ) : null}
        {isImage && !thumbUrl ? (
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#6b5d4e] via-[#4a3f36] to-[#2a231c]"
            aria-hidden
          />
        ) : null}
        {!isImage ? <AtmosphereLayers preset={atmospherePreset} /> : null}
        {!isImage && homeDarkAtmosphere ? (
          <div
            className="pointer-events-none absolute inset-0 z-[4] opacity-[0.38] mix-blend-soft-light"
            aria-hidden
          >
            <SacredAtmosphereCanvas />
          </div>
        ) : null}
        {isImage ? (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-black/72"
            aria-hidden
          />
        ) : homeDarkAtmosphere ? (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/42 via-black/16 to-black/78"
            aria-hidden
          />
        ) : (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/[0.04] via-transparent to-ink/[0.06]"
            aria-hidden
          />
        )}

        {/* 底部轻晕：与底栏衔接，略增沉浸 */}
        <div
          className={
            isImage || homeDarkAtmosphere
              ? "music-reactive-home-glow-dark pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[min(32vh,14rem)] bg-gradient-to-t from-black/35 via-black/10 to-transparent"
              : "music-reactive-home-glow pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[min(24vh,9rem)] bg-gradient-to-t from-ink/[0.05] via-transparent to-transparent"
          }
          aria-hidden
        />
        </div>

        <header className="pointer-events-none absolute inset-x-0 top-0 z-50 flex px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 sm:px-5">
          <div className="flex w-full items-center justify-between">
            <Link
              href="/explore"
              className={
                useCanvasChrome
                  ? "pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-canvas/90 transition hover:bg-canvas/14 active:scale-[0.97]"
                  : "pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-ink/85 transition hover:bg-ink/[0.06] active:scale-[0.97]"
              }
              aria-label="探索"
            >
              <IconMenu className="h-[11px] w-[0.88rem] opacity-90" />
            </Link>
            <p
              className={
                useCanvasChrome
                  ? "pointer-events-none font-serif text-[12px] font-normal tracking-[0.14em] text-canvas/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                  : "pointer-events-none font-serif text-[12px] font-normal tracking-[0.14em] text-ink/85"
              }
            >
              Selah.my
            </p>
            <div className="pointer-events-auto relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                aria-label={userMenuOpen ? "关闭菜单" : "用户菜单"}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                aria-controls="home-user-menu"
                className={
                  useCanvasChrome
                    ? "flex h-9 w-9 items-center justify-center rounded-full text-canvas/90 transition hover:bg-canvas/14 active:scale-[0.97]"
                    : "flex h-9 w-9 items-center justify-center rounded-full text-ink/85 transition hover:bg-ink/[0.06] active:scale-[0.97]"
                }
              >
                <IconUserAvatar className="h-[14px] w-[14px] opacity-88" />
              </button>
              {userMenuOpen ? (
                <div
                  id="home-user-menu"
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.35rem)] z-[60] min-w-[10.5rem] rounded-xl border border-white/20 bg-ink/88 py-1 shadow-xl backdrop-blur-md"
                >
                  <Link
                    href="/admin/studio"
                    role="menuitem"
                    className="block px-3 py-2.5 text-[13px] text-canvas/95 transition hover:bg-white/10"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    内部 · Studio
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-3 py-2.5 text-left text-[13px] text-canvas/95 transition hover:bg-white/10"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setMusicVisualPanelOpen(true);
                    }}
                  >
                    播放视觉…
                  </button>
                  <Link
                    href="/admin/music"
                    role="menuitem"
                    className="block px-3 py-2.5 text-[13px] text-canvas/95 transition hover:bg-white/10"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    曲库与配图
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col pt-[max(3.25rem,env(safe-area-inset-top)+1.5rem)] sm:pt-[max(3.5rem,env(safe-area-inset-top)+1.75rem)]">
          <div
            className={
              useCanvasChrome
                ? "flex min-h-0 w-full flex-1 flex-col justify-between px-0 text-canvas"
                : "flex min-h-0 w-full flex-1 flex-col justify-between px-0 text-ink"
            }
          >
            {/* 经文块对齐主区垂直黄金分割点（1/φ² ≈ 38.2%），以块中心落在该线上 */}
            <div className="relative min-h-0 flex-1">
              <div className="absolute left-1/2 top-[38.2%] z-[1] flex w-full -translate-x-1/2 -translate-y-1/2 justify-center px-5 sm:px-6">
                <HomeVerseRotator
                  variant={useCanvasChrome ? "dark" : "light"}
                  className="min-h-[7rem] max-w-[19rem] sm:max-w-[21.5rem]"
                />
              </div>
            </div>

            <div
              ref={atmosphereControlsRef}
              className="pointer-events-auto relative mt-auto flex w-full shrink-0 flex-col items-center px-4 pb-4 pt-1 sm:px-5 sm:pb-5"
            >
              {!isImage && atmospherePickerOpen ? (
                <div className="pointer-events-auto absolute bottom-full left-0 right-0 z-[15] mb-2 flex justify-center px-1">
                  <div
                    role="listbox"
                    aria-label="氛围样式"
                    className="flex max-w-full gap-1 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {HOME_ATMOSPHERE_PRESETS.map((p) => {
                      const on = atmospherePreset === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={on}
                          onClick={() => setAtmospherePresetPersist(p.id)}
                          className={
                            on
                              ? useCanvasChrome
                                ? "min-h-8 shrink-0 rounded-full bg-white/[0.14] px-2.5 py-1 text-[10px] font-medium tracking-wide text-canvas/95"
                                : "min-h-8 shrink-0 rounded-full bg-ink/[0.09] px-2.5 py-1 text-[10px] font-medium tracking-wide text-ink/85"
                              : useCanvasChrome
                                ? "min-h-8 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide text-canvas/42 transition hover:text-canvas/72"
                                : "min-h-8 shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium tracking-wide text-ink/38 transition hover:text-ink/62"
                          }
                        >
                          {t(`music.atmosphere.${p.id}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div
                role="tablist"
                aria-label="首页背景"
                className={
                  useCanvasChrome
                    ? "inline-flex rounded-full bg-white/[0.04] p-[3px] backdrop-blur-sm"
                    : "inline-flex rounded-full bg-ink/[0.035] p-[3px] backdrop-blur-sm"
                }
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isImage}
                  aria-expanded={!isImage ? atmospherePickerOpen : undefined}
                  onClick={onAtmosphereModeTabClick}
                  className={
                    !isImage
                      ? useCanvasChrome
                        ? "min-h-[2.25rem] rounded-full bg-white/[0.14] px-3 py-1 text-[11px] font-medium tracking-wide text-canvas/95"
                        : "min-h-[2.25rem] rounded-full bg-ink/[0.07] px-3 py-1 text-[11px] font-medium tracking-wide text-ink/88"
                      : "min-h-[2.25rem] rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-canvas/50 transition hover:text-canvas/82"
                  }
                >
                  {t("music.home.bgAmbient")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isImage}
                  onClick={() => setBackdropModePersist("image")}
                  className={
                    isImage
                      ? "min-h-[2.25rem] rounded-full bg-white/[0.12] px-3 py-1 text-[11px] font-medium tracking-wide text-canvas/95"
                      : useCanvasChrome
                        ? "min-h-[2.25rem] rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-canvas/45 transition hover:text-canvas/75"
                        : "min-h-[2.25rem] rounded-full px-3 py-1 text-[11px] font-medium tracking-wide text-ink/40 transition hover:text-ink/68"
                  }
                >
                  {t("music.home.bgImages")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AppShellModal
        open={musicVisualPanelOpen}
        onDismiss={dismissMusicVisualPanel}
        labelledBy="music-visual-tuning-title"
      >
        <div
          className={`relative z-[1] mx-auto w-full max-w-[min(100%,20rem)] rounded-2xl border px-4 py-3 shadow-2xl ${
            useCanvasChrome
              ? "border-white/14 bg-black/78 text-canvas"
              : "border-border/45 bg-canvas/[0.98] text-ink"
          }`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2
              id="music-visual-tuning-title"
              className={`text-[12px] font-medium tracking-wide ${useCanvasChrome ? "text-canvas/88" : "text-ink/78"}`}
            >
              {t("chrome.playbackVisual")}
            </h2>
            <button
              type="button"
              onClick={dismissMusicVisualPanel}
              className={`rounded-lg px-2 py-1 text-[11px] font-medium ${useCanvasChrome ? "text-canvas/55 hover:bg-white/10" : "text-ink/45 hover:bg-ink/[0.05]"}`}
            >
              {t("common.done")}
            </button>
          </div>
          <p
            className={`mb-2 text-[10px] leading-snug ${useCanvasChrome ? "text-canvas/48" : "text-ink/48"}`}
          >
            首页「{t(`music.atmosphere.${homeAtmospherePresetId}`)}」→ 引擎「
            {engineAtmosphere.label}」（{engineAtmosphere.id}）。{" "}
            除播放键外，下方滑杆与氛围乘子叠加后写入 CSS；播放键为窄范围微调且不与总强度相乘。「跟曲线」「无数据呼吸」在引擎内随雾速/微粒密度轻微调制。
          </p>
          <div className="max-h-[min(58vh,22rem)] space-y-0.5 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] pr-0.5">
            <MusicVisualTuneRow
              dark={useCanvasChrome}
              label="总强度"
              min={TL.master.min}
              max={TL.master.max}
              step={1}
              value={tuning.master}
              onChange={(n) => setTuning({ master: n })}
            />
            <MusicVisualTuneRow
              dark={useCanvasChrome}
              label="光晕"
              min={TL.glowMul.min}
              max={TL.glowMul.max}
              step={2.5}
              value={tuning.glowMul}
              onChange={(n) => setTuning({ glowMul: n })}
            />
            <MusicVisualTuneRow
              dark={useCanvasChrome}
              label="深色光晕"
              min={TL.glowDarkExtra.min}
              max={TL.glowDarkExtra.max}
              step={2}
              value={tuning.glowDarkExtra}
              onChange={(n) => setTuning({ glowDarkExtra: n })}
            />
            <MusicVisualTuneRow
              dark={useCanvasChrome}
              label="背景呼吸"
              min={TL.shellBreathAmp.min}
              max={TL.shellBreathAmp.max}
              step={0.5}
              value={tuning.shellBreathAmp}
              onChange={(n) => setTuning({ shellBreathAmp: n })}
            />
            <MusicVisualTuneRow
              dark={useCanvasChrome}
              label="播放键"
              min={TL.playPulseMul.min}
              max={TL.playPulseMul.max}
              step={0.03}
              value={tuning.playPulseMul}
              onChange={(n) => setTuning({ playPulseMul: n })}
            />
            <MusicVisualTuneRow
              dark={useCanvasChrome}
              label="无数据呼吸"
              min={TL.fallbackBreath.min}
              max={TL.fallbackBreath.max}
              step={0.25}
              value={tuning.fallbackBreath}
              onChange={(n) => setTuning({ fallbackBreath: n })}
            />
            <MusicVisualTuneRow
              dark={useCanvasChrome}
              label="跟曲线"
              min={TL.analysisBlend.min}
              max={TL.analysisBlend.max}
              step={0.1}
              value={tuning.analysisBlend}
              onChange={(n) => setTuning({ analysisBlend: n })}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => resetTuning()}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium ${
                useCanvasChrome
                  ? "border-white/18 text-canvas/70 hover:bg-white/8"
                  : "border-border/50 text-ink/55 hover:bg-ink/[0.04]"
              }`}
            >
              恢复默认
            </button>
          </div>
        </div>
      </AppShellModal>
    </main>
  );
}
