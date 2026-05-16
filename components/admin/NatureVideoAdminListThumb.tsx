"use client";

import type { NatureVideoEntry } from "@/lib/nature/types";

function listStillSrc(v: NatureVideoEntry): string {
  return v.thumbSrc?.trim() || v.previewFrameSrc?.trim() || "";
}

type Props = {
  video: NatureVideoEntry;
  active?: boolean;
  disabled?: boolean;
  /** 点击缩略图（通常为设为首页当前播放） */
  onPress?: () => void;
  className?: string;
};

/** 后台影片列表左侧方图：封面 → 首帧预览 → 视频 metadata 兜底 */
export function NatureVideoAdminListThumb({
  video,
  active = false,
  disabled,
  onPress,
  className = "",
}: Props) {
  const still = listStillSrc(video);
  const label = video.title?.trim() || "未命名影片";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      title={label}
      aria-label={label}
      className={[
        "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-black/85 shadow-sm transition",
        "outline-none ring-adminFg/25 focus-visible:ring-2",
        active ? "border-emerald-600/60 ring-2 ring-emerald-500/40" : "border-adminLine hover:border-adminFg/30",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:opacity-100",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {still ? (
        <img src={still} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <video
          src={video.src}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover opacity-90"
          aria-hidden
        />
      )}
    </button>
  );
}
