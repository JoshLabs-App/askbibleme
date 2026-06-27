import type { ReadingPlanRegistryEntry } from "@/lib/bible/reading-plans/types";

export const NT_DEEP_REPEAT_PLAN_ID = "nt-deep-repeat";

/** 探索 · 深度读经（麦克阿瑟原文与说明） */
export const NT_DEEP_REPEAT_EXPLORE_ARTICLE_SLUG = "a-macarthur-lifelong-bible-reading";

export const NT_DEEP_REPEAT_PLAN_DAY_COUNT = 1;

export function isNtDeepRepeatPlanId(planId: string): boolean {
  return planId.trim() === NT_DEEP_REPEAT_PLAN_ID;
}

export function getNtDeepRepeatRegistryEntry(): ReadingPlanRegistryEntry {
  return {
    planId: NT_DEEP_REPEAT_PLAN_ID,
    name: "新约深读 · 旧约通读",
    abbreviation: "nt30",
    description: "AskBible 方法二 · 有效深读：参考麦克阿瑟研经法，52 阶，7 / 14 / 28 天深度。",
    sourceUrl: "selah:nt-deep-repeat",
    bundlePath: "",
    dayCount: NT_DEEP_REPEAT_PLAN_DAY_COUNT,
    maxReadingsPerDay: 2,
    listPriority: -15,
  };
}
