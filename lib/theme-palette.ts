/**
 * AskBible.me 全站唯一系统色彩总表（Single Source of Truth）
 *
 * 对齐 `docs/design-color-system.md` 与 `lib/site-branding-colors.ts`：
 * - 浅色「读经羊皮 + 沉香木」与深色「夜读古卷」成对定义；
 * - 全站状态色锁死四档（成功橄榄绿 / 提醒琥珀 / 危险砖红 / 中性禁用墨色透明度）；
 * - 划重点颜料锁死四支（灯油黄 / 橄榄绿 / 青石蓝 / 石榴红）；
 * - 所有新增业务组件与样式统一引用 `var(--ab-*)` 或 `var(--brand-*)`，禁止私自裸写 #hex / rgb() / hsl()。
 * - 修改本文件后运行 `node scripts/sync-theme-tokens.mjs` 自动同步 `app/tokens.css`。
 */

/** 四档锁定状态色（浅/深成对） */
export const STATUS_PALETTE = {
  ok: { light: "#65775C", dark: "#A8BC72" },
  warn: { light: "#D97707", dark: "#E8952C" },
  danger: { light: "#A63D2F", dark: "#D9705E" },
  disabled: { light: "rgba(28, 20, 16, 0.30)", dark: "rgba(244, 235, 225, 0.28)" },
} as const;

/** 羊皮纸四色颜料板（浅/深共用色相，由 alpha 区分） */
export const PIGMENT_HIGHLIGHT_PALETTE = {
  lampGold: "#FFB103",
  oliveGreen: "#A3B565",
  slateBlue: "#4E86A0",
  garnetRed: "#C0625F",
} as const;

/** 浅色主题（`:root`）系统语义变量 */
export const LIGHT_THEME_TOKENS: Record<string, string> = {
  "--ab-bg": "#ECD9B9",
  "--ab-bg-site": "#FBF6EC",
  "--ab-bg-glow": "#FFFCF5",
  "--ab-bg-deep": "#F4EADB",
  "--ab-surface": "#F5EBE0",
  "--ab-surface-elevated": "#FAF5EC",
  "--ab-surface-translucent": "rgba(245, 235, 224, 0.92)",
  "--ab-surface-scrim": "rgba(28, 20, 16, 0.42)",
  "--ab-ink": "#1C1410",
  "--ab-ink-secondary": "#5C4030",
  "--ab-ink-muted": "rgba(92, 64, 48, 0.68)",
  "--ab-ink-faint": "rgba(92, 64, 48, 0.44)",
  "--ab-border": "rgba(120, 90, 52, 0.24)",
  "--ab-border-strong": "rgba(120, 53, 15, 0.42)",
  "--ab-hairline": "rgba(92, 64, 48, 0.16)",
  "--ab-accent": "#D97707",
  "--ab-accent-ink": "#9A5206",
  "--ab-accent-soft": "rgba(217, 119, 7, 0.14)",
  "--ab-logo-gold": PIGMENT_HIGHLIGHT_PALETTE.lampGold,
  "--ab-agarwood": "#3D2E24",
  "--ab-agarwood-panel": "#4A382C",
  "--ab-agarwood-ink": "#F4EBE1",
  "--ab-status-ok": STATUS_PALETTE.ok.light,
  "--ab-status-warn": STATUS_PALETTE.warn.light,
  "--ab-status-danger": STATUS_PALETTE.danger.light,
  "--ab-status-disabled": STATUS_PALETTE.disabled.light,
  "--ab-pigment-gold": PIGMENT_HIGHLIGHT_PALETTE.lampGold,
  "--ab-pigment-olive": PIGMENT_HIGHLIGHT_PALETTE.oliveGreen,
  "--ab-pigment-slate": PIGMENT_HIGHLIGHT_PALETTE.slateBlue,
  "--ab-pigment-garnet": PIGMENT_HIGHLIGHT_PALETTE.garnetRed,
  "--ab-utility-bar-bg": "rgba(238, 227, 208, 0.88)",
  "--ab-utility-bar-scenery-bg": "rgba(28, 20, 16, 0.56)",
  "--ab-utility-bar-scenery-ink": "rgba(247, 243, 233, 0.88)",
  "--ab-utility-bar-scenery-muted": "rgba(247, 243, 233, 0.48)",
  "--ab-utility-bar-scenery-border": "rgba(247, 243, 233, 0.20)",
  "--ab-probe-accent": "#B55D08",
  "--ab-probe-frame-bg": "rgba(181, 93, 8, 0.12)",
  "--ab-probe-hud-bg": "rgba(36, 27, 19, 0.96)",
  "--ab-probe-hud-border": "rgba(227, 160, 74, 0.52)",
  "--ab-probe-hud-ink": "#F7F3E9",
  "--ab-probe-hud-title": "#FFB103",
  "--ab-probe-hud-muted": "rgba(244, 235, 225, 0.68)",
  "--ab-stage-bg": "#241C16",
  "--ab-stage-bar-bg": "rgba(46, 35, 27, 0.94)",
  "--ab-stage-bar-border": "rgba(220, 198, 166, 0.20)",
  "--ab-stage-bar-ink": "#F4EBE1",
  "--ab-stage-bar-muted": "rgba(244, 235, 225, 0.68)",
  "--ab-stage-pill-active-bg": "#ECD9B9",
  "--ab-stage-pill-active-ink": "#1C1410",
  "--ab-phone-bezel-bg": "#18130F",
  "--ab-phone-bezel-border": "rgba(220, 198, 166, 0.24)",
  "--ab-phone-notch-bg": "rgba(244, 235, 225, 0.22)",
  "--ab-phone-shadow": "0 28px 72px rgba(0, 0, 0, 0.48), 0 4px 18px rgba(0, 0, 0, 0.28)",
};

/** 深色主题（`html.dark`）系统语义变量 */
export const DARK_THEME_TOKENS: Record<string, string> = {
  "--ab-bg": "#1A1512",
  "--ab-bg-site": "#1A1512",
  "--ab-bg-glow": "#261E19",
  "--ab-bg-deep": "#14100D",
  "--ab-surface": "#241E18",
  "--ab-surface-elevated": "#2C241D",
  "--ab-surface-translucent": "rgba(36, 30, 24, 0.92)",
  "--ab-surface-scrim": "rgba(0, 0, 0, 0.62)",
  "--ab-ink": "#F4EBE1",
  "--ab-ink-secondary": "#D8C8B4",
  "--ab-ink-muted": "rgba(216, 200, 180, 0.68)",
  "--ab-ink-faint": "rgba(216, 200, 180, 0.42)",
  "--ab-border": "rgba(220, 198, 166, 0.18)",
  "--ab-border-strong": "rgba(220, 198, 166, 0.32)",
  "--ab-hairline": "rgba(216, 200, 180, 0.16)",
  "--ab-accent": "#E8952C",
  "--ab-accent-ink": "#E3A04A",
  "--ab-accent-soft": "rgba(232, 149, 44, 0.18)",
  "--ab-status-ok": STATUS_PALETTE.ok.dark,
  "--ab-status-warn": STATUS_PALETTE.warn.dark,
  "--ab-status-danger": STATUS_PALETTE.danger.dark,
  "--ab-status-disabled": STATUS_PALETTE.disabled.dark,
  "--ab-utility-bar-bg": "rgba(36, 30, 24, 0.90)",
  "--ab-probe-accent": "#FFB103",
  "--ab-probe-frame-bg": "rgba(255, 177, 3, 0.14)",
  "--ab-stage-bg": "#110D0A",
  "--ab-stage-bar-bg": "rgba(32, 25, 20, 0.95)",
  "--ab-phone-bezel-bg": "#16110D",
};

export function renderTokensCss(): string {
  const formatBlock = (selector: string, map: Record<string, string>) => {
    const lines = Object.entries(map).map(([k, v]) => `  ${k}: ${v};`);
    return `${selector} {\n${lines.join("\n")}\n}`;
  };
  return [
    "/* AUTO-GENERATED FROM lib/theme-palette.ts — DO NOT HAND-EDIT WILD COLORS IN COMPONENTS */",
    "/* Run `node scripts/sync-theme-tokens.mjs` after updating lib/theme-palette.ts */",
    "",
    formatBlock(":root", LIGHT_THEME_TOKENS),
    "",
    formatBlock("html.dark", DARK_THEME_TOKENS),
    "",
  ].join("\n");
}
