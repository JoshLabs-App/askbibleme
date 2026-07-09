import type { AppLocale } from "../i18n/config";
import { getLocale } from "../i18n/locale-store";
import { t } from "../i18n/site-copy";

/** 首页设置：内置文案，避免 Metro 未刷新语言包时露出 i18n 键名 */
const HOME_SETTINGS: Record<
  AppLocale,
  {
    panelTitle: string;
    dimSection: string;
    dimHint: string;
    dimLevelNone: string;
    dimLevelFaint: string;
    dimLevelSubtle: string;
    dimLevelLight: string;
    dimLevelStrong: string;
    blurSection: string;
    blurHint: string;
    blurLevelNone: string;
    blurLevelFaint: string;
    blurLevelSubtle: string;
    blurLevelLight: string;
    blurLevelStrong: string;
    verseSizeSection: string;
    verseEffectSection: string;
    translationSection: string;
    closeAria: string;
    textScaleSmallerAria: string;
    textScaleLargerAria: string;
    textScaleDefaultAria: string;
    textScaleSuperAria: string;
    sleepSection: string;
    sleepHint: string;
    sleepM15: string;
    sleepM30: string;
    sleepM60: string;
    sleepM120: string;
    sleepM180: string;
    ttsRateSection: string;
    ttsPitchSection: string;
    ttsLevelSlow: string;
    ttsLevelNormal: string;
    ttsLevelFast: string;
    ttsLevelLow: string;
    ttsLevelHigh: string;
    ttsVoiceSection: string;
    ttsVoiceDefault: string;
    ttsVoiceUnavailable: string;
    ttsVoiceAdd: string;
    ttsVoiceManageHint: string;
    verseRotationSection: string;
    verseRotationHint: string;
  }
> = {
  "zh-CN": {
    panelTitle: "",
    dimSection: "压暗",
    dimHint: "",
    dimLevelNone: "关",
    dimLevelFaint: "极淡",
    dimLevelSubtle: "微微",
    dimLevelLight: "轻",
    dimLevelStrong: "深",
    blurSection: "模糊",
    blurHint: "",
    blurLevelNone: "关",
    blurLevelFaint: "微",
    blurLevelSubtle: "极弱",
    blurLevelLight: "弱",
    blurLevelStrong: "中",
    verseSizeSection: "字号",
    verseEffectSection: "字效",
    translationSection: "译本",
    closeAria: "关闭设置",
    textScaleSmallerAria: "缩小经文",
    textScaleLargerAria: "放大经文",
    textScaleDefaultAria: "恢复默认字号",
    textScaleSuperAria: "切换到超大字号",
    sleepSection: "定时",
    sleepHint: "",
    sleepM15: "15",
    sleepM30: "30",
    sleepM60: "60",
    sleepM120: "120",
    sleepM180: "180",
    ttsRateSection: "语速",
    ttsPitchSection: "音调",
    ttsLevelSlow: "慢",
    ttsLevelNormal: "中",
    ttsLevelFast: "快",
    ttsLevelLow: "低",
    ttsLevelHigh: "高",
    ttsVoiceSection: "声线",
    ttsVoiceDefault: "系统默认",
    ttsVoiceUnavailable: "未发现可用声线",
    ttsVoiceAdd: "添加语音",
    ttsVoiceManageHint: "到系统设置下载/启用语音后，返回这里可选",
    verseRotationSection: "停留时间",
    verseRotationHint: "首页与小挂件经文停留时长一致",
  },
  "zh-TW": {
    panelTitle: "",
    dimSection: "壓暗",
    dimHint: "",
    dimLevelNone: "關",
    dimLevelFaint: "極淡",
    dimLevelSubtle: "微微",
    dimLevelLight: "輕",
    dimLevelStrong: "深",
    blurSection: "模糊",
    blurHint: "",
    blurLevelNone: "關",
    blurLevelFaint: "微",
    blurLevelSubtle: "極弱",
    blurLevelLight: "弱",
    blurLevelStrong: "中",
    verseSizeSection: "字號",
    verseEffectSection: "字效",
    translationSection: "譯本",
    closeAria: "關閉設定",
    textScaleSmallerAria: "縮小經文",
    textScaleLargerAria: "放大經文",
    textScaleDefaultAria: "恢復預設字號",
    textScaleSuperAria: "切換到超大字號",
    sleepSection: "定時",
    sleepHint: "",
    sleepM15: "15",
    sleepM30: "30",
    sleepM60: "60",
    sleepM120: "120",
    sleepM180: "180",
    ttsRateSection: "語速",
    ttsPitchSection: "音調",
    ttsLevelSlow: "慢",
    ttsLevelNormal: "中",
    ttsLevelFast: "快",
    ttsLevelLow: "低",
    ttsLevelHigh: "高",
    ttsVoiceSection: "聲線",
    ttsVoiceDefault: "系統預設",
    ttsVoiceUnavailable: "未發現可用聲線",
    ttsVoiceAdd: "新增語音",
    ttsVoiceManageHint: "到系統設定下載/啟用語音後，回來這裡可選",
    verseRotationSection: "停留時間",
    verseRotationHint: "首頁與小掛件經文停留時長一致",
  },
  en: {
    panelTitle: "",
    dimSection: "Dim",
    dimHint: "",
    dimLevelNone: "Off",
    dimLevelFaint: "Faint",
    dimLevelSubtle: "Subtle",
    dimLevelLight: "Light",
    dimLevelStrong: "Strong",
    blurSection: "Blur",
    blurHint: "",
    blurLevelNone: "Off",
    blurLevelFaint: "Minimal",
    blurLevelSubtle: "Very low",
    blurLevelLight: "Low",
    blurLevelStrong: "Medium",
    verseSizeSection: "Size",
    verseEffectSection: "Style",
    translationSection: "Translation",
    closeAria: "Close settings",
    textScaleSmallerAria: "Smaller verse",
    textScaleLargerAria: "Larger verse",
    textScaleDefaultAria: "Default verse size",
    textScaleSuperAria: "Switch to super large verse size",
    sleepSection: "Timer",
    sleepHint: "",
    sleepM15: "15",
    sleepM30: "30",
    sleepM60: "60",
    sleepM120: "120",
    sleepM180: "180",
    ttsRateSection: "TTS speed",
    ttsPitchSection: "TTS pitch",
    ttsLevelSlow: "Slow",
    ttsLevelNormal: "Normal",
    ttsLevelFast: "Fast",
    ttsLevelLow: "Low",
    ttsLevelHigh: "High",
    ttsVoiceSection: "Voice",
    ttsVoiceDefault: "System default",
    ttsVoiceUnavailable: "No voices available",
    ttsVoiceAdd: "Add voices",
    ttsVoiceManageHint: "Download or enable voices in system settings, then return here.",
    verseRotationSection: "Hold time",
    verseRotationHint: "Home and widget use the same hold time",
  },
};

export type NatureHomeSettingsCopyKey = keyof (typeof HOME_SETTINGS)["zh-CN"];

function bundleMissed(keyPath: string, hit: string): boolean {
  return (
    hit === keyPath ||
    (hit.startsWith("nature.") && hit.includes("homeSettings")) ||
    (hit.startsWith("music.sleepTimer.") && hit.includes("sleepTimer"))
  );
}

export function tNatureHomeSettings(key: NatureHomeSettingsCopyKey): string {
  const locale = getLocale();
  const path =
    key === "textScaleSmallerAria" ||
    key === "textScaleLargerAria" ||
    key === "textScaleDefaultAria" ||
    key === "textScaleSuperAria"
      ? `nature.${key}`
      : `nature.homeSettings.${key}`;
  const hit = t(path);
  if (!bundleMissed(path, hit)) return hit;
  return HOME_SETTINGS[locale][key] ?? HOME_SETTINGS["zh-CN"][key];
}

export const DIM_LEVEL_COPY_KEYS = [
  "dimLevelNone",
  "dimLevelFaint",
  "dimLevelSubtle",
  "dimLevelLight",
  "dimLevelStrong",
] as const satisfies readonly NatureHomeSettingsCopyKey[];

export const BLUR_LEVEL_COPY_KEYS = [
  "blurLevelNone",
  "blurLevelFaint",
  "blurLevelSubtle",
  "blurLevelLight",
  "blurLevelStrong",
] as const satisfies readonly NatureHomeSettingsCopyKey[];
