import type { MutableRefObject, RefObject } from "react";
import type { ScrollView } from "react-native";

type AnimateArgs = {
  scrollRef: RefObject<ScrollView | null>;
  startY: number;
  targetY: number;
  durationMs: number;
  animRafRef: MutableRefObject<number | null>;
  onY: (y: number) => void;
};

export function animateMusicHomeQueueScroll({
  scrollRef,
  startY,
  targetY,
  durationMs,
  animRafRef,
  onY,
}: AnimateArgs) {
  if (!scrollRef.current) return;
  if (animRafRef.current != null) {
    cancelAnimationFrame(animRafRef.current);
    animRafRef.current = null;
  }
  const delta = targetY - startY;
  if (Math.abs(delta) < 1) {
    scrollRef.current.scrollTo({ y: targetY, animated: false });
    onY(targetY);
    return;
  }
  const startAt = Date.now();
  const step = () => {
    const elapsed = Date.now() - startAt;
    const t = Math.min(1, elapsed / Math.max(1, durationMs));
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const y = startY + delta * eased;
    scrollRef.current?.scrollTo({ y, animated: false });
    onY(y);
    if (t < 1) {
      animRafRef.current = requestAnimationFrame(step);
    } else {
      animRafRef.current = null;
    }
  };
  animRafRef.current = requestAnimationFrame(step);
}
