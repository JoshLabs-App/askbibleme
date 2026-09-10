// TS 侧期望值：直接调共享库 lib/bible/golden-verse-audio.ts 与 lib/home-prayer-pools/pick-next.ts（tsx 跑）。
import { readFileSync } from "node:fs";
import * as audioNs from "../lib/bible/golden-verse-audio";
import * as pickNs from "../lib/home-prayer-pools/pick-next";
import * as stripNs from "../lib/bible/strip-zh-verse-display-notes";
const unwrap = (ns: any) => (ns && ns.default && typeof ns.default === "object" ? { ...ns.default, ...ns } : ns);
const audio: any = unwrap(audioNs);
const pick: any = unwrap(pickNs);
const strip: any = unwrap(stripNs);

const lines = readFileSync(0, "utf8").split("\n");
if (lines[lines.length - 1] === "") lines.pop();
let cursor = 0;
const take = () => (cursor < lines.length ? lines[cursor++] : "");
const k = Number(take());
const keys = Array.from({ length: k }, take);
const e = Number(take());
const entries = Array.from({ length: e }, () => { const p = take().split(" "); return { verseKey: p[0], weight: Number(p[1] ?? 1), chunkIndex: 0 }; });
const r = Number(take());
const rngValues = Array.from({ length: r }, () => Number(take()));
const n = Number(take());
const nows = Array.from({ length: n }, () => Number(take()));
const t = Number(take());
const texts = Array.from({ length: t }, take);

let rngCursor = 0;
const rng = () => (rngCursor < rngValues.length ? rngValues[rngCursor++] : (rngCursor++, 0));
const manifest = { version: 1 as const, scopeId: "parity", chunkSize: 20, entries };
const memory: Record<string, any> = {};
const picks: string[] = [];
for (const now of nows) {
  const key = pick.pickNextVerseKey(manifest, memory, now, rng);
  picks.push(key);
  if (key) pick.advanceMemoryAfterShown(memory, key, now);
}
const out = {
  paths: keys.map((key) => ({
    key,
    cuv: audio.buildGoldenVerseAudioRelativePath(key, "cuv-simp") ?? null,
    web: audio.buildGoldenVerseAudioRelativePath(key, "web-en") ?? null,
    url: audio.buildGoldenVerseAudioRemoteSrc(key, "cuv-simp") ?? null,
  })),
  picks,
  memory: Object.fromEntries(Object.entries(memory).map(([k2, v]: any) => [k2, { lastShownAt: Math.trunc(v.lastShownAt), intervalMs: Math.trunc(v.intervalMs), level: v.level }])),
  rngUsed: rngCursor,
  strips: texts.map((text) => ({ text, out: strip.stripZhVerseDisplayNotes(text) })),
};
process.stdout.write(JSON.stringify(out));
