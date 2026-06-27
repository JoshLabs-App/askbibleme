import type { AppLocale } from "../../i18n/config";
import { toZhTwText } from "../../i18n/site-copy";

export type ReadingPlannerPainId =
  | "pressure"
  | "cant_start"
  | "scan_only"
  | "no_rhythm"
  | "just_return";

export type ReadingPlannerPainOption = {
  id: ReadingPlannerPainId;
  title: string;
  description: string;
  icon: string;
};

export type ReadingPlannerDirectionCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

const painOptionsZh: ReadingPlannerPainOption[] = [
  {
    id: "pressure",
    title: "一落后就内疚",
    description: "打卡、补读、进度表\n让人很难继续。",
    icon: "calendar-alert",
  },
  {
    id: "cant_start",
    title: "想读，但总是开始不了",
    description: "知道读经重要，\n却被压力和计划挡住。",
    icon: "calendar-blank-outline",
  },
  {
    id: "scan_only",
    title: "读了很多，读不进心里",
    description: "经文扫过眼睛，\n却很难留在心里。",
    icon: "book-open-page-variant-outline",
  },
  {
    id: "no_rhythm",
    title: "没有稳定节奏",
    description: "读一阵就停，\n很难形成长期习惯。",
    icon: "waveform",
  },
  {
    id: "just_return",
    title: "只是想回到神话语",
    description: "不需要复杂方案，\n想要有效简单来读经。",
    icon: "leaf",
  },
];

const painOptionsEn: ReadingPlannerPainOption[] = [
  {
    id: "pressure",
    title: "Falling behind brings guilt",
    description: "Streaks, catch-up, and calendars\nmake it hard to continue.",
    icon: "calendar-alert",
  },
  {
    id: "cant_start",
    title: "I want to read but cannot start",
    description: "Scripture matters to me,\nbut pressure blocks me.",
    icon: "calendar-blank-outline",
  },
  {
    id: "scan_only",
    title: "I read a lot but it does not sink in",
    description: "Words pass my eyes\nbut rarely stay with me.",
    icon: "book-open-page-variant-outline",
  },
  {
    id: "no_rhythm",
    title: "No steady rhythm",
    description: "I start, then stop,\nand struggle to stay with it.",
    icon: "waveform",
  },
  {
    id: "just_return",
    title: "I just want to return to God's word",
    description: "No complex system needed,\nI want an effective, simple way to read.",
    icon: "leaf",
  },
];

const directionCardsZh: ReadingPlannerDirectionCard[] = [
  {
    id: "understand",
    title: "读得懂，比读得多更重要",
    description: "同一段反复读进心里，\n比快速扫过整本更有价值。",
    icon: "magnify",
  },
  {
    id: "return",
    title: "能回来，比完成计划更重要",
    description: "停了再回来即可，\n不必补读、不必赶进度。",
    icon: "book-open-page-variant-outline",
  },
  {
    id: "today",
    title: "今天一段，也很好",
    description: "一句经文有时\n比三章快速扫过更重要。",
    icon: "candle",
  },
  {
    id: "no_kpi",
    title: "不设 KPI",
    description: "启用当天就是第 1 天，\n属灵生活不是考试。",
    icon: "heart-outline",
  },
];

const directionCardsEn: ReadingPlannerDirectionCard[] = [
  {
    id: "understand",
    title: "Understanding beats volume",
    description: "Repeating the same passage\nuntil it sinks in matters more than speed.",
    icon: "magnify",
  },
  {
    id: "return",
    title: "Returning beats finishing the plan",
    description: "Come back when you can.\nNo catch-up, no guilt.",
    icon: "book-open-page-variant-outline",
  },
  {
    id: "today",
    title: "One passage today is enough",
    description: "One verse held closely\ncan outweigh three chapters skimmed.",
    icon: "candle",
  },
  {
    id: "no_kpi",
    title: "No KPI",
    description: "The day you start is day 1.\nSpiritual life is not a test.",
    icon: "heart-outline",
  },
];

export function getReadingPlannerPainOptions(locale: AppLocale): ReadingPlannerPainOption[] {
  if (locale === "en") return painOptionsEn;
  const options = painOptionsZh;
  if (locale === "zh-TW") {
    return options.map((item) => ({
      ...item,
      title: toZhTwText(item.title),
      description: toZhTwText(item.description),
    }));
  }
  return options;
}

export function getReadingPlannerDirectionCards(locale: AppLocale): ReadingPlannerDirectionCard[] {
  if (locale === "en") return directionCardsEn;
  const cards = directionCardsZh;
  if (locale === "zh-TW") {
    return cards.map((item) => ({
      ...item,
      title: toZhTwText(item.title),
      description: toZhTwText(item.description),
    }));
  }
  return cards;
}
