/** 今日读经计划播放页（对齐 App `/read/plan-play`）。 */
export function readPlanPlayHref(): "/read/plan-play" {
  return "/read/plan-play";
}

export function isReadPlanPlayPath(pathname: string): boolean {
  const p = pathname.replace(/\/$/, "") || "/";
  return p === "/read/plan-play";
}
