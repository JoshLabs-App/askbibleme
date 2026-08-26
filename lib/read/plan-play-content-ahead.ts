/** 计划页列表相对日历今天的偏移（对齐 App）。 */
export function resolvePlanPlayContentAhead(viewAhead: number, committedAhead: number): number {
  const view = Number.isFinite(viewAhead) ? Math.floor(viewAhead) : 0;
  const committed = Number.isFinite(committedAhead) ? Math.max(0, Math.floor(committedAhead)) : 0;
  return view + committed;
}
