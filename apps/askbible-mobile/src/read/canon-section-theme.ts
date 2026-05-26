/** 正典各段在目录时间轴上的配色（对齐设计稿：五经金、历史橙、智慧绿、先知红/蓝等） */
export type CanonSectionTheme = {
  accent: string;
  accentMuted: string;
  bgTint: string;
};

/** 读经页「新约」统一强调色（用于所有黄色元素对齐） */
export const READ_NEW_TESTAMENT_ACCENT = "#D97707";

const OT: Record<string, CanonSectionTheme> = {
  "canon-torah": {
    accent: "#38486C",
    accentMuted: "rgba(56, 72, 108, 0.72)",
    bgTint: "rgba(56, 72, 108, 0.09)",
  },
  "canon-history": {
    accent: "#b45309",
    accentMuted: "rgba(180, 83, 9, 0.7)",
    bgTint: "rgba(180, 83, 9, 0.08)",
  },
  "canon-wisdom": {
    accent: "#6b7c3f",
    accentMuted: "rgba(107, 124, 63, 0.72)",
    bgTint: "rgba(101, 163, 13, 0.07)",
  },
  "canon-major-prophets": {
    accent: "#9f1239",
    accentMuted: "rgba(159, 18, 57, 0.68)",
    bgTint: "rgba(153, 27, 27, 0.07)",
  },
  "canon-minor-prophets": {
    accent: "#4a6a8a",
    accentMuted: "rgba(74, 106, 138, 0.72)",
    bgTint: "rgba(71, 85, 105, 0.08)",
  },
};

const NT: Record<string, CanonSectionTheme> = {
  "canon-gospels": {
    accent: READ_NEW_TESTAMENT_ACCENT,
    accentMuted: "rgba(217, 119, 7, 0.76)",
    bgTint: "rgba(217, 119, 7, 0.12)",
  },
  "canon-church-history": {
    accent: "#0f766e",
    accentMuted: "rgba(15, 118, 110, 0.68)",
    bgTint: "rgba(13, 148, 136, 0.07)",
  },
  "canon-pauline": {
    accent: "#6d28d9",
    accentMuted: "rgba(109, 40, 217, 0.65)",
    bgTint: "rgba(124, 58, 237, 0.07)",
  },
  "canon-general-epistles": {
    accent: "#047857",
    accentMuted: "rgba(4, 120, 87, 0.68)",
    bgTint: "rgba(5, 150, 105, 0.07)",
  },
  "canon-apocalyptic": {
    accent: "#991b1b",
    accentMuted: "rgba(153, 27, 27, 0.68)",
    bgTint: "rgba(127, 29, 29, 0.08)",
  },
};

const ALL = { ...OT, ...NT };

const FALLBACK_OT: CanonSectionTheme = OT["canon-torah"]!;
const FALLBACK_NT: CanonSectionTheme = NT["canon-gospels"]!;

export function canonSectionTheme(
  sectionId: string,
  testament: "old" | "new",
): CanonSectionTheme {
  return ALL[sectionId] ?? (testament === "old" ? FALLBACK_OT : FALLBACK_NT);
}
