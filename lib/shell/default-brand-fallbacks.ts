/**
 * 与 `tailwind.config.ts` 语义色、`app/globals.css` 中 `--brand-*` 命名一致。
 * 表格「行」用此列表驱动；**具体数值**由运行时 `getComputedStyle(document.body)` 读取。
 */
export const DEFAULT_BRAND_COLOR_ROWS: {
  key: string;
  /** Tailwind `theme.colors` 名，如 `bg-canvas` */
  twToken: string;
  cssVar: string;
  rgbVar: string;
}[] = [
  { key: "canvas", twToken: "canvas", cssVar: "--brand-canvas", rgbVar: "--brand-canvas-rgb" },
  { key: "surface", twToken: "surface", cssVar: "--brand-surface", rgbVar: "--brand-surface-rgb" },
  { key: "border", twToken: "border", cssVar: "--brand-border", rgbVar: "--brand-border-rgb" },
  { key: "muted", twToken: "muted", cssVar: "--brand-muted", rgbVar: "--brand-muted-rgb" },
  { key: "ink", twToken: "ink", cssVar: "--brand-ink", rgbVar: "--brand-ink-rgb" },
  { key: "sand", twToken: "sand", cssVar: "--brand-sand", rgbVar: "--brand-sand-rgb" },
  { key: "appLight", twToken: "appLight", cssVar: "--brand-app-light", rgbVar: "--brand-app-light-rgb" },
  { key: "appDark", twToken: "appDark", cssVar: "--brand-app-dark", rgbVar: "--brand-app-dark-rgb" },
  { key: "adminBg", twToken: "adminBg", cssVar: "--brand-admin-bg", rgbVar: "--brand-admin-bg-rgb" },
  { key: "adminPanel", twToken: "adminPanel", cssVar: "--brand-admin-panel", rgbVar: "--brand-admin-panel-rgb" },
  { key: "adminLine", twToken: "adminLine", cssVar: "--brand-admin-line", rgbVar: "--brand-admin-line-rgb" },
  { key: "adminFg", twToken: "adminFg", cssVar: "--brand-admin-fg", rgbVar: "--brand-admin-fg-rgb" },
  { key: "adminMuted", twToken: "adminMuted", cssVar: "--brand-admin-muted", rgbVar: "--brand-admin-muted-rgb" },
];

/** 与 `tailwind.config.ts` → `theme.extend.fontFamily.sans` 一致（源码约定；运行时正文见 `getComputedStyle(body).fontFamily`） */
export const TAILWIND_SANS_STACK = [
  "ui-sans-serif",
  "system-ui",
  "-apple-system",
  "Segoe UI",
  "Roboto",
  "Helvetica Neue",
  "Arial",
  "sans-serif",
] as const;
