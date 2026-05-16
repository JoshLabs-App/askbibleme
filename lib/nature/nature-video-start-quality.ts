import type { NatureMediaPolicy } from "@/hooks/useNatureMediaPolicy";

/** 弱网 / 省流：首帧直接 720，不先拉 1080。 */
export function shouldStartNatureVideoAt720(
  policy: Pick<NatureMediaPolicy, "saveData">,
): boolean {
  if (policy.saveData) return true;
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  }).connection;
  if (conn?.saveData) return true;
  const et = conn?.effectiveType;
  return et === "slow-2g" || et === "2g";
}
