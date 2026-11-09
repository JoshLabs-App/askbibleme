"use client";
import { useEffect, useState } from "react";
import { useAskbibleUser } from "@/components/auth/AskbibleUserProvider";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { useMusicShellPlayback } from "@/components/music/MusicShellPlaybackContext";
import {
  devotionalAvailable,
  loadDevotional,
  readDevotionalAuto,
  writeDevotionalAuto,
  devotionalAudioUrl,
  type DevotionalDay,
} from "@/lib/devotional/solid-joys";
import { setPlanFlowActive } from "@/lib/read/plan-flow-session";
import { writeReadingPlanAudioSession } from "@/lib/read/reading-plan-audio-session";

export function ReadPlanDevotional({ viewAhead }: { viewAhead: number }) {
  const { locale } = useLocale();
  const { isAdmin } = useAskbibleUser();
  const allowed = devotionalAvailable(locale, isAdmin);
  const [on, setOn] = useState(false);
  const [day, setDay] = useState<DevotionalDay>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const shell = useMusicShellPlayback();
  const tw = locale === "zh-TW";
  useEffect(() => setOn(readDevotionalAuto()), []);
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const date = new Date();
    date.setDate(date.getDate() + viewAhead);
    setDay(undefined);
    setFailed(false);
    void loadDevotional(locale, date)
      .then((d) => {
        if (!cancelled) {
          setDay(d);
          if (!d) setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, locale, viewAhead, retry]);
  if (!allowed) return null;
  const src = day ? devotionalAudioUrl(day) : null;
  const mine = !!src && shell.effectiveSrc === src;
  return (
    <section
      aria-label={tw ? "今日靈修" : "今日灵修"}
      className="mt-6 rounded-2xl border border-[color:var(--bc-read-border,rgba(92,64,48,0.18))] bg-[var(--bc-read-surface-solid,#faf6ee)] p-4 text-[var(--bc-read-book)]"
    >
      <p className="text-sm text-[var(--bc-read-muted)]">
        {tw ? "今日靈修" : "今日灵修"}
        {day
          ? ` · ${Number(day.md.slice(0, 2))}月${Number(day.md.slice(3))}日`
          : ""}
      </p>
      <label className="my-2 flex min-h-12 cursor-pointer items-center justify-between gap-4">
        <span>{tw ? "讀經後接著聽" : "读经后接着听"}</span>
        <input
          type="checkbox"
          role="switch"
          aria-label={tw ? "讀經後接著聽" : "读经后接着听"}
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            writeDevotionalAuto(e.target.checked);
          }}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="relative h-6 w-11 shrink-0 rounded-full bg-stone-300 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-stone-800 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-700"
        />
      </label>
      {day ? (
        <>
          <details className="group">
            <summary className="cursor-pointer list-none">
              <h2 className="text-lg font-semibold">{day.title}</h2>
              <p className="mt-2 line-clamp-2 group-open:line-clamp-none text-sm leading-relaxed text-[var(--bc-read-muted)]">
                {day.verse}
              </p>
            </summary>
            <div className="mt-4 space-y-4 leading-relaxed">
              <p>{day.ref}</p>
              {day.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <p className="text-sm">John Piper / Desiring God</p>
              <a
                className="text-sm underline"
                href="https://www.befaithful.net"
              >
                {tw ? "譯文與音頻：忠信福音事工" : "译文与音频：忠信福音事工"}
              </a>
            </div>
          </details>
          {src ? (
            <div className="mt-3">
              <button
                type="button"
                className="min-h-12 w-full text-right"
                aria-pressed={mine && shell.playing}
                onClick={() => {
                  if (mine && shell.playing) {
                    shell.pausePlayback();
                    return;
                  }
                  setPlanFlowActive(false);
                  writeReadingPlanAudioSession(null);
                  shell.setPlaybackSrc(src, { autoPlay: true });
                }}
              >
                {mine && shell.playing
                  ? tw
                    ? "暫停"
                    : "暂停"
                  : tw
                    ? "收聽"
                    : "收听"}
              </button>
              {mine && shell.durationSec > 0 ? (
                <input
                  aria-label={tw ? "播放進度" : "播放进度"}
                  type="range"
                  min={0}
                  max={shell.durationSec}
                  step={1}
                  value={Math.min(shell.currentSec, shell.durationSec)}
                  onChange={(e) =>
                    shell.seekRatio(Number(e.target.value) / shell.durationSec)
                  }
                  className="w-full"
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : failed ? (
        <button className="min-h-12" onClick={() => setRetry((n) => n + 1)}>
          {tw ? "靈修沒有載入，點這裡重試" : "灵修没有载入，点这里重试"}
        </button>
      ) : (
        <p className="text-sm">
          {tw ? "正在準備今日靈修…" : "正在准备今日灵修…"}
        </p>
      )}
    </section>
  );
}
