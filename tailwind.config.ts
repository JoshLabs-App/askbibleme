import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 品牌语义色由 CSS 变量驱动（后台「全局设置」可改预设 / 自定义）
        canvas: "rgb(var(--brand-canvas-rgb) / <alpha-value>)",
        surface: "rgb(var(--brand-surface-rgb) / <alpha-value>)",
        border: "rgb(var(--brand-border-rgb) / <alpha-value>)",
        muted: "rgb(var(--brand-muted-rgb) / <alpha-value>)",
        ink: "rgb(var(--brand-ink-rgb) / <alpha-value>)",
        sand: "rgb(var(--brand-sand-rgb) / <alpha-value>)",
        appLight: "rgb(var(--brand-app-light-rgb) / <alpha-value>)",
        appDark: "rgb(var(--brand-app-dark-rgb) / <alpha-value>)",
        /** 后台壳：实际色值由 `[data-admin-shell="light"]` 独立定义（浅灰纸 + Notion 系正文），与前台画布解耦 */
        adminBg: "rgb(var(--brand-admin-bg-rgb) / <alpha-value>)",
        adminPanel: "rgb(var(--brand-admin-panel-rgb) / <alpha-value>)",
        adminLine: "rgb(var(--brand-admin-line-rgb) / <alpha-value>)",
        adminFg: "rgb(var(--brand-admin-fg-rgb) / <alpha-value>)",
        adminMuted: "rgb(var(--brand-admin-muted-rgb) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        /** 含简繁宋体：否则 `font-serif` 只有 Georgia，中文会落回苹方/黑体 */
        serif: [
          "Songti SC",
          "STSong",
          "Songti TC",
          "STSongti-TC",
          "Noto Serif SC",
          "Noto Serif TC",
          "SimSun",
          "NSimSun",
          "PMingLiU",
          "MingLiU",
          "Hiragino Mincho ProN",
          "Yu Mincho",
          "MS Mincho",
          "ui-serif",
          "Georgia",
          "Cambria",
          '"Times New Roman"',
          "Times",
          "serif",
        ],
      },
      keyframes: {
        "amb-calm-drift-a": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)" },
          "50%": { transform: "translate3d(-10%, 9%, 0) rotate(6deg) scale(1.08)" },
        },
        "amb-calm-drift-b": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1.04)" },
          "50%": { transform: "translate3d(11%, -8%, 0) rotate(-5deg) scale(1.06)" },
        },
        "amb-calm-veil-pulse": {
          "0%, 100%": { opacity: "0.82" },
          "50%": { opacity: "0.93" },
        },
        "amb-calm-sheen": {
          "0%, 100%": {
            transform: "translate3d(-14%, 5%, 0) scale(1.02) rotate(-4deg)",
            opacity: "0.14",
          },
          "50%": {
            transform: "translate3d(12%, -8%, 0) scale(1.14) rotate(5deg)",
            opacity: "0.4",
          },
        },
        "amb-calm-grain-shift": {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(-5%, -4%, 0)" },
        },
        "amb-calm-bokeh-1": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)", opacity: "0.35" },
          "50%": { transform: "translate3d(8%, -10%, 0) scale(1.1)", opacity: "0.52" },
        },
        "amb-calm-bokeh-2": {
          "0%, 100%": { transform: "translate3d(0, 0, 0)", opacity: "0.28" },
          "50%": { transform: "translate3d(-9%, 8%, 0)", opacity: "0.48" },
        },
        "amb-ember-drift-a": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)" },
          "33%": { transform: "translate3d(-38%, 32%, 0) rotate(22deg) scale(1.28)" },
          "66%": { transform: "translate3d(28%, -26%, 0) rotate(-14deg) scale(0.88)" },
        },
        "amb-ember-drift-b": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1.12)" },
          "40%": { transform: "translate3d(36%, -34%, 0) rotate(-24deg) scale(0.82)" },
          "75%": { transform: "translate3d(-28%, 30%, 0) rotate(18deg) scale(1.22)" },
        },
        "amb-ember-veil-pulse": {
          "0%, 100%": { opacity: "0.52" },
          "50%": { opacity: "0.98" },
        },
        "amb-ember-sheen": {
          "0%, 100%": {
            transform: "translate3d(-42%, 22%, 0) scale(0.92) rotate(-12deg)",
            opacity: "0.06",
          },
          "50%": {
            transform: "translate3d(38%, -28%, 0) scale(1.42) rotate(14deg)",
            opacity: "0.72",
          },
        },
        "amb-ember-grain-shift": {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(-22%, -18%, 0)" },
        },
        "amb-ember-bokeh-1": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)", opacity: "0.25" },
          "50%": { transform: "translate3d(42%, -36%, 0) scale(1.55)", opacity: "0.85" },
        },
        "amb-ember-bokeh-2": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1.08)", opacity: "0.18" },
          "50%": { transform: "translate3d(-40%, 38%, 0) scale(0.75)", opacity: "0.78" },
        },
        "amb-aurora-drift-a": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)" },
          "35%": { transform: "translate3d(-30%, 6%, 0) rotate(10deg) scale(1.12)" },
          "70%": { transform: "translate3d(26%, -22%, 0) rotate(-12deg) scale(0.9)" },
        },
        "amb-aurora-drift-b": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1.06)" },
          "45%": { transform: "translate3d(28%, 20%, 0) rotate(-16deg) scale(1.14)" },
          "80%": { transform: "translate3d(-24%, -14%, 0) rotate(14deg) scale(0.94)" },
        },
        "amb-aurora-veil-pulse": {
          "0%, 100%": { opacity: "0.68" },
          "50%": { opacity: "0.92" },
        },
        "amb-aurora-sheen": {
          "0%, 100%": {
            transform: "translate3d(-28%, 12%, 0) scale(1.04) rotate(-8deg)",
            opacity: "0.1",
          },
          "50%": {
            transform: "translate3d(32%, -18%, 0) scale(1.32) rotate(10deg)",
            opacity: "0.58",
          },
        },
        "amb-aurora-grain-shift": {
          "0%": { transform: "translate3d(0, 0, 0)" },
          "100%": { transform: "translate3d(-10%, 7%, 0)" },
        },
        "amb-aurora-bokeh-1": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)", opacity: "0.22" },
          "50%": { transform: "translate3d(26%, -28%, 0) scale(1.35)", opacity: "0.72" },
        },
        "amb-aurora-bokeh-2": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1.05)", opacity: "0.2" },
          "50%": { transform: "translate3d(-30%, 24%, 0) scale(0.82)", opacity: "0.68" },
        },
      },
      animation: {
        "amb-calm-drift-a": "amb-calm-drift-a 22s ease-in-out infinite",
        "amb-calm-drift-a-slow": "amb-calm-drift-a 88s ease-in-out infinite",
        "amb-calm-drift-b": "amb-calm-drift-b 28s ease-in-out -7s infinite",
        "amb-calm-drift-b-slow": "amb-calm-drift-b 112s ease-in-out -28s infinite",
        "amb-calm-veil": "amb-calm-veil-pulse 15s ease-in-out infinite",
        "amb-calm-veil-slow": "amb-calm-veil-pulse 60s ease-in-out infinite",
        "amb-calm-sheen": "amb-calm-sheen 20s ease-in-out infinite",
        "amb-calm-sheen-slow": "amb-calm-sheen 80s ease-in-out infinite",
        "amb-calm-grain": "amb-calm-grain-shift 11s linear infinite",
        "amb-calm-grain-slow": "amb-calm-grain-shift 44s linear infinite",
        "amb-calm-bokeh-1": "amb-calm-bokeh-1 17s ease-in-out infinite",
        "amb-calm-bokeh-1-slow": "amb-calm-bokeh-1 68s ease-in-out infinite",
        "amb-calm-bokeh-2": "amb-calm-bokeh-2 21s ease-in-out -10s infinite",
        "amb-calm-bokeh-2-slow": "amb-calm-bokeh-2 84s ease-in-out -40s infinite",
        "amb-ember-drift-a": "amb-ember-drift-a 9s ease-in-out infinite",
        "amb-ember-drift-a-slow": "amb-ember-drift-a 36s ease-in-out infinite",
        "amb-ember-drift-b": "amb-ember-drift-b 11s ease-in-out -3s infinite",
        "amb-ember-drift-b-slow": "amb-ember-drift-b 44s ease-in-out -12s infinite",
        "amb-ember-veil": "amb-ember-veil-pulse 6s ease-in-out infinite",
        "amb-ember-veil-slow": "amb-ember-veil-pulse 36s ease-in-out infinite",
        "amb-ember-sheen": "amb-ember-sheen 8s ease-in-out infinite",
        "amb-ember-sheen-slow": "amb-ember-sheen 40s ease-in-out infinite",
        "amb-ember-grain": "amb-ember-grain-shift 4s linear infinite",
        "amb-ember-grain-slow": "amb-ember-grain-shift 24s linear infinite",
        "amb-ember-bokeh-1": "amb-ember-bokeh-1 7s ease-in-out infinite",
        "amb-ember-bokeh-1-slow": "amb-ember-bokeh-1 36s ease-in-out infinite",
        "amb-ember-bokeh-2": "amb-ember-bokeh-2 8s ease-in-out -4s infinite",
        "amb-ember-bokeh-2-slow": "amb-ember-bokeh-2 40s ease-in-out -16s infinite",
        "amb-aurora-drift-a": "amb-aurora-drift-a 14s ease-in-out infinite",
        "amb-aurora-drift-a-slow": "amb-aurora-drift-a 56s ease-in-out infinite",
        "amb-aurora-drift-b": "amb-aurora-drift-b 18s ease-in-out -5s infinite",
        "amb-aurora-drift-b-slow": "amb-aurora-drift-b 72s ease-in-out -20s infinite",
        "amb-aurora-veil": "amb-aurora-veil-pulse 9s ease-in-out infinite",
        "amb-aurora-veil-slow": "amb-aurora-veil-pulse 36s ease-in-out infinite",
        "amb-aurora-sheen": "amb-aurora-sheen 11s ease-in-out infinite",
        "amb-aurora-sheen-slow": "amb-aurora-sheen 44s ease-in-out infinite",
        "amb-aurora-grain": "amb-aurora-grain-shift 6s linear infinite",
        "amb-aurora-grain-slow": "amb-aurora-grain-shift 24s linear infinite",
        "amb-aurora-bokeh-1": "amb-aurora-bokeh-1 9s ease-in-out infinite",
        "amb-aurora-bokeh-1-slow": "amb-aurora-bokeh-1 36s ease-in-out infinite",
        "amb-aurora-bokeh-2": "amb-aurora-bokeh-2 11s ease-in-out -4s infinite",
        "amb-aurora-bokeh-2-slow": "amb-aurora-bokeh-2 44s ease-in-out -16s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
