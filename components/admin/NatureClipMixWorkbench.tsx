"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/components/i18n/LocaleProvider";
import type { NatureAmbientClipEntry, NatureVideoMixLayer } from "@/lib/nature/types";

function volumeForClip(mix: NatureVideoMixLayer[] | undefined, clipId: string): number {
  const hit = (mix ?? []).find((l) => l.clipId === clipId);
  return hit?.volume ?? 0;
}

/**
 * 自然后台：极简混音 — 列出全部环境音素材，默认 0；需要处拉高；试听为满宽裁切画面 + 多轨声。
 */
export function NatureClipMixWorkbench({
  videoSrc,
  mix,
  ambientClips,
  onClipVolumeCommit,
}: {
  videoSrc: string;
  mix: NatureVideoMixLayer[] | undefined;
  ambientClips: NatureAmbientClipEntry[];
  onClipVolumeCommit: (clipId: string, volume: number) => void;
}) {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRefMap = useRef<Map<string, HTMLAudioElement>>(new Map());
  const mixKey = useMemo(() => JSON.stringify(mix ?? []), [mix]);
  const [liveByClip, setLiveByClip] = useState<Record<string, number>>({});
  const [previewOn, setPreviewOn] = useState(false);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const c of ambientClips) {
      next[c.id] = volumeForClip(mix, c.id);
    }
    setLiveByClip(next);
  }, [mixKey, mix, ambientClips]);

  useEffect(() => {
    if (!previewOn) return;
    for (const c of ambientClips) {
      const a = audioRefMap.current.get(c.id);
      if (a) a.volume = liveByClip[c.id] ?? 0;
    }
  }, [previewOn, liveByClip, ambientClips]);

  const bindAudio =
    (clipId: string) =>
    (el: HTMLAudioElement | null): void => {
      if (el) audioRefMap.current.set(clipId, el);
      else audioRefMap.current.delete(clipId);
    };

  const stopPreview = useCallback(() => {
    setPreviewOn(false);
    const v = videoRef.current;
    if (v) {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    for (const c of ambientClips) {
      const a = audioRefMap.current.get(c.id);
      if (a) {
        a.pause();
        try {
          a.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    }
  }, [ambientClips]);

  const startPreview = useCallback(async () => {
    if (ambientClips.length === 0 && !videoSrc.trim()) return;
    setPreviewOn(true);
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    const v = videoRef.current;
    for (const c of ambientClips) {
      const a = audioRefMap.current.get(c.id);
      if (a) {
        a.loop = true;
        a.volume = liveByClip[c.id] ?? 0;
        void a.play().catch(() => {});
      }
    }
    if (v && videoSrc.trim()) {
      v.muted = true;
      try {
        v.loop = true;
        await v.play();
      } catch {
        /* ignore */
      }
    }
  }, [ambientClips, videoSrc, liveByClip]);

  useEffect(() => {
    if (!previewOn) return;
    const v = videoRef.current;
    if (!v || !videoSrc.trim()) return;
    const audios = ambientClips
      .map((c) => audioRefMap.current.get(c.id))
      .filter((x): x is HTMLAudioElement => Boolean(x));
    const onPlay = () => {
      for (const a of audios) void a.play().catch(() => {});
    };
    const onPause = () => {
      for (const a of audios) a.pause();
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [previewOn, ambientClips, videoSrc]);

  const canPreview = ambientClips.length > 0 || Boolean(videoSrc.trim());

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-adminLine bg-adminPanel/25 p-3 md:p-4">
      <div className="rounded-md border border-adminLine/70 bg-adminBg/40 px-3 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-adminFg">{t("admin.naturePage.mixPreviewTitle")}</p>
            <p className="mt-0.5 max-w-prose text-[10px] leading-relaxed text-adminMuted">
              {t("admin.naturePage.mixPreviewHint")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={!canPreview || previewOn}
              onClick={() => void startPreview()}
              className="rounded-md border border-emerald-700/30 bg-emerald-700/10 px-2.5 py-1.5 text-[11px] font-medium text-emerald-950 hover:bg-emerald-700/16 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("admin.naturePage.mixPreviewPlay")}
            </button>
            <button
              type="button"
              disabled={!previewOn}
              onClick={() => stopPreview()}
              className="rounded-md border border-adminLine bg-adminPanel px-2.5 py-1.5 text-[11px] font-medium text-adminFg hover:border-sand disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("admin.naturePage.mixPreviewStop")}
            </button>
          </div>
        </div>

        {videoSrc.trim() ? (
          <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-md bg-black ring-1 ring-black/40">
            <video
              ref={videoRef}
              src={videoSrc}
              muted
              playsInline
              loop
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="sr-only" aria-hidden>
              {ambientClips.map((c) => (
                <audio key={c.id} ref={bindAudio(c.id)} src={c.src.trim()} preload="auto" loop />
              ))}
            </div>
          </div>
        ) : (
          <div className="sr-only" aria-hidden>
            {ambientClips.map((c) => (
              <audio key={c.id} ref={bindAudio(c.id)} src={c.src.trim()} preload="auto" loop />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[11px] font-medium text-adminFg">{t("admin.naturePage.mixStripTitle")}</p>
        {ambientClips.length === 0 ? (
          <p className="mt-1 text-[10px] text-adminMuted">{t("admin.naturePage.mixAllClipsEmpty")}</p>
        ) : (
          <ul className="mt-2 max-h-[min(24rem,50vh)] divide-y divide-adminLine/80 overflow-y-auto overscroll-y-contain border-y border-adminLine/80">
            {ambientClips.map((c) => {
              const pct = Math.round((liveByClip[c.id] ?? 0) * 100);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5 sm:gap-3">
                  <span className="min-w-0 flex-1 text-[11px] leading-snug text-adminFg">
                    {c.title?.trim() || c.src}
                  </span>
                  <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-[3]">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={pct}
                      onInput={(e) => {
                        const nv = Number(e.currentTarget.value) / 100;
                        setLiveByClip((prev) => ({ ...prev, [c.id]: nv }));
                        if (previewOn) {
                          const a = audioRefMap.current.get(c.id);
                          if (a) a.volume = nv;
                        }
                      }}
                      onPointerUp={(e) => {
                        const nv = Number(e.currentTarget.value) / 100;
                        setLiveByClip((prev) => ({ ...prev, [c.id]: nv }));
                        onClipVolumeCommit(c.id, nv);
                      }}
                      className="h-1.5 min-w-0 flex-1 cursor-pointer accent-emerald-700"
                    />
                    <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-adminMuted">
                      {pct}%
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
