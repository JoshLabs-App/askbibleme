/** 自然首页挂载时覆盖全站经文轮播淡入淡出时长（对齐 App 2000ms） */

type NatureHomeVerseTimingOverride = {
  fadeMs: number;
};

const listeners = new Set<() => void>();
let override: NatureHomeVerseTimingOverride | null = null;

export function subscribeNatureHomeVerseTimingOverride(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function getNatureHomeVerseTimingOverride(): NatureHomeVerseTimingOverride | null {
  return override;
}

export function setNatureHomeVerseTimingOverride(next: NatureHomeVerseTimingOverride | null): void {
  override = next;
  listeners.forEach((l) => l());
}
