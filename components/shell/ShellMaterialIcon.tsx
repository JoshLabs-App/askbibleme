"use client";

import type { CSSProperties } from "react";
import { SHELL_ICON_TEXT_SHADOW } from "@/lib/shell/shell-chrome-icons";

export type ShellMaterialIconName = string;

type Props = {
  name: ShellMaterialIconName;
  size: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  /** 壳层视频上角标/底栏：与 App `shellIconTextShadow` 一致 */
  legibilityShadow?: boolean;
};

function toMaterialLigature(name: string): string {
  return name.replace(/-/g, "_");
}

/** 与 App `ShellMaterialIcon` 同名字体图标（Google Material Icons） */
export function ShellMaterialIcon({
  name,
  size,
  color = "currentColor",
  className = "",
  style,
  legibilityShadow = false,
}: Props) {
  return (
    <span
      className={`shell-material-icon inline-flex select-none items-center justify-center ${className}`}
      style={{
        fontSize: size,
        width: size,
        height: size,
        color,
        textShadow: legibilityShadow ? SHELL_ICON_TEXT_SHADOW : undefined,
        ...style,
      }}
      aria-hidden
    >
      {toMaterialLigature(name)}
    </span>
  );
}
