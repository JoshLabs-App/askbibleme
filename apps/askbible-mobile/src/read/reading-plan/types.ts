/**
 * 读经计划的数据形状。**唯一定义在 `lib/bible/reading-plans/types.ts`**，这里只转出去。
 *
 * 手机侧原本有一份自己的拷贝，字段和 lib 那份逐字相同（只少了 `ReadingPlanBundle`
 * 和注释）。两份同形的类型定义不会报错，只会在其中一边加字段时悄悄分叉——
 * 而这些类型描述的正是手机和网页之间要来回同步的数据。
 */
export type {
  ReadingPlanDay,
  ReadingPlanRange,
  ReadingPlanRegistry,
  ReadingPlanRegistryEntry,
} from "@/lib/bible/reading-plans/types";
