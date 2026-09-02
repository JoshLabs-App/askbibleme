import { getLocale } from "./locale-store";
import type { AppLocale } from "./config";
import { ZH_TW_OVERRIDES } from "./site-copy-zh-tw-overrides";
import { ZH_TW_CHAR_MAP, ZH_TW_PHRASE_REPLACEMENTS, ZH_TW_POST_CHAR_MAP_FIXUPS } from "./site-copy-zh-tw-maps";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const zhCN = require("../../assets/content/zh-CN.json") as Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const en = require("../../assets/content/en.json") as Record<string, unknown>;
const zhTW = zhCN;

const MESSAGES: Record<AppLocale, Record<string, unknown>> = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  en,
};

const AUTH_UI_FALLBACKS: Record<string, { zh: string; en: string }> = {
  "auth.backHome": { zh: "返回首页", en: "Back home" },
  "auth.pageTitle": { zh: "登录", en: "Log in" },
  "auth.registerPageTitle": { zh: "注册", en: "Create account" },
  "auth.registerIntro": { zh: "登录后继续使用 AskBible.me", en: "Log in to continue using AskBible.me" },
  "auth.registerClosed": { zh: "注册功能暂时关闭", en: "Registration is temporarily closed" },
  "auth.email": { zh: "邮箱", en: "Email" },
  "auth.password": { zh: "密码", en: "Password" },
  "auth.registerName": { zh: "昵称", en: "Nickname" },
  "auth.submit": { zh: "登录", en: "Log in" },
  "auth.registerSubmit": { zh: "注册", en: "Create account" },
  "auth.loginFooterRegister": { zh: "还没有账户？注册", en: "Don't have an account? Create one" },
  "auth.registerGoLogin": { zh: "已有账户？登录", en: "Already have an account? Log in" },
  "auth.continueWithApple": { zh: "使用 Apple 继续", en: "Continue with Apple" },
  "auth.continueWithGoogle": { zh: "使用 Google 继续", en: "Continue with Google" },
  "auth.orDivider": { zh: "或", en: "OR" },
  "auth.errorNetwork": { zh: "网络连接失败，请稍后再试。", en: "Network error. Please try again." },
  "auth.errorWrong": { zh: "邮箱或密码不正确。", en: "Incorrect email or password." },
  "auth.errorOAuthGoogleNotConfigured": { zh: "Google 登录暂时不可用，请稍后再试。", en: "Google sign-in is temporarily unavailable. Please try again later." },
  "auth.errorOAuthGoogle": { zh: "Google 登录失败，请重试。", en: "Google sign-in failed. Please try again." },
  "onboarding.welcome.languageTitle": { zh: "选择语言", en: "Choose your language" },
  "onboarding.welcome.languageContinue": { zh: "继续", en: "Continue" },
  "onboarding.welcome.loginTitle": { zh: "登录或注册", en: "Sign in or create an account" },
  "onboarding.welcome.loginIntro": { zh: "登录或注册后可同步读经进度；也可先略过。", en: "Sign in or create an account to sync reading progress, or skip for now." },
  "onboarding.welcome.loginSkip": { zh: "略过", en: "Skip" },
  "onboarding.welcome.alarmTitle": { zh: "每日读经提醒", en: "Daily reading reminder" },
  "onboarding.welcome.alarmHint": {
    zh: "默认早上 7:00 通知提醒读经，可改时间；点开通知即可开始",
    en: "Defaults to a 7:00 AM reading reminder. Tap the notification to begin.",
  },
  "onboarding.welcome.alarmPlan": { zh: "读经计划：轻松读经", en: "Reading plan: Easy reading" },
  "onboarding.welcome.alarmPlanNamed": { zh: "读经计划：{{name}}", en: "Reading plan: {{name}}" },
  "onboarding.welcome.stepProgress": { zh: "第 {{step}} 步（共 {{total}} 步）", en: "Step {{step}} of {{total}}" },
  "pages.explore.welcomeIconLabel": { zh: "欢迎", en: "Welcome" },
  "pages.explore.readingAlarmIconLabel": { zh: "读经提醒", en: "Reading reminder" },
  "pages.explore.readingAlarmTitle": { zh: "读经提醒", en: "Reading reminder" },
  "pages.explore.readingAlarmLead": {
    zh: "每天到点通知，点开即可开始今日读经",
    en: "A daily notification opens today’s reading",
  },
  "pages.explore.readingAlarmTapTime": { zh: "点击改时间", en: "Tap to change time" },
  "pages.explore.readingAlarmToggle": { zh: "每日提醒", en: "Daily reminder" },
  "pages.explore.readingAlarmPlay": { zh: "播放", en: "Play" },
  "pages.explore.readingAlarmScripture": { zh: "读经", en: "Reading" },
  "pages.explore.readingAlarmMusic": { zh: "音乐", en: "Music" },
  "pages.explore.readingPlanIconLabel": { zh: "读经计划", en: "Reading plan" },
  "contentCorrection.link": { zh: "发现有问题？", en: "Spot an issue?" },
  "contentCorrection.sheetTitle": { zh: "内容纠错", en: "Report a content issue" },
  "contentCorrection.sheetIntro": {
    zh: "请简单说明哪里不对或哪里不清楚。我们会自动带上页面信息，方便后续审订。",
    en: "Briefly describe what seems wrong or unclear. We attach page context automatically for review.",
  },
  "contentCorrection.messageLabel": { zh: "说明", en: "Your note" },
  "contentCorrection.messagePlaceholder": {
    zh: "例如：这段引用与经文不符……",
    en: "e.g. This reference does not match the verse…",
  },
  "contentCorrection.emailLabel": { zh: "邮箱（选填）", en: "Email (optional)" },
  "contentCorrection.emailPlaceholder": { zh: "方便我们回复你", en: "If you would like a reply" },
  "contentCorrection.remainingChars": { zh: "还可输入 {{count}} 字", en: "{{count}} characters left" },
  "contentCorrection.submit": { zh: "提交", en: "Submit" },
  "contentCorrection.submitting": { zh: "提交中…", en: "Submitting…" },
  "contentCorrection.cancel": { zh: "取消", en: "Cancel" },
  "contentCorrection.done": { zh: "完成", en: "Done" },
  "contentCorrection.success": { zh: "已收到，感谢你的帮助。", en: "Received — thank you for helping us review." },
  "contentCorrection.errorEmpty": { zh: "请先写几句说明。", en: "Please write a short note first." },
  "contentCorrection.errorNetwork": { zh: "需要联网才能提交。", en: "An internet connection is required to submit." },
  "contentCorrection.errorSubmit": { zh: "提交失败，请稍后重试。", en: "Could not submit. Please try again." },
};

export function toZhTwText(input: string): string {
  let out = input;
  for (const [from, to] of ZH_TW_PHRASE_REPLACEMENTS) {
    out = out.replaceAll(from, to);
  }
  out = Array.from(out, (ch) => ZH_TW_CHAR_MAP[ch] ?? ch).join("");
  for (const [from, to] of ZH_TW_POST_CHAR_MAP_FIXUPS) {
    out = out.replaceAll(from, to);
  }
  return out;
}

/** 简体源文案在 zh-TW 下转为繁体；其它 locale 原样返回。 */
export function localizeZhText(locale: AppLocale, text: string): string {
  return locale === "zh-TW" ? toZhTwText(text) : text;
}

/** 界面双语文案：en 走英文，zh-CN/zh-TW 走简体源并在 zh-TW 下转繁体。 */
export function resolveUiText(locale: AppLocale, zhCN: string, en: string): string {
  if (locale === "en") return en;
  return localizeZhText(locale, zhCN);
}

export type SiteCopyVars = Record<string, string | number>;

function walk(obj: unknown, parts: string[]): unknown {
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function translate(locale: AppLocale, keyPath: string, vars?: SiteCopyVars): string {
  if (locale === "zh-TW") {
    const hit = ZH_TW_OVERRIDES[keyPath];
    if (typeof hit === "string" && hit.length > 0) {
      let s = hit;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return s;
    }
  }
  const fallback = AUTH_UI_FALLBACKS[keyPath];
  if (fallback) {
    let s = localizeZhText(locale, locale === "en" ? fallback.en : fallback.zh);
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replaceAll(`{{${k}}}`, String(v));
      }
    }
    return s;
  }
  const primary = MESSAGES[locale];
  // English must never fall back to zh-CN — missing keys used to leak Chinese into EN UI.
  const fallbacks = locale === "en" ? [] : [MESSAGES["zh-CN"], MESSAGES.en];
  for (const bundle of [primary, ...fallbacks]) {
    const hit = walk(bundle, keyPath.split("."));
    if (typeof hit === "string" && hit.length > 0) {
      let s = hit;
      if (locale === "zh-TW") {
        s = toZhTwText(s);
      }
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return s;
    }
  }
  return keyPath;
}

export function createT(locale: AppLocale) {
  return (keyPath: string, vars?: SiteCopyVars) => translate(locale, keyPath, vars);
}

/** 与网站 `locales/*.json` 同键路径；随 `LocaleProvider` 重挂载后使用当前语言。 */
export function t(keyPath: string): string {
  return translate(getLocale(), keyPath);
}

export function tFormat(keyPath: string, vars: SiteCopyVars): string {
  return translate(getLocale(), keyPath, vars);
}

export function resolveLocalizedField(
  field: string | { "zh-CN"?: string; en?: string } | undefined | null,
  locale: AppLocale = getLocale(),
): string {
  if (field == null) return "";
  if (typeof field === "string") return field.trim();
  if (locale === "en") return (field.en || field["zh-CN"] || "").trim();
  const raw = (field["zh-CN"] || field.en || "").trim();
  return locale === "zh-TW" ? toZhTwText(raw) : raw;
}

/** 曲目名按界面语言：英文用 en，中文用 zh-CN。 */
export function resolveMusicLocalizedField(
  field: string | { "zh-CN"?: string; en?: string } | undefined | null,
  locale: AppLocale = getLocale(),
): string {
  return resolveLocalizedField(field, locale);
}
