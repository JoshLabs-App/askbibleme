import { readParchmentTheme as parchment } from "./read/readParchmentTheme";

/** 应用默认羊皮卷底（与读经/祷告 `readParchmentTheme` 对齐，非品牌蓝） */
export const theme = {
  canvas: parchment.canvas,
  surface: parchment.surfaceSolid,
  ink: parchment.ink,
  muted: parchment.muted,
  border: parchment.border,
  sand: parchment.accentOt,
  appLight: parchment.surface,
  appDark: parchment.canvas,
} as const;
