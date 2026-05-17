import type { NatureMediaPolicy } from "@/hooks/useNatureMediaPolicy";
import { isIosLikeUserAgent } from "@/lib/dom/ios";
import { isPrefetchableNatureVideoSrc } from "@/lib/nature/is-prefetchable-nature-video-src";

/** 有首图时是否用 fetch 整段 MP4 → Blob URL（省流/低内存/iOS 走流式揭晓） */
export function canNatureHomeFullVideoFetch(videoSrc: string, policy: NatureMediaPolicy): boolean {
  if (!videoSrc.trim() || !isPrefetchableNatureVideoSrc(videoSrc)) return false;
  if (isIosLikeUserAgent()) return false;
  if (policy.saveData || policy.lowBatteryStatic) return false;
  const dm = policy.deviceMemoryGb;
  if (typeof dm === "number" && dm > 0 && dm <= 4) return false;
  return true;
}
