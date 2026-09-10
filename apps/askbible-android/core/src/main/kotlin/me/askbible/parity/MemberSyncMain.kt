package me.askbible.parity

import me.askbible.native_.data.MemberReadingSyncRules as R
import me.askbible.native_.data.PlanDates
import org.json.JSONObject
import org.json.JSONTokener
import java.time.LocalDate

/** 会员读经同步纯规则对拍 harness（core --membersync），协议与 Swift 侧相同 */
fun memberSyncMain() {
    fun json(s: String): Any? { val t = s.trim(); if (t.isEmpty() || t == "-") return null; return try { JSONTokener(t).nextValue() } catch (_: Exception) { null } }
    fun localDate(iso: String): LocalDate { val (y, m, d) = PlanDates.parseLocalDate(iso)!!; return LocalDate.of(y, m, d) }
    fun dates(s: String) = if (s.isEmpty()) emptyList() else s.split(",")
    val lines = generateSequence(::readLine).toList()
    val out = ArrayList<String>()
    for (line in lines) {
        val f = line.split("\t")
        out.add(when (f[0]) {
            "merge" -> R.canonicalJson(R.mergePush(R.dict(json(f[1])), R.dict(json(f[2])), localDate(f[3])))
            "mergeval" -> R.canonicalJson(R.mergeBlobValue(f[1], json(f[2]), json(f[3]), localDate(f[4])))
            "path" -> R.decidePath(f[1].ifEmpty { null }, f[2] == "1", f[3], f[4] == "1", f[5] == "1", f[6] == "1").raw
            "force" -> if (R.shouldForcePush(f[1].ifEmpty { null })) "1" else "0"
            "progress" -> if (R.blobsHaveProgress(R.dict(json(f[1])))) "1" else "0"
            "shouldsync" -> if (R.shouldSyncReadingPlanPrefs(R.dict(json(f[1])))) "1" else "0"
            "sidecar" -> R.canonicalJson(R.localeValueWithReadingPlan(json(f[1]), json(f[2])))
            "planid" -> R.planIdFromBlobs(R.dict(json(f[1]))) ?: "null"
            "scope" -> "${if (R.isSameTodayReadingPlanScope(f[1].ifEmpty { null }, f[2].ifEmpty { null })) 1 else 0}|${R.planIdFromScopeKey(f[1]) ?: "null"}"
            "streak" -> R.computeReadingStreak(dates(f[1]), f[2]).toString()
            "dates" -> R.normalizeDates(dates(f[1])).joinToString(",")
            "yeartl" -> { val (y, m, d) = PlanDates.parseLocalDate(f[1])!!; val t = R.yearTimeline(y, m, d); "${t.dayOfYear}|${t.daysInYear}|${String.format("%.6f", t.progress)}" }
            "ranges" -> {
                val (y, m, d) = PlanDates.parseLocalDate(f[2])!!
                val tl = R.yearTimeline(y, m, d)
                R.yearReadRanges(dates(f[1]), y, m, d).joinToString(";") { (s, e) ->
                    val (left, width) = R.rangeToTrackFraction(s, e, tl.daysInYear)
                    "$s-$e@${String.format("%.5f", left)}+${String.format("%.5f", width)}"
                }
            }
            "fmtlisten" -> R.formatListenDuration(f[1].toIntOrNull() ?: 0, f[2] == "en")
            "fmtusage" -> R.formatUsageDuration(f[1].toIntOrNull() ?: 0, f[2] == "en")
            "parsems" -> R.jsDateParseMs(f[1])?.toLong()?.toString() ?: "null"
            "iso" -> R.isoString(f[1].toDouble())
            else -> "?"
        })
    }
    println("[" + out.joinToString(",") { jsonString(it) } + "]")
}
