/**
 * 读经羊皮卷配色（对齐网站 `bible-catalog-on-parchment`）
 * - light：`:root` 白天羊皮（`--read-parchment-bg-canvas: #ecd9b9`）
 * - dark：`html.dark` 深夜羊皮
 */
export type ReadParchmentColorMode = "light" | "dark";

/** 当前读经外观；日后可接系统深色或设置项 */
export const READ_PARCHMENT_COLOR_MODE: ReadParchmentColorMode = "light";

const light = {
  canvas: "#ecd9b9",
  ink: "#1c1410",
  inkSoft: "rgba(28, 20, 16, 0.94)",
  muted: "#5c4030",
  faint: "#6e5240",
  border: "rgba(120, 53, 15, 0.28)",
  borderStrong: "rgba(120, 53, 15, 0.42)",
  /** 与 parchmentAccent 一致（旧约标题、左侧竖线） */
  accentOt: "#D97707",
  accentNt: "#A56A2D",
  stripeOt: "rgba(217, 119, 7, 0.88)",
  stripeNt: "rgba(165, 106, 45, 0.82)",
  stripeOtClear: "rgba(217, 119, 7, 0)",
  stripeNtClear: "rgba(165, 106, 45, 0)",
  stripeWisdom: "rgba(161, 98, 7, 0.84)",
  stripeWisdomClear: "rgba(161, 98, 7, 0)",
  hover: "rgba(42, 24, 16, 0.07)",
  surface: "rgba(255, 252, 245, 0.88)",
  surfaceSolid: "#f5ebe0",
  chapterCell: "#f0e4d4",
  chapterCellPressed: "#f5ead8",
  chapterCellBorder: "rgba(120, 53, 15, 0.30)",
  modalBackdrop: "rgba(28, 20, 16, 0.35)",
  /** 默认节号（无交叉引用）：对齐网站 `.read-chapter-verse-inline-num` */
  verseNumMuted: "rgba(92, 58, 28, 0.78)",
  verseNum: "#C98300",
  tabInactive: "rgba(28, 20, 16, 0.52)",
  playFabBg: "rgba(28, 20, 16, 0.08)",
  playFabBorder: "rgba(28, 20, 16, 0.18)",
  /** 与网站 `.read-chapter-verse--audio-active` 暖黄加深 */
  verseAudioActiveBg: "rgba(139, 90, 43, 0.14)",
  verseAudioActiveBorder: "rgba(120, 75, 30, 0.18)",
  verseAudioActiveNum: "rgba(92, 58, 18, 0.95)",
  /** 经文搜索跳入：略强于朗读高亮 */
  verseSearchFocusBg: "rgba(139, 90, 43, 0.22)",
  verseSearchFocusBorder: "rgba(92, 58, 18, 0.32)",
  verseSearchFocusNum: "rgba(72, 44, 12, 0.98)",
  /** 与网站 `.read-chapter-divine-speech` */
  divineSpeech: "rgba(153, 72, 18, 0.95)",
  /** 引号内其他人说话（非神言） */
  humanSpeech: "#38486C",
  /** 主题库金句：字下色带（inline 背景，非整节块） */
  goldenVerseMarker: "rgba(218, 178, 100, 0.10)",
  /** 双击收藏：LOGO 黄 #FFB103，与划重点默认色一致 */
  verseBookmarkMarker: "#FFB103",
  /** 多选复制：节文选中反馈（与朗读/搜索同系暖黄） */
  verseSelectionMarker: "rgba(255, 177, 3, 0.52)",
  /** 羊皮卷强调色：年日数字、时间轴圆点、今日计划勾选等 */
  parchmentAccent: "#D97707",
  parchmentAccentGlow: "rgba(217, 119, 7, 0.24)",
} as const;

const dark = {
  canvas: "#1a1512",
  ink: "#f4ebe1",
  inkSoft: "rgba(244, 235, 225, 0.94)",
  muted: "#d8c8b4",
  faint: "#b9a896",
  border: "rgba(244, 235, 225, 0.16)",
  borderStrong: "rgba(244, 235, 225, 0.24)",
  accentOt: "#D97707",
  accentNt: "#D5A06A",
  stripeOt: "rgba(217, 119, 7, 0.78)",
  stripeNt: "rgba(213, 160, 106, 0.75)",
  stripeOtClear: "rgba(217, 119, 7, 0)",
  stripeNtClear: "rgba(213, 160, 106, 0)",
  stripeWisdom: "rgba(217, 119, 7, 0.78)",
  stripeWisdomClear: "rgba(217, 119, 7, 0)",
  hover: "rgba(244, 235, 225, 0.08)",
  surface: "rgba(41, 37, 36, 0.72)",
  surfaceSolid: "#292524",
  chapterCell: "rgba(41, 37, 36, 0.58)",
  chapterCellPressed: "rgba(63, 58, 54, 0.62)",
  chapterCellBorder: "rgba(244, 235, 225, 0.16)",
  modalBackdrop: "rgba(12, 10, 8, 0.55)",
  verseNumMuted: "rgba(234, 219, 196, 0.72)",
  verseNum: "#FFB103",
  tabInactive: "rgba(244, 235, 225, 0.52)",
  playFabBg: "rgba(244, 235, 225, 0.1)",
  playFabBorder: "rgba(244, 235, 225, 0.2)",
  verseAudioActiveBg: "rgba(245, 230, 210, 0.08)",
  verseAudioActiveBorder: "rgba(245, 230, 210, 0.12)",
  verseAudioActiveNum: "rgba(240, 184, 138, 0.95)",
  verseSearchFocusBg: "rgba(245, 230, 210, 0.14)",
  verseSearchFocusBorder: "rgba(245, 230, 210, 0.22)",
  verseSearchFocusNum: "rgba(255, 220, 185, 0.98)",
  divineSpeech: "rgba(255, 198, 140, 0.95)",
  humanSpeech: "#38486C",
  goldenVerseMarker: "rgba(255, 198, 140, 0.08)",
  verseBookmarkMarker: "#FFB103",
  verseSelectionMarker: "rgba(255, 177, 3, 0.38)",
  parchmentAccent: "#D97707",
  parchmentAccentGlow: "rgba(217, 119, 7, 0.28)",
} as const;

export const readParchmentThemes = { light, dark } as const;

export type ReadParchmentTheme = (typeof readParchmentThemes)[ReadParchmentColorMode];

export const readParchmentTheme: ReadParchmentTheme =
  readParchmentThemes[READ_PARCHMENT_COLOR_MODE];
