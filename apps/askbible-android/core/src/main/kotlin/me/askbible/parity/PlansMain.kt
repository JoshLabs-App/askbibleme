package me.askbible.parity

import me.askbible.native_.data.NtDeepRepeat
import me.askbible.native_.data.NtDeepRepeatState
import me.askbible.native_.data.PlanAnchor
import me.askbible.native_.data.PlanDates
import me.askbible.native_.data.PlanPlay
import me.askbible.native_.data.PlanPointer
import me.askbible.native_.data.PlanReading
import me.askbible.native_.data.ReadingPlanCatalog
import me.askbible.native_.data.ReadingPlanPrefs
import me.askbible.native_.data.ReadingPlanRules
import me.askbible.native_.data.TripleLoop
import me.askbible.native_.data.TripleLoopState
import me.askbible.native_.data.TripleTrack

/** 读经计划对拍 harness（core --plans），协议与 Swift 侧相同 */
fun plansMain() {
    val lines = generateSequence(::readLine).toList()
    fun date(s: String) = PlanDates.toLocalDate(s)!!
    fun ptr(s: String): PlanPointer { val p = s.split(":"); return PlanPointer(p[0], p[1].toInt()) }
    fun show(p: PlanPointer) = "${p.bookId}:${p.chapter}"
    fun show(s: TripleLoopState) = "${show(s.ot)}|${show(s.nt)}|${show(s.wisdom)}"
    fun show(s: NtDeepRepeatState) = "${show(s.ot)}|i${s.curriculumIndex}|d${s.dayInSegment}|t${s.segmentDayTarget}|p${s.pace}"
    fun keys(raw: String): Map<String, List<String>> {
        val parts = raw.split(";").map { it.split(",").filter { k -> k.isNotEmpty() } }
        return mapOf("ot" to parts.getOrElse(0) { emptyList() }, "nt" to parts.getOrElse(1) { emptyList() }, "wisdom" to parts.getOrElse(2) { emptyList() })
    }
    val out = ArrayList<String>()
    for (line in lines) {
        val f = line.split("\t")
        out.add(when (f[0]) {
            "epoch" -> "${PlanDates.daySinceEpoch(date(f[1]))}"
            "dayindex" -> "${ReadingPlanRules.dayIndex(ReadingPlanPrefs("x", PlanAnchor.from(f[1])!!, f[2].ifEmpty { null }), f[3].toInt(), date(f[4]))}"
            "ntday" -> "${ReadingPlanRules.ntPlanDay(ReadingPlanPrefs(ReadingPlanCatalog.NT_DEEP_REPEAT_ID, PlanAnchor.FROM_TODAY, f[1].ifEmpty { null }), date(f[2]))}"
            "triple" -> show(TripleLoop.stateForPlanDay(f[1].toInt()))
            "triplefix" -> { val day = f[1].toInt(); show(TripleLoop.clipCoordinatedAhead(TripleLoop.snapToPlanDay(TripleLoopState(ptr(f[2]), ptr(f[3]), ptr(f[4])), day), day)) }
            "tripleadv" -> show(TripleLoop.advanceTrack(TripleLoopState(ptr(f[2]), ptr(f[3]), ptr(f[4])), TripleTrack.entries.first { it.raw == f[1] }))
            "tripleread" -> {
                val r = TripleLoop.addChapterRead(TripleLoop.normalize(TripleLoop.defaultState().copy(chaptersReadKeys = keys(f[3]))), f[1], f[2].toInt())
                "${r.chaptersRead["ot"]},${r.chaptersRead["nt"]},${r.chaptersRead["wisdom"]}|${r.chaptersReadKeys["ot"]!!.joinToString(",")};${r.chaptersReadKeys["nt"]!!.joinToString(",")};${r.chaptersReadKeys["wisdom"]!!.joinToString(",")}"
            }
            "ntseg" -> NtDeepRepeat.segment(f[1].toInt())?.key ?: "null"
            "ntstate" -> show(NtDeepRepeat.stateForPlanDay(f[1].toInt(), f[2].toInt(), f[3]))
            "ntinfer" -> "${NtDeepRepeat.inferPlanDay(NtDeepRepeat.defaultState(f[3].toInt()).copy(curriculumIndex = f[1].toInt(), dayInSegment = f[2].toInt(), segmentDayTarget = f[3].toInt(), startedAt = f[4]), f[4])}"
            "ntadvnt" -> { val r = NtDeepRepeat.advanceNtDay(NtDeepRepeat.defaultState(f[3].toInt()).copy(curriculumIndex = f[1].toInt(), dayInSegment = f[2].toInt(), segmentDayTarget = f[4].toInt())); "${show(r)}|nt${r.chaptersRead["nt"]}" }
            "fmt" -> { val r = PlanReading(f[1], f[2].toInt(), f[3].toInt()); "${r.display}|${TripleLoop.formatVerbose(f[1], f[2].toInt())}" }
            "ntfmt" -> { val r = PlanReading(f[1], f[2].toInt(), f[3].toInt()); "${NtDeepRepeat.rangeLine(r)}|${NtDeepRepeat.otLine(f[1], f[2].toInt())}" }
            "dur" -> NtDeepRepeat.formatApproxDurationZh(f[1].toInt())
            "catalog" -> ReadingPlanCatalog.plans.joinToString(",") { it.planId } + "|" + ReadingPlanCatalog.featured.joinToString(",") { it.planId }
            "curriculum" -> NtDeepRepeat.CURRICULUM.joinToString(";") { it.key }
            "orders" -> TripleLoop.OT_ORDER.joinToString(",") + "|" + TripleLoop.NT_ORDER.joinToString(",") + "|" + NtDeepRepeat.OT_ORDER.joinToString(",")
            // 播放页
            "ahead" -> "${PlanPlay.contentAhead(f[1].toInt(), f[2].toInt())}"
            "aheadsel" -> { val p = ReadingPlanPrefs(f[1], PlanAnchor.from(f[2])!!, f[3].ifEmpty { null }, f[4].toIntOrNull()); if (PlanPlay.isAheadSelectable(p, f[4].toIntOrNull(), f[5].toInt(), date(f[6]))) "1" else "0" }
            "planday" -> { val p = ReadingPlanPrefs(f[1], PlanAnchor.from(f[2])!!, f[3].ifEmpty { null }, f[4].toIntOrNull()); "${PlanPlay.planDayNumber(p, f[4].toIntOrNull(), f[5].toInt(), date(f[6]))}" }
            "regidx" -> { val p = ReadingPlanPrefs("x", PlanAnchor.from(f[1])!!, f[2].ifEmpty { null }, f[3].toInt()); "${PlanPlay.registryDayIndex(p, f[3].toInt(), f[4].toInt(), date(f[5]))}" }
            "calgrid" -> {
                val listened = f[5].split(",").filter { it.isNotEmpty() }.toSet()
                val spec = f[6].split(":")
                val sel: (Int) -> Boolean = if (spec[0] == "all") { _ -> true } else { a -> a >= spec[1].toInt() && a <= spec[2].toInt() }
                PlanPlay.describe(PlanPlay.monthGrid(f[1].toInt(), f[2].toInt(), date(f[3]), f[4].toInt(), listened, sel))
            }
            else -> "?"
        })
    }
    println("[" + out.joinToString(",") { jsonString(it) } + "]")
}
