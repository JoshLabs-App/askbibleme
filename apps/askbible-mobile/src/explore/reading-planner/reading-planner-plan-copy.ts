import type { AppLocale } from "../../i18n/config";
import { toZhTwText } from "../../i18n/site-copy";
import type { NtDeepRepeatPace } from "../../read/reading-plan/nt-deep-repeat-pace";
import { DEEP_READING_EXPLORE_ARTICLE_SLUG } from "./reading-planner-routes";

export type ReadingPlannerPlanReference = {
  slug: string;
  label: string;
};

export type ReadingPlannerPlanCardCopy = {
  title: string;
  body: string;
  reference?: ReadingPlannerPlanReference;
};

function zh(locale: AppLocale, text: string): string {
  return locale === "zh-TW" ? toZhTwText(text) : text;
}

/** 正式研读 · 7 / 14 / 28 天连读 */
export function getNtDeepPacePlannerCopy(
  locale: AppLocale,
  pace: NtDeepRepeatPace,
): ReadingPlannerPlanCardCopy {
  if (locale === "en") {
    if (pace === 7) {
      return {
        title: "Formal study · 7-day repeats",
        body: "Start here to truly understand Scripture: 3–5 NT chapters daily—the same segment for 7 days, plus 1 OT chapter. Repeating beats rushing. No streaks or catch-up.",
      };
    }
    if (pace === 14) {
      return {
        title: "Formal study · 14-day repeats",
        body: "Same formal-study rhythm, 14 days per segment. Week two is when details and connections surface—for those who want Scripture to sink in.",
      };
    }
    return {
      title: "Formal study · 28-day repeats",
      body: "One month with each segment—layer by layer, like a master teacher. For sustained formal study.",
      reference: { slug: DEEP_READING_EXPLORE_ARTICLE_SLUG, label: "Formal study" },
    };
  }

  if (pace === 7) {
    return {
      title: zh(locale, "正式研读 · 7 天连读"),
      body: zh(
        locale,
        "想真正读懂圣经，从这里开始：同一段新约连读 7 天（每天 3–5 章），旧约 1 章陪着读。反复读比赶进度更容易读懂；不打卡、不补读。",
      ),
    };
  }
  if (pace === 14) {
    return {
      title: zh(locale, "正式研读 · 14 天连读"),
      body: zh(
        locale,
        "同一段新约连读 14 天（每天 3–5 章），旧约 1 章。跨过「好像懂了」那关，第二周细节与呼应才浮现——适合想把经文读透的人。",
      ),
    };
  }
  return {
    title: zh(locale, "正式研读 · 28 天连读"),
    body: zh(
      locale,
      "同一段新约连读 28 天（每天 3–5 章），旧约 1 章。效法研经大师的读法，默想层层加深，适合长期正式研读。",
    ),
    reference: { slug: DEEP_READING_EXPLORE_ARTICLE_SLUG, label: zh(locale, "正式研读") },
  };
}

export function getReadingPlannerStep3Intro(locale: AppLocale): { title: string; subtitle: string } {
  if (locale === "en") {
    return {
      title: "Choose your rhythm",
      subtitle:
        "Easy reading follows the Easter 2026 cycle by default. Formal study with 7-day repeats starts on the day you enable it.",
    };
  }
  return {
    title: zh(locale, "选一种适合自己的节奏"),
    subtitle: zh(
      locale,
      "轻松读经默认自 2026 年复活节起循环；正式研读（7 天连读）则从你启用的那天算第 1 天。",
    ),
  };
}

/** 轻松读经 · 三循环 */
export function getTripleLoopPlannerCopy(locale: AppLocale): ReadingPlannerPlanCardCopy {
  if (locale === "en") {
    return {
      title: "Easy reading · triple loop",
      body: "Zero pressure: 1 OT + 1 NT + 1 Wisdom segment daily. Day 1 is Easter 2026 (5 Apr); today's place follows that cycle. Stop and return anytime.",
    };
  }
  return {
    title: zh(locale, "轻松读经 · 三循环"),
    body: zh(
      locale,
      "毫无压力：每天旧约、新约、智慧书各 1 小段。第 1 天是 2026 年复活节（4 月 5 日），今日进度按此循环推算；停了再回来即可。",
    ),
  };
}
