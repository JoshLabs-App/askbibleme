#!/usr/bin/env node
/** planFlow 纯逻辑校验（不 import RN 模块）。 */
function buildPlanChapterQueue(readings) {
  const out = [];
  for (const r of readings) {
    for (let ch = r.startChapter; ch <= r.endChapter; ch += 1) {
      out.push({ bookId: r.bookId, chapter: ch });
    }
  }
  return out;
}

function resolveNext(payload, bookId, chapter, allowLoop) {
  const readings = payload?.day?.readings ?? [];
  const queue = buildPlanChapterQueue(readings);
  const idx = queue.findIndex((r) => r.bookId === bookId && r.chapter === chapter);
  if (idx < 0) return null;
  const nextIdx = idx + 1;
  if (nextIdx < queue.length) return queue[nextIdx];
  return allowLoop ? queue[0] : null;
}

const payload = {
  day: {
    readings: [
      { bookId: "GEN", startChapter: 1, endChapter: 1 },
      { bookId: "GEN", startChapter: 2, endChapter: 2 },
      { bookId: "MAT", startChapter: 1, endChapter: 1 },
    ],
  },
};

const q = buildPlanChapterQueue(payload.day.readings);
if (q.length !== 3) {
  console.error("FAIL queue length", q.length);
  process.exit(1);
}
const n1 = resolveNext(payload, "GEN", 1, false);
const n2 = resolveNext(payload, "GEN", 2, false);
const loop = resolveNext(payload, "MAT", 1, true);
if (JSON.stringify(n1) !== JSON.stringify({ bookId: "GEN", chapter: 2 })) {
  console.error("FAIL next from GEN:1", n1);
  process.exit(1);
}
if (JSON.stringify(n2) !== JSON.stringify({ bookId: "MAT", chapter: 1 })) {
  console.error("FAIL next from GEN:2", n2);
  process.exit(1);
}
if (JSON.stringify(loop) !== JSON.stringify({ bookId: "GEN", chapter: 1 })) {
  console.error("FAIL loop from MAT:1", loop);
  process.exit(1);
}
console.log("PASS plan-flow-logic-check");
