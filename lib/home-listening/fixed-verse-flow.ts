/** 每 7 节共用的固定听读模板；每节出现 4 次，彼此之间穿插其它经文。 */
export const HOME_LISTENING_GROUP_SIZE = 7;
export const HOME_LISTENING_GROUP_FLOW = [
  0, 1, 0, 2, 1, 3, 0,
  4, 2, 1, 5, 3, 6, 4,
  5, 2, 6, 3, 4, 1, 5,
  6, 0, 2, 6, 3, 4, 5,
] as const;

export const HOME_LISTENING_GROUP_FLOW_LENGTH = HOME_LISTENING_GROUP_FLOW.length;
export const HOME_LISTENING_GROUPS_PER_STAGE = 7;

function positiveModulo(value: number, modulo: number): number {
  if (modulo <= 0) return 0;
  return ((value % modulo) + modulo) % modulo;
}

/**
 * 从所选经文范围生成固定播放流。范围末尾不足 7 节时，从范围开头补入回访经文。
 * `cursor` 只随真正完成的音频前进，不随首页文字轮播前进。
 */
export function buildFixedVerseFlow(
  verseKeys: readonly string[],
  cursor: number,
  count: number,
): string[] {
  if (verseKeys.length === 0 || count <= 0) return [];
  const groupCount = Math.max(1, Math.ceil(verseKeys.length / HOME_LISTENING_GROUP_SIZE));

  return Array.from({ length: count }, (_, offset) => {
    const absolutePosition = Math.max(0, Math.floor(cursor)) + offset;
    const completedGroupFlows = Math.floor(absolutePosition / HOME_LISTENING_GROUP_FLOW_LENGTH);
    const groupIndex = completedGroupFlows % groupCount;
    const templateIndex = absolutePosition % HOME_LISTENING_GROUP_FLOW_LENGTH;
    const slot = HOME_LISTENING_GROUP_FLOW[templateIndex] ?? 0;
    const sourceIndex = positiveModulo(groupIndex * HOME_LISTENING_GROUP_SIZE + slot, verseKeys.length);
    return verseKeys[sourceIndex]!;
  });
}

export function homeListeningPosition(cursor: number): {
  stage: number;
  group: number;
  positionInGroupFlow: number;
  completedGroups: number;
  completedStages: number;
} {
  const safe = Math.max(0, Math.floor(cursor));
  const completedGroups = Math.floor(safe / HOME_LISTENING_GROUP_FLOW_LENGTH);
  return {
    stage: Math.floor(completedGroups / HOME_LISTENING_GROUPS_PER_STAGE) + 1,
    group: (completedGroups % HOME_LISTENING_GROUPS_PER_STAGE) + 1,
    positionInGroupFlow: safe % HOME_LISTENING_GROUP_FLOW_LENGTH,
    completedGroups,
    completedStages: Math.floor(completedGroups / HOME_LISTENING_GROUPS_PER_STAGE),
  };
}
