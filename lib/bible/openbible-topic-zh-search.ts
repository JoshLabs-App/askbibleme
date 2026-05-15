import { resolveOpenbibleTopicZh } from "@/lib/bible/openbible-topic-zh-resolve";

/** 主题筛选框含汉字时，按中文译名（及手册／拆词结果）在内存中匹配，而非仅 SQL LIKE 英文 topic。 */
export function looksLikeChineseTopicQuery(s: string): boolean {
  return /\p{Script=Han}/u.test(s);
}

type DistinctTopicDb = {
  prepare: (sql: string) => {
    bind: (values: unknown[] | Record<string, unknown>) => void;
    step: () => boolean;
    getAsObject: () => Record<string, unknown>;
    free: () => void;
  };
};

/**
 * 在所有不重复英文 topic 上解析 `topicZh`，返回中文子串命中的英文 topic 列表（用于 SQL IN）。
 */
export function findTopicsMatchingChineseTopicQuery(
  db: DistinctTopicDb,
  cwd: string,
  queryRaw: string,
  overrides: Record<string, string>,
): string[] {
  const query = queryRaw.trim();
  if (!query) return [];

  const stmt = db.prepare("SELECT DISTINCT topic FROM openbible_topic_row");
  const topics: string[] = [];
  while (stmt.step()) {
    const o = stmt.getAsObject() as { topic?: string };
    const t = String(o.topic ?? "");
    if (t) topics.push(t);
  }
  stmt.free();

  const hits: string[] = [];
  for (const topic of topics) {
    const zh = resolveOpenbibleTopicZh(cwd, topic, overrides);
    if (zh && zh.includes(query)) {
      hits.push(topic);
    }
  }
  return hits;
}
