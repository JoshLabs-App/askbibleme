"use client";

import { useEffect, useState } from "react";
import {
  resolveMediaPlaybackPolicyTier,
  type MediaPlaybackPolicyTier,
} from "@/lib/media/media-playback-policy";

/**
 * 客户端解析媒体策略（SSR 首帧为 `normal`，挂载后与 UA 对齐）。
 * 手机恒为 `normal`；电视为 `tvCoexist`（短暂让出视频后尝试与音乐并存）。
 */
export function useMediaPlaybackPolicy(): MediaPlaybackPolicyTier {
  const [tier, setTier] = useState<MediaPlaybackPolicyTier>("normal");

  useEffect(() => {
    setTier(resolveMediaPlaybackPolicyTier());
  }, []);

  return tier;
}
