"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { medalImageUrl } from "@/lib/achievements/medal-catalog";

/** 档位配色：单档给金，多档从铜走到金（与 iOS `MedalIcon.tint` 同一套） */
function tierTint(tier: number, tierCount: number): string | null {
  if (tier <= 0) return null;
  const t = tierCount <= 1 ? 1 : (tier - 1) / (tierCount - 1);
  if (t < 0.34) return "#B87333"; // 铜
  if (t < 0.67) return "#B9BFC6"; // 银
  return "#E8B44A"; // 金
}

/**
 * 一枚勋章 / 印章图（对齐 iOS `MedalIcon`）：
 * 未获得压成灰度剪影，获得后满色并按档位叠一层暖色；图没到位时先占一个羊皮纸圆。
 * 上色用 `mask-image` 把色块裁成勋章本身的形状，再走 `overlay` 混合，等价于 SwiftUI 那边
 * 「同一张图 foregroundStyle + blendMode(.overlay)」的写法。
 */
export function MedalIcon({
  imageKey,
  tier = 0,
  tierCount = 1,
  size = 64,
  alt = "",
}: {
  imageKey: string;
  tier?: number;
  tierCount?: number;
  size?: number;
  alt?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const url = medalImageUrl(imageKey);
  const tint = tierTint(tier, tierCount);

  // 图已在浏览器缓存里时，onLoad 在 React 挂上监听之前就过去了——
  // 只靠 onLoad 会让图永远停在 opacity 0。挂载后主动查一次 complete。
  const attach = useCallback((el: HTMLImageElement | null) => {
    imgRef.current = el;
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  useEffect(() => {
    setLoaded(false);
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) setLoaded(true);
  }, [url]);

  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
      aria-hidden={alt ? undefined : true}
    >
      {!loaded ? (
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: "#F2E4CF", opacity: 0.6 }}
        />
      ) : null}
      <img
        ref={attach}
        src={url}
        alt={alt}
        width={size}
        height={size}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className="absolute inset-0 h-full w-full object-contain"
        style={{
          filter: tier > 0 ? undefined : "saturate(0)",
          opacity: loaded ? (tier > 0 ? 1 : 0.28) : 0,
          transition: "opacity 240ms ease",
        }}
      />
      {tint && loaded ? (
        <span
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundColor: tint,
            opacity: 0.45,
            mixBlendMode: "overlay",
            WebkitMaskImage: `url(${url})`,
            maskImage: `url(${url})`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
      ) : null}
    </span>
  );
}
