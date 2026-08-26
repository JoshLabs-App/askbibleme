export type ReadingAlarmWakeKind = "started" | "handoff" | "prelude-sync" | "none";

/** 回前台时该接哪一段：待读经交接 / 预备音乐还在响 / 刚到点补启动。 */
export function resolveReadingAlarmWakeKind(input: {
  pendingTrigger: boolean;
  preludeActive: boolean;
  dueStarted: boolean;
}): ReadingAlarmWakeKind {
  if (input.pendingTrigger) return "handoff";
  if (input.preludeActive) return "prelude-sync";
  return input.dueStarted ? "started" : "none";
}
