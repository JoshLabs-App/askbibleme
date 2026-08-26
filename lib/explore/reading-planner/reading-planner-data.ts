import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";

export type ReadingPlannerDirectionCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

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
