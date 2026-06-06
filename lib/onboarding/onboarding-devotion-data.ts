import type { AppLocale } from "@/lib/i18n/config";
import { toZhTwText } from "@/lib/i18n/zh-tw-text";
import type { CompanionNeedId } from "@/lib/onboarding/onboarding-devotion-prefs";

export type CompanionNeedOption = {
  id: CompanionNeedId;
  title: string;
  description: string;
  icon: string;
};

export type SolutionCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
};

const companionNeedOptionsZh: CompanionNeedOption[] = [
  {
    id: "quiet",
    title: "心里很满，想安静下来",
    description: "生活很吵，思绪很多，\n想先慢下来。",
    icon: "leaf",
  },
  {
    id: "encouragement",
    title: "有些疲惫，想被经文扶持",
    description: "不是需要很多道理，\n只是需要一句神话语的提醒。",
    icon: "heart",
  },
  {
    id: "start_reading",
    title: "想读经，但总是开始不了",
    description: "知道读经重要，\n却常常被进度和压力挡住。",
    icon: "calendar",
  },
  {
    id: "understand_bible",
    title: "有读圣经，但常常读不懂",
    description: "读了经文，\n却不知道重点在哪里。",
    icon: "question",
  },
  {
    id: "daily_closeness",
    title: "我只是想每天亲近神一点",
    description: "没有特别的问题，\n只想每天有一点稳定的属灵陪伴。",
    icon: "sprout",
  },
];

const companionNeedOptionsEn: CompanionNeedOption[] = [
  {
    id: "quiet",
    title: "My mind is full, I need quiet",
    description: "Life feels noisy and crowded.\nI want to slow down first.",
    icon: "leaf",
  },
  {
    id: "encouragement",
    title: "I feel tired and need Scripture support",
    description: "I do not need more explanations,\njust one reminder from God's word.",
    icon: "heart",
  },
  {
    id: "start_reading",
    title: "I want to read but cannot start",
    description: "I know reading Scripture matters,\nbut pressure and plans block me.",
    icon: "calendar",
  },
  {
    id: "understand_bible",
    title: "I read but often do not understand",
    description: "I read the passage,\nbut I miss the main point.",
    icon: "question",
  },
  {
    id: "daily_closeness",
    title: "I just want to stay close to God daily",
    description: "No special problem right now,\njust steady spiritual companionship.",
    icon: "sprout",
  },
];

const solutionCardsZh: SolutionCard[] = [
  {
    id: "understand_over_amount",
    title: "读得懂，比读得多更重要",
    description: "借着经文支持与陪读引导，\n我们陪你一起读懂圣经。",
    icon: "search",
  },
  {
    id: "return_over_perfect_plan",
    title: "能回到神的话语，\n比是否完成计划更重要",
    description: "用音乐灵修安静心，再用经文支持继续走，\n让你随时都能回来。",
    icon: "book",
  },
  {
    id: "finish_over_start",
    title: "终点，比开始更重要",
    description: "加油，我们陪你前行。\n音乐灵修 + 经文支持，我们一起同行。",
    icon: "candle",
  },
];

const solutionCardsEn: SolutionCard[] = [
  {
    id: "understand_over_amount",
    title: "Understanding matters more than volume",
    description: "With Scripture support and gentle guidance, we help you truly understand the Bible.",
    icon: "search",
  },
  {
    id: "return_over_perfect_plan",
    title: "Returning to God's word matters more than perfect completion",
    description: "Start with devotional music, then continue with Scripture support whenever you return.",
    icon: "book",
  },
  {
    id: "finish_over_start",
    title: "Finishing matters more than starting",
    description: "Keep going. We are with you. Devotional music and Scripture support help you stay steady.",
    icon: "candle",
  },
];

export function getCompanionNeedOptions(locale: AppLocale): CompanionNeedOption[] {
  if (locale === "en") return companionNeedOptionsEn;
  if (locale === "zh-TW") {
    return companionNeedOptionsZh.map((item) => ({
      ...item,
      title: toZhTwText(item.title),
      description: toZhTwText(item.description),
    }));
  }
  return companionNeedOptionsZh;
}

export function getSolutionCards(locale: AppLocale): SolutionCard[] {
  if (locale === "en") return solutionCardsEn;
  if (locale === "zh-TW") {
    return solutionCardsZh.map((item) => ({
      ...item,
      title: toZhTwText(item.title),
      description: toZhTwText(item.description),
    }));
  }
  return solutionCardsZh;
}
