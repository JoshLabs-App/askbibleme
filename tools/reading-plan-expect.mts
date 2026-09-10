// TS 侧期望值：直接调共享库 lib/bible/reading-plans/* 与 lib/read/*（tsx + tsconfig paths）。协议与两端 harness 相同。
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as epochNs from "../lib/read/reading-plan-epoch";
import * as prefsNs from "../lib/read/reading-plan-prefs";
import * as ntDayNs from "../lib/read/nt-deep-repeat-plan-day";
import * as tripleNs from "../lib/bible/reading-plans/triple-loop-reading";
import * as tripleReadNs from "../lib/bible/reading-plans/triple-loop-chapters-read";
import * as currNs from "../lib/bible/reading-plans/nt-deep-repeat-curriculum";
import * as ntReadingNs from "../lib/bible/reading-plans/nt-deep-repeat-reading";
import * as ntEffNs from "../lib/read/nt-deep-repeat-effective-plan-day";
import * as paceNs from "../lib/bible/reading-plans/nt-deep-repeat-pace";
import * as fmtNs from "../lib/bible/reading-plans/format-reading-range";
import * as storeNs from "../lib/bible/reading-plans/reading-plans-store";
import * as featNs from "../lib/bible/reading-plans/featured-reading-plans";
import * as aheadNs from "../lib/read/plan-play-content-ahead";
import * as pointerNs from "../lib/bible/reading-plans/pointer-reading-plan";
const unwrap = (ns: any) => (ns && ns.default && typeof ns.default === "object" ? { ...ns.default, ...ns } : ns);
const epoch: any = unwrap(epochNs), prefsLib: any = unwrap(prefsNs), ntDay: any = unwrap(ntDayNs), triple: any = unwrap(tripleNs);
const tripleRead: any = unwrap(tripleReadNs), curr: any = unwrap(currNs), ntReading: any = unwrap(ntReadingNs), ntEff: any = unwrap(ntEffNs);
const pace: any = unwrap(paceNs), fmt: any = unwrap(fmtNs), store: any = unwrap(storeNs), feat: any = unwrap(featNs);
const aheadLib: any = unwrap(aheadNs), pointer: any = unwrap(pointerNs);
// RN ReadPlanPlayMonthCalendar 里的私有函数：照抄算法做期望值
const prefsOf = (planId: string, anchor: string, startedOn: string, dayCount: string) =>
  ({ version: 1, planId, anchor, startedOn: startedOn || undefined, dayCount: dayCount ? Number(dayCount) : undefined });
const isAheadSelectable = (prefs: any, dayCount: number | undefined, ahead: number, now: Date) => {
  if (pointer.isPointerReadingPlanId(prefs.planId)) return true;
  const count = dayCount ?? prefs.dayCount ?? 365;
  if (!Number.isFinite(count) || count < 1) return false;
  const dayIndex = prefsLib.resolveReadingPlanDayIndex(prefs, count, now) + ahead;
  return dayIndex >= 0 && dayIndex < count;
};
const planDayNumber = (prefs: any, dayCount: number | undefined, contentAhead: number, now: Date) => {
  if (prefs.planId === "triple-loop") return Math.max(1, epoch.getReadingPlanDaySinceEpoch(now) + contentAhead);
  if (prefs.planId === "nt-deep-repeat") return Math.max(1, ntDay.resolveNtDeepRepeatPlanDay(prefs, now) + contentAhead);
  return prefsLib.resolveReadingPlanDayIndex(prefs, dayCount ?? prefs.dayCount ?? 365, now) + 1 + contentAhead;
};
const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetweenLocal = (from: Date, to: Date) => Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / 86_400_000);
const calGrid = (year: number, monthIndex: number, today: Date, viewAhead: number, listened: Set<string>, selectable: (a: number) => boolean) => {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const total = Math.ceil((startPad + daysInMonth) / 7) * 7;
  const cells: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const dayNum = i - startPad + 1;
    if (dayNum < 1 || dayNum > daysInMonth) { cells.push("_"); continue; }
    const date = new Date(year, monthIndex, dayNum);
    const ahead = daysBetweenLocal(today, date);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    let flags = "";
    if (ahead === 0) flags += "T";
    if (ahead === viewAhead) flags += "S";
    if (listened.has(iso)) flags += "L";
    if (!selectable(ahead)) flags += "x";
    cells.push(`${dayNum}:${ahead}:${flags}`);
  }
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7).join(","));
  return rows.join("|");
};
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const lines = readFileSync(0, "utf8").split("\n"); if (lines[lines.length - 1] === "") lines.pop();
const date = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const ptr = (s: string) => { const [bookId, ch] = s.split(":"); return { bookId, chapter: Number(ch) }; };
const showP = (p: any) => `${p.bookId}:${p.chapter}`;
const showT = (s: any) => `${showP(s.ot)}|${showP(s.nt)}|${showP(s.wisdom)}`;
const showN = (s: any) => `${showP(s.ot)}|i${s.curriculumIndex}|d${s.dayInSegment}|t${s.segmentDayTarget}|p${s.pace}`;
const keys = (raw: string) => { const p = raw.split(";").map((x) => x.split(",").filter(Boolean)); return { ot: p[0] ?? [], nt: p[1] ?? [], wisdom: p[2] ?? [] }; };
const out: string[] = [];
for (const line of lines) {
  const f = line.split("\t");
  switch (f[0]) {
    case "epoch": out.push(String(epoch.getReadingPlanDaySinceEpoch(date(f[1])))); break;
    case "dayindex": out.push(String(prefsLib.resolveReadingPlanDayIndex({ version: 1, planId: "x", anchor: f[1], startedOn: f[2] || undefined }, Number(f[3]), date(f[4])))); break;
    case "ntday": out.push(String(ntDay.resolveNtDeepRepeatPlanDay({ version: 1, planId: "nt-deep-repeat", anchor: "from-today", startedOn: f[1] || undefined }, date(f[2])))); break;
    case "triple": out.push(showT(triple.tripleLoopStateForPlanDay(Number(f[1])))); break;
    case "triplefix": { const day = Number(f[1]); const s = { ot: ptr(f[2]), nt: ptr(f[3]), wisdom: ptr(f[4]) }; out.push(showT(triple.clipCoordinatedTripleLoopAheadToPlanDay(triple.snapTripleLoopStateToPlanDay(s, day), day))); break; }
    case "tripleadv": out.push(showT(triple.advanceTripleLoopTrack({ ot: ptr(f[2]), nt: ptr(f[3]), wisdom: ptr(f[4]) }, f[1]))); break;
    case "tripleread": { const s = triple.normalizeTripleLoopReadingState({ ...triple.createDefaultTripleLoopReadingState(), chaptersReadKeys: keys(f[3]) }); const r = tripleRead.addUserChapterReadToState(s, f[1], Number(f[2])); const k = tripleRead.normalizeTripleLoopChaptersReadKeys(r.chaptersReadKeys); out.push(`${k.ot.length},${k.nt.length},${k.wisdom.length}|${k.ot.join(",")};${k.nt.join(",")};${k.wisdom.join(",")}`); break; }
    case "ntseg": { const s = curr.getNtDeepRepeatSegment(Number(f[1])); out.push(s ? curr.ntDeepRepeatSegmentKey(s) : "null"); break; }
    case "ntstate": out.push(showN(ntReading.ntDeepRepeatStateForPlanDay(Number(f[1]), { pace: Number(f[2]), startedAt: f[3] }))); break;
    case "ntinfer": out.push(String(ntEff.inferNtDeepRepeatPlanDayFromProgress({ ...ntReading.createDefaultNtDeepRepeatReadingState(Number(f[3])), curriculumIndex: Number(f[1]), dayInSegment: Number(f[2]), segmentDayTarget: Number(f[3]), startedAt: f[4] }, f[4]))); break;
    case "ntadvnt": { const r = ntReading.advanceNtDeepRepeatNtDay({ ...ntReading.createDefaultNtDeepRepeatReadingState(Number(f[3])), curriculumIndex: Number(f[1]), dayInSegment: Number(f[2]), segmentDayTarget: Number(f[4]) }); out.push(`${showN(r)}|nt${r.chaptersRead?.nt ?? 0}`); break; }
    case "fmt": out.push(`${fmt.formatReadingPlanRange({ bookId: f[1], startChapter: Number(f[2]), endChapter: Number(f[3]), label: "", planChapterTotal: 1 })}|${triple.formatTripleLoopReadingLineVerbose(f[1], Number(f[2]))}`); break;
    case "dur": out.push(pace.formatApproxDurationZh(Number(f[1]))); break;
    case "catalog": { const reg = store.readReadingPlanRegistrySync(ROOT); const { featured } = feat.partitionReadingPlanCatalog(reg.plans); out.push(reg.plans.map((p: any) => p.planId).join(",") + "|" + featured.map((p: any) => p.planId).join(",")); break; }
    case "curriculum": out.push(curr.NT_DEEP_REPEAT_CURRICULUM.map((s: any) => curr.ntDeepRepeatSegmentKey(s)).join(";")); break;
    case "orders": out.push(triple.TRIPLE_LOOP_OT_BOOK_IDS.join(",") + "|" + triple.TRIPLE_LOOP_NT_BOOK_IDS.join(",") + "|" + curr.NT_DEEP_REPEAT_OT_BOOK_IDS.join(",")); break;
    case "ahead": out.push(String(aheadLib.resolvePlanPlayContentAhead(Number(f[1]), Number(f[2])))); break;
    case "aheadsel": out.push(isAheadSelectable(prefsOf(f[1], f[2], f[3], f[4]), f[4] ? Number(f[4]) : undefined, Number(f[5]), date(f[6])) ? "1" : "0"); break;
    case "planday": out.push(String(planDayNumber(prefsOf(f[1], f[2], f[3], f[4]), f[4] ? Number(f[4]) : undefined, Number(f[5]), date(f[6])))); break;
    case "regidx": { const count = Number(f[3]); const idx = prefsLib.resolveReadingPlanDayIndex(prefsOf("x", f[1], f[2], f[3]), count, date(f[5])) + Number(f[4]); out.push(String(count < 1 ? 0 : Math.min(Math.max(0, idx), count - 1))); break; }
    case "calgrid": { const listened = new Set(f[5].split(",").filter(Boolean)); const spec = f[6].split(":"); const sel = spec[0] === "all" ? () => true : (a: number) => a >= Number(spec[1]) && a <= Number(spec[2]); out.push(calGrid(Number(f[1]), Number(f[2]) - 1, date(f[3]), Number(f[4]), listened, sel)); break; }
    default: out.push("skip");
  }
}
process.stdout.write(JSON.stringify(out));
