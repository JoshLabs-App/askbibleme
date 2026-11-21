package me.askbible.native_.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.OffsetDateTime

/**
 * 会员读经同步的本机轻量规则与展示辅助（DECISIONS D-44：服务端 `askbible-sync` 统一执行 26 个 blob 的三方合并，
 * 客户端不再重复维护 450 行合并器，仅保留归属判定、本机计划偏好合并、习惯连读统计、全年轴与时长格式化）。
 * 与 iOS `MemberReadingSync.swift` 同构。
 */
object MemberReadingSyncRules {
    const val SCHEMA_VERSION = 1
    const val META_KEY = "askbible.member-reading-sync-meta.v1"
    val BLOB_KEYS: List<String> = listOf(
        "bookmarks", "highlights", "lastPosition", "chapterCompletion", "tripleLoopProgress", "ntDeepRepeatProgress",
        "readingPlanPrefs", "todayReadingDone", "todayReadingFraction", "habitStats", "scriptureListenTotals",
        "readTypography", "readTranslation", "recentSearches", "homeNatureUi", "homePrayerVerse", "homeVersePoolScope",
        "natureSceneUi", "musicVisualTheme", "scripturePlaybackRate", "cuvAudioVoice", "exploreYearDayProfile", "appLocale",
        "appUsageTime", "recentChapters", "achievements",
    )
    const val MIN_SYNC_INTERVAL_MS = 30_000L
    const val LOCAL_CHANGE_DEBOUNCE_MS = 1_500L
    const val POLL_INTERVAL_MS = 45_000L
    const val READING_HABIT_MIN_FRACTION = 0.2
    const val TODAY_READING_AUTO_DONE_FRACTION = 0.88

    // ---- JSON 小工具 ----

    fun dict(v: Any?): JSONObject? = v as? JSONObject
    fun str(v: Any?): String? = v as? String
    fun num(v: Any?): Double? = (v as? Number)?.toDouble()
    fun bool(v: Any?): Boolean? = v as? Boolean
    fun isNull(v: Any?): Boolean = v == null || v === JSONObject.NULL
    fun stringArray(v: Any?): List<String> {
        val a = v as? JSONArray ?: return emptyList()
        return (0 until a.length()).mapNotNull { a.opt(it) as? String }
    }
    private fun JSONObject.copy(): JSONObject = JSONObject().also { o -> for (k in keys()) o.put(k, opt(k)) }

    fun jsDateParseMs(raw: String?): Double? {
        val s = raw?.trim().orEmpty()
        if (s.isEmpty()) return null
        try { return OffsetDateTime.parse(s).toInstant().toEpochMilli().toDouble() } catch (_: Exception) {}
        val (y, m, d) = PlanDates.parseLocalDate(s) ?: return null
        return PlanDates.daysFromCivil(y, m, d).toDouble() * 86_400_000
    }

    fun parseIsoMs(iso: String?): Double = jsDateParseMs(iso) ?: 0.0

    fun isoString(ms: Double): String = MemberAuthRules.ISO_MILLIS.format(java.time.Instant.ofEpochMilli(ms.toLong()))

    fun jsSorted(list: Collection<String>): List<String> = list.sorted()

    fun parseListenTotals(v: Any?): JSONObject? {
        val d = dict(v) ?: return null
        if (num(d.opt("version")) != 1.0) return null
        val n = num(d.opt("totalSec")) ?: return null
        if (n.isNaN() || n.isInfinite() || n < 0) return null
        return JSONObject().put("version", 1).put("totalSec", Math.floor(n).toLong())
    }

    // ---- 读经计划偏好（本机校验与云端回填） ----

    private const val DEFAULT_PLAN_ID = "triple-loop"
    private const val DEFAULT_ANCHOR = "calendar-easter"
    private const val EASTER_EPOCH = "2026-04-05"
    private const val NT_DEEP_REPEAT_PLAN_ID = "nt-deep-repeat"
    private const val NT_DEFAULT_PACE = 7.0

    private fun readAheadDays(p: JSONObject): Int {
        val n = num(p.opt("aheadDays")) ?: return 0
        if (n.isNaN() || n.isInfinite()) return 0
        return maxOf(0, Math.floor(n).toInt())
    }

    private fun isUnchosenProductDefault(p: JSONObject): Boolean {
        if (bool(p.opt("chosen")) == true) return false
        if (readAheadDays(p) > 0) return false
        val planId = str(p.opt("planId")).orEmpty(); val anchor = str(p.opt("anchor")).orEmpty()
        if (planId == NT_DEEP_REPEAT_PLAN_ID && anchor == "from-today") {
            val pace = num(p.opt("ntDeepRepeatPace"))
            return pace == null || pace == NT_DEFAULT_PACE
        }
        if (planId != DEFAULT_PLAN_ID) return false
        if (anchor != DEFAULT_ANCHOR) return false
        if (!isNull(p.opt("ntDeepRepeatPace"))) return false
        if (anchor == "calendar-easter") {
            val started = str(p.opt("startedOn"))?.trim().orEmpty()
            if (started.isNotEmpty() && started != EASTER_EPOCH) return false
        }
        return true
    }

    fun shouldSyncReadingPlanPrefs(prefs: JSONObject?): Boolean {
        val p = prefs ?: return false
        if (num(p.opt("version")) != 1.0) return false
        if (str(p.opt("planId"))?.trim().isNullOrEmpty()) return false
        if (bool(p.opt("chosen")) == true) return true
        return !isUnchosenProductDefault(p)
    }

    private fun selectedAtMs(p: JSONObject): Double {
        val raw = str(p.opt("selectedAt"))?.trim().orEmpty()
        return if (raw.isEmpty()) 0.0 else jsDateParseMs(raw) ?: 0.0
    }

    private fun prefsWithAhead(prefs: JSONObject, other: JSONObject?): JSONObject {
        val samePlan = other != null && num(other.opt("version")) == 1.0 && str(other.opt("planId")) == str(prefs.opt("planId"))
        val ahead = if (samePlan && other != null) maxOf(readAheadDays(prefs), readAheadDays(other)) else readAheadDays(prefs)
        val out = prefs.copy()
        if (ahead > 0) out.put("aheadDays", ahead) else out.remove("aheadDays")
        return out
    }

    private fun earlierFromTodayStartedOn(left: JSONObject, right: JSONObject, planId: String?): String? {
        val candidates = ArrayList<Pair<String, Double>>()
        for (p in listOf(left, right)) {
            if (str(p.opt("anchor")) != "from-today" || str(p.opt("planId")) != planId) continue
            val s = str(p.opt("startedOn"))?.trim().orEmpty()
            if (s.isEmpty()) continue
            val ms = jsDateParseMs(s) ?: continue
            candidates.add(s to ms)
        }
        return candidates.minByOrNull { it.second }?.first
    }

    fun mergeReadingPlanPrefsValue(a: Any?, b: Any?): Any? {
        val left = dict(a) ?: return b
        val right = dict(b) ?: return a
        if (isUnchosenProductDefault(right) && str(left.opt("planId")) != str(right.opt("planId")) && num(left.opt("version")) == 1.0) {
            return prefsWithAhead(left, right)
        }
        val leftChosen = bool(left.opt("chosen")) == true; val rightChosen = bool(right.opt("chosen")) == true
        if (leftChosen != rightChosen) {
            return prefsWithAhead(if (leftChosen) left else right, if (leftChosen) right else left)
        }
        val lms = selectedAtMs(left); val rms = selectedAtMs(right)
        if (str(left.opt("planId")) != str(right.opt("planId"))) {
            if (lms != rms) return prefsWithAhead(if (lms > rms) left else right, null)
            return prefsWithAhead(left, right)
        }
        val newerIsRight = num(right.opt("version")) == 1.0 || num(left.opt("version")) != 1.0
        val merged = prefsWithAhead(if (newerIsRight) right else left, if (newerIsRight) left else right)
        if (str(merged.opt("anchor")) == "from-today" && str(left.opt("planId")) == str(right.opt("planId"))) {
            earlierFromTodayStartedOn(left, right, str(merged.opt("planId")))?.let { merged.put("startedOn", it) }
        }
        return merged
    }

    // ---- 归属判定 ----

    enum class SyncPath(val raw: String) { REPLACE("replace"), PULL_ONLY_REINSTALL("pull-only-reinstall"), PULL_ONLY_EMPTY("pull-only-empty"), GUEST_PUSH("guest-push"), CONTINUE("continue") }

    fun shouldForcePush(reason: String?): Boolean =
        reason == "sign-out" || reason == "manual-debug" || reason == "local-change" || reason == "readingPlanPrefs"

    fun decidePath(boundUserId: String?, requirePullOnly: Boolean, userId: String, remoteHasProgress: Boolean, localHasProgress: Boolean, forcePush: Boolean): SyncPath {
        if (boundUserId != null && boundUserId != userId) return SyncPath.REPLACE
        if (forcePush && localHasProgress) return SyncPath.CONTINUE
        if (requirePullOnly) return SyncPath.REPLACE
        if (boundUserId == null) {
            if (remoteHasProgress) return SyncPath.PULL_ONLY_REINSTALL
            if (!localHasProgress) return SyncPath.PULL_ONLY_EMPTY
            return SyncPath.GUEST_PUSH
        }
        if (!localHasProgress) return SyncPath.PULL_ONLY_EMPTY
        return SyncPath.CONTINUE
    }

    private fun blobValue(blobs: JSONObject?, key: String): Any? = dict(blobs?.opt(key))?.opt("value")

    fun blobsHaveProgress(blobs: JSONObject?): Boolean {
        blobs ?: return false
        dict(blobValue(blobs, "bookmarks"))?.let { if (it.length() > 0) return true }
        dict(blobValue(blobs, "highlights"))?.let { if (it.length() > 0) return true }
        if (blobValue(blobs, "lastPosition").let { it is JSONObject || it is JSONArray }) return true
        (dict(blobValue(blobs, "chapterCompletion"))?.opt("completed") as? JSONArray)?.let { if (it.length() > 0) return true }
        (dict(blobValue(blobs, "todayReadingDone"))?.opt("doneKeys") as? JSONArray)?.let { if (it.length() > 0) return true }
        dict(dict(blobValue(blobs, "todayReadingFraction"))?.opt("fractions"))?.let { if (it.length() > 0) return true }
        (dict(blobValue(blobs, "habitStats"))?.opt("completedDates") as? JSONArray)?.let { if (it.length() > 0) return true }
        num(dict(blobValue(blobs, "scriptureListenTotals"))?.opt("totalSec"))?.let { if (!it.isNaN() && !it.isInfinite() && it > 0) return true }
        if (!isNull(blobValue(blobs, "tripleLoopProgress"))) return true
        if (!isNull(blobValue(blobs, "ntDeepRepeatProgress"))) return true
        return bool(dict(blobValue(blobs, "readingPlanPrefs"))?.opt("chosen")) == true
    }

    // ---- appLocale 侧车 ----

    fun localeValueWithReadingPlan(locale: Any?, plan: Any?): JSONObject {
        val base = dict(locale)?.copy() ?: JSONObject().put("version", 1).put("locale", "zh-CN")
        if (plan != null) base.put("readingPlanPrefs", plan) else base.remove("readingPlanPrefs")
        return base
    }
    fun readingPlanFromAppLocale(value: Any?): Any? {
        val p = dict(value)?.opt("readingPlanPrefs") ?: return null
        return if (p === JSONObject.NULL) null else p
    }
    private fun planIdFromValue(v: Any?): String? = str(dict(v)?.opt("planId"))?.trim()?.ifEmpty { null }
    fun planIdFromBlobs(blobs: JSONObject?): String? =
        planIdFromValue(blobValue(blobs, "readingPlanPrefs")) ?: planIdFromValue(readingPlanFromAppLocale(blobValue(blobs, "appLocale")))

    // ---- 习惯统计 / 全年轴 / 文案 ----

    fun civilFromDays(z0: Int): Triple<Int, Int, Int> {
        val z = z0 + 719468
        val era = (if (z >= 0) z else z - 146096) / 146097
        val doe = z - era * 146097
        val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        val y = yoe + era * 400
        val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        val mp = (5 * doy + 2) / 153
        val d = doy - (153 * mp + 2) / 5 + 1
        val m = if (mp < 10) mp + 3 else mp - 9
        return Triple(if (m <= 2) y + 1 else y, m, d)
    }

    fun shiftLocalDate(iso: String, delta: Int): String {
        val (y, m, d) = PlanDates.parseLocalDate(iso) ?: return iso
        val (cy, cm, cd) = civilFromDays(PlanDates.daysFromCivil(y, m, d) + delta)
        return String.format("%04d-%02d-%02d", cy, cm, cd)
    }

    fun computeReadingStreak(completedDates: Collection<String>, today: String): Int {
        val set = completedDates.toSet()
        if (set.isEmpty()) return 0
        var cursor = if (today in set) today else shiftLocalDate(today, -1)
        var streak = 0
        while (cursor in set) { streak += 1; cursor = shiftLocalDate(cursor, -1) }
        return streak
    }

    private val DATE_RE = Regex("^\\d{4}-\\d{2}-\\d{2}$")
    fun normalizeDates(raw: Collection<String>): List<String> = jsSorted(raw.filter { DATE_RE.matches(it) }.toSet())

    data class YearTimeline(val dayOfYear: Int, val daysInYear: Int, val progress: Double)

    fun yearTimeline(year: Int, month: Int, day: Int): YearTimeline {
        val jan1 = PlanDates.daysFromCivil(year, 1, 1)
        val dayOfYear = PlanDates.daysFromCivil(year, month, day) - jan1 + 1
        val daysInYear = PlanDates.daysFromCivil(year + 1, 1, 1) - jan1
        val progress = if (daysInYear <= 1) 0.0 else minOf(1.0, maxOf(0.0, (dayOfYear - 1).toDouble() / (daysInYear - 1)))
        return YearTimeline(dayOfYear, daysInYear, progress)
    }
    fun yearTimeline(now: LocalDate = LocalDate.now()): YearTimeline = yearTimeline(now.year, now.monthValue, now.dayOfMonth)

    fun yearReadRanges(completedDates: Collection<String>, year: Int, month: Int, day: Int): List<Pair<Int, Int>> {
        val tl = yearTimeline(year, month, day)
        val jan1 = PlanDates.daysFromCivil(year, 1, 1)
        val days = ArrayList<Int>()
        for (iso in completedDates) {
            val (y, m, d) = PlanDates.parseLocalDate(iso) ?: continue
            if (y != year) continue
            val dd = PlanDates.daysFromCivil(y, m, d) - jan1 + 1
            if (dd < 1 || dd >= tl.dayOfYear || dd > tl.daysInYear) continue
            days.add(dd)
        }
        if (days.isEmpty()) return emptyList()
        days.sort()
        val ranges = ArrayList<Pair<Int, Int>>()
        var start = days[0]; var end = start
        for (d in days.drop(1)) {
            if (d == end || d == end + 1) { end = d; continue }
            ranges.add(start to end); start = d; end = d
        }
        ranges.add(start to end)
        return ranges
    }

    fun rangeToTrackFraction(start: Int, end: Int, daysInYear: Int): Pair<Double, Double> {
        if (daysInYear <= 0) return 0.0 to 0.0
        val s = maxOf(1, start); val e = minOf(daysInYear, maxOf(s, end))
        return (s - 1).toDouble() / daysInYear to (e - s + 1).toDouble() / daysInYear
    }

    fun formatListenDuration(totalSec: Int, en: Boolean): String {
        val sec = maxOf(0, totalSec); val hours = sec / 3600; val minutes = (sec % 3600) / 60
        if (en) {
            if (hours <= 0) return "$minutes min"
            if (minutes <= 0) return "$hours hr"
            return "$hours hr $minutes min"
        }
        if (hours <= 0) return "$minutes 分钟"
        if (minutes <= 0) return "$hours 小时"
        return "$hours 小时 $minutes 分钟"
    }

    fun formatUsageDuration(totalSec: Int, en: Boolean): String {
        val sec = maxOf(0, totalSec); val hours = sec / 3600; val minutes = (sec % 3600) / 60; val seconds = sec % 60
        if (en) {
            if (hours <= 0 && minutes <= 0) return "$seconds sec"
            if (hours <= 0) return if (minutes > 0 && seconds == 0) "$minutes min" else "$minutes min $seconds sec"
            if (minutes <= 0) return "$hours hr"
            return "$hours hr $minutes min"
        }
        if (hours <= 0 && minutes <= 0) return "$seconds 秒"
        if (hours <= 0) return if (seconds == 0) "$minutes 分钟" else "$minutes 分 $seconds 秒"
        if (minutes <= 0) return "$hours 小时"
        return "$hours 小时 $minutes 分钟"
    }

    // ---- 本机 meta ----

    data class Meta(
        val revision: String? = null,
        val lastSyncedAt: String? = null,
        val boundUserId: String? = null,
        val requirePullOnly: Boolean = false,
        val lastError: String? = null,
    ) {
        fun serialize(): String = JSONObject()
            .put("boundUserId", boundUserId ?: JSONObject.NULL)
            .put("lastError", lastError ?: JSONObject.NULL)
            .put("lastSyncedAt", lastSyncedAt ?: JSONObject.NULL)
            .put("requirePullOnly", requirePullOnly)
            .put("revision", revision ?: JSONObject.NULL)
            .toString()

        companion object {
            fun parse(raw: String?): Meta {
                if (raw.isNullOrBlank()) return Meta()
                val o = try { JSONObject(raw) } catch (_: Exception) { return Meta() }
                val bound = if (o.isNull("boundUserId")) null else o.optString("boundUserId").trim().ifEmpty { null }
                val err = if (o.isNull("lastError")) null else o.optString("lastError").trim().ifEmpty { null }
                val synced = if (o.isNull("lastSyncedAt")) null else o.optString("lastSyncedAt").ifEmpty { null }
                val rev = if (o.isNull("revision")) null else o.optString("revision").ifEmpty { null }
                return Meta(rev, synced, bound, o.optBoolean("requirePullOnly", false), err)
            }
        }
    }
}

/** 计划状态 ↔ JSON（本机存储与读经同步 blob 共用） */
object PlanStateJson {
    fun parsePrefs(o: JSONObject?): ReadingPlanPrefs? {
        o ?: return null
        return try {
            ReadingPlanPrefs.fromFields(
                version = if (o.has("version")) o.optInt("version", 0) else null, planId = o.optString("planId", null), anchorRaw = o.optString("anchor", null),
                startedOn = if (o.has("startedOn")) o.optString("startedOn") else null, dayCount = if (o.has("dayCount")) o.optInt("dayCount") else null,
                aheadDays = if (o.has("aheadDays")) o.optInt("aheadDays") else null, pace = if (o.has("ntDeepRepeatPace")) o.optInt("ntDeepRepeatPace") else null,
                chosen = if (o.has("chosen")) o.optBoolean("chosen") else null, selectedAt = if (o.has("selectedAt")) o.optString("selectedAt") else null,
            )
        } catch (_: Exception) { null }
    }
    fun prefsJson(p: ReadingPlanPrefs): JSONObject = JSONObject().apply {
        put("version", 1); put("planId", p.planId); put("anchor", p.anchor.raw)
        p.startedOn?.let { put("startedOn", it) }; p.dayCount?.let { put("dayCount", it) }; p.aheadDays?.let { put("aheadDays", it) }
        p.ntDeepRepeatPace?.let { put("ntDeepRepeatPace", it) }; p.chosen?.let { put("chosen", it) }; p.selectedAt?.let { put("selectedAt", it) }
    }
    fun keysJson(keys: Map<String, List<String>>) = JSONObject().apply { for ((k, v) in keys) put(k, JSONArray(v)) }
    fun keysFrom(o: JSONObject?, tracks: List<String>): Map<String, List<String>> =
        tracks.associateWith { t -> o?.optJSONArray(t)?.let { a -> (0 until a.length()).mapNotNull { a.opt(it) as? String } } ?: emptyList() }
    fun pointerJson(p: PlanPointer) = JSONObject().put("bookId", p.bookId).put("chapter", p.chapter)
    fun pointerFrom(o: JSONObject?) = PlanPointer(o?.optString("bookId", "") ?: "", o?.optInt("chapter", 0) ?: 0)
    fun tripleJson(s: TripleLoopState) = JSONObject().apply {
        put("ot", pointerJson(s.ot)); put("nt", pointerJson(s.nt)); put("wisdom", pointerJson(s.wisdom))
        put("chaptersReadKeys", keysJson(s.chaptersReadKeys)); put("chaptersRead", JSONObject(s.chaptersRead)); s.startedAt?.let { put("startedAt", it) }
    }
    fun tripleFrom(o: JSONObject?): TripleLoopState? {
        o ?: return null
        return TripleLoopState(pointerFrom(o.optJSONObject("ot")), pointerFrom(o.optJSONObject("nt")), pointerFrom(o.optJSONObject("wisdom")),
            keysFrom(o.optJSONObject("chaptersReadKeys"), listOf("ot", "nt", "wisdom")), startedAt = if (o.has("startedAt")) o.optString("startedAt") else null)
    }
    fun ntJson(s: NtDeepRepeatState) = JSONObject().apply {
        put("ot", pointerJson(s.ot)); put("curriculumIndex", s.curriculumIndex); put("dayInSegment", s.dayInSegment); put("pace", s.pace)
        put("segmentDayTarget", s.segmentDayTarget); put("chaptersReadKeys", keysJson(s.chaptersReadKeys)); put("chaptersRead", JSONObject(s.chaptersRead)); s.startedAt?.let { put("startedAt", it) }
    }
    fun ntFrom(o: JSONObject?): NtDeepRepeatState? {
        o ?: return null
        return NtDeepRepeatState(pointerFrom(o.optJSONObject("ot")), o.optInt("curriculumIndex", 0), o.optInt("dayInSegment", 1), o.optInt("pace", 0),
            o.optInt("segmentDayTarget", 0), keysFrom(o.optJSONObject("chaptersReadKeys"), listOf("ot", "nt")), startedAt = if (o.has("startedAt")) o.optString("startedAt") else null)
    }
}
