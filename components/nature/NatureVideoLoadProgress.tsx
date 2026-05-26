"use client";

type Props = {
  /** 0–1；无 Content-Length 时为 null（不确定进度动画） */
  progress: number | null;
  label: string;
  className?: string;
};

/** 自然首页 / 场景：整段下载进度条 */
export function NatureVideoLoadProgress({ progress, label, className = "" }: Props) {
  const pct = progress != null ? Math.max(0, Math.min(100, Math.round(progress * 100))) : null;

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-[max(5.25rem,calc(env(safe-area-inset-bottom,0px)+4.75rem))] z-[12] flex flex-col items-center gap-2 px-6 sm:px-10 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="max-w-md text-center text-[12px] leading-snug text-white/70 sm:text-[13px]">{label}</p>
      <div
        className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/20 sm:max-w-sm"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-label={label}
      >
        {pct != null ? (
          <div
            className="h-full rounded-full bg-sky-400/95 transition-[width] duration-150 ease-out"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-full w-[38%] min-w-[1.75rem] rounded-full bg-sky-400/90 motion-safe:animate-pulse" />
          </div>
        )}
      </div>
      {pct != null ? (
        <span className="text-[11px] tabular-nums text-white/45">{pct}%</span>
      ) : null}
    </div>
  );
}
