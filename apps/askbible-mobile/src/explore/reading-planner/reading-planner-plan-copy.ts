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
        "Easy reading is light and pressure-free. Formal study with 7-day repeats helps you truly understand—the day you enable is day 1.",
    };
  }
  return {
    title: zh(locale, "选一种适合自己的节奏"),
    subtitle: zh(
      locale,
      "毫无压力地读，选轻松读经（三循环）；想真正读懂圣经，选正式研读（7 天连读）。今天启用，今天就是第 1 天。",
    ),
  };
}

export type ReadingPlannerPathGuidance = {
  lead: string;
  newcomerLabel: string;
  newcomerBody: string;
  deepReadLabel: string;
  deepReadBody: string;
};

export function getReadingPlannerPathGuidance(locale: AppLocale): ReadingPlannerPathGuidance {
  if (locale === "en") {
    return {
      lead: "Two paths—pick what fits your season:",
      newcomerLabel: "Easy reading",
      newcomerBody: "Triple loop: one short OT, NT, and Wisdom segment daily—no catch-up, no streaks.",
      deepReadLabel: "Formal study",
      deepReadBody:
        "7-day repeats: stay with the same passage until it sinks in—often easier than racing through chapters.",
    };
  }
  return {
    lead: zh(locale, "两条路线，按你的季节选："),
    newcomerLabel: zh(locale, "轻松读经"),
    newcomerBody: zh(
      locale,
      "三循环：每天旧约、新约、智慧书各一小段，无补读、无打卡，停了再回来即可。",
    ),
    deepReadLabel: zh(locale, "正式研读"),
    deepReadBody: zh(
      locale,
      "7 天连读：同一段反复读进心里，往往比一路赶进度更容易读懂——默认从这里开始。",
    ),
  };
}

/** 轻松读经 · 三循环 */
export function getTripleLoopPlannerCopy(locale: AppLocale): ReadingPlannerPlanCardCopy {
  if (locale === "en") {
    return {
      title: "Easy reading · triple loop",
      body: "Best if you are new or want zero pressure: 1 OT + 1 NT + 1 Wisdom segment daily—three independent loops, no catch-up. About one year through the NT; stop and return anytime.",
    };
  }
  return {
    title: zh(locale, "轻松读经 · 三循环"),
    body: zh(
      locale,
      "适合刚开始、希望毫无压力：每天旧约、新约、智慧书各 1 小段，三条线互不影响，无补读无打卡。约一年轻松通读新约，停了再回来即可。",
    ),
  };
}
