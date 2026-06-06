"use client";

import { useState } from "react";

type Props = {
  selected: boolean;
  thumbSrc?: string;
  fallbackLabel: string;
  onPress: () => void;
  ariaLabel?: string;
};

/** 首页底部场景缩略图：iOS 式 scale + opacity，无描边/指示点（对齐 App `HomeSceneThumb`） */
export function HomeSceneThumb({ selected, thumbSrc, fallbackLabel, onPress, ariaLabel }: Props) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const normalizedSrc = thumbSrc?.trim() ?? "";
  const showImage = normalizedSrc.length > 0 && !thumbFailed;
  const initial = fallbackLabel.trim().slice(0, 1) || "·";

  return (
    <div className="nature-home-scene-thumb-slot">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={ariaLabel ?? fallbackLabel}
        onClick={onPress}
        className={[
          "nature-home-scene-thumb",
          selected ? "nature-home-scene-thumb--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- 首页场景条静态缩略图
          <img
            src={normalizedSrc}
            alt=""
            decoding="async"
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <span className="nature-home-scene-thumb__fallback" aria-hidden>
            {initial}
          </span>
        )}
      </button>
    </div>
  );
}
