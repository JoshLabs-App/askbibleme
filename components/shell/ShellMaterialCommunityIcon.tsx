"use client";

import type { CSSProperties } from "react";

export type ShellMaterialCommunityIconName = string;

type Props = {
  name: ShellMaterialCommunityIconName;
  size: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

/** 与 App `MaterialCommunityIcons` 同名图标（MDI Webfont） */
export function ShellMaterialCommunityIcon({
  name,
  size,
  color = "currentColor",
  className = "",
  style,
}: Props) {
  return (
    <span
      className={`mdi mdi-${name} inline-block select-none leading-none ${className}`}
      style={{
        fontSize: size,
        width: size,
        height: size,
        lineHeight: `${size}px`,
        color,
        ...style,
      }}
      aria-hidden
    />
  );
}
