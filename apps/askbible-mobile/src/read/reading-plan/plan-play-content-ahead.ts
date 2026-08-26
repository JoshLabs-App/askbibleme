/**
 * 计划页列表相对日历今天的偏移。
 * 已提交的 aheadDays 会平移整本日历：点今天、昨天、明天都在同一套「快 N 天」池上。
 * 例如 19 号把 30 号设为今天（+11）后，点 20 号应是原 31 号经文，不是原 20 号。
 */
export function resolvePlanPlayContentAhead(viewAhead: number, committedAhead: number): number {
  const view = Number.isFinite(viewAhead) ? Math.floor(viewAhead) : 0;
  const committed = Number.isFinite(committedAhead) ? Math.max(0, Math.floor(committedAhead)) : 0;
  return view + committed;
}
