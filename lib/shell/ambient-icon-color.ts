import {
  SHELL_AMBIENT_CHIP_SIZE_PX,
  SHELL_AMBIENT_ICON_GAP_PX,
} from "@/lib/shell/shell-chrome-icons";

/** 与 App `HomeNatureScreen` `ambientIconColor` 一致 */
export function ambientIconColor(selected: boolean, enabled: boolean): string {
  if (!enabled) return "rgba(255,255,255,0.15)";
  return selected ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.3)";
}

export function ambientStripContentWidth(count: number, edgePadPx = 22): number {
  if (count <= 0) return edgePadPx * 2;
  return (
    count * SHELL_AMBIENT_CHIP_SIZE_PX +
    Math.max(0, count - 1) * SHELL_AMBIENT_ICON_GAP_PX +
    edgePadPx * 2
  );
}
