package me.askbible.native_.data

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * 会员读经进度同步的纯规则（check:member-sync 对拍）——照抄 RN src/member-sync：
 * schema（23 个 blob 键）、mergeReadingBlobs（逐键三方合并）、memberReadingSyncOwnerPolicy（归属判定）、
 * readingPlanSyncSidecar（appLocale 侧车带计划）、reading-plan-prefs-merge（计划偏好合并）、
 * merge-triple-loop / merge-nt-deep-repeat（指针取最远 + 已读章并集）、reading-habit-stats（连读）、
 * year-day-timeline（全年轴）、app-usage-time / scripture-listen-totals 的文案。
 * blob 的 value 是任意 JSON：这里用 org.json（JSONObject / JSONArray / String / Number / Boolean / JSONObject.NULL）。
 * 与 iOS Model/MemberReadingSync.swift 同构。
 */
object MemberReadingSyncRules {
    const val SCHEMA_VERSION = 1
    const val TABLE = "member_reading_sync_documents"
    const val META_KEY = "askbible.member-reading-sync-meta.v1"
    val BLOB_KEYS: List<String> = listOf(
        "bookmarks", "highlights", "lastPosition", "chapterCompletion", "tripleLoopProgress", "ntDeepRepeatProgress",
        "readingPlanPrefs", "todayReadingDone", "todayReadingFraction", "habitStats", "scriptureListenTotals",
        "readTypography", "readTranslation", "recentSearches", "homeNatureUi", "homePrayerVerse", "homeVersePoolScope",
        "natureSceneUi", "musicVisualTheme", "scripturePlaybackRate", "cuvAudioVoice", "exploreYearDayProfile", "appLocale",
    )
    const val MIN_SYNC_INTERVAL_MS = 30_000L
    const val LOCAL_CHANGE_DEBOUNCE_MS = 1_500L
    const val POLL_INTERVAL_MS = 45_000L
    const val READING_HABIT_MIN_FRACTION = 0.2
    const val TODAY_READING_AUTO_DONE_FRACTION = 0.88

    // ---- JSON 小工具 ----

    fun dict(v: Any?): JSONObject? = v as? JSONObject
    fun str(v: Any?): String? = v as? String
    /** JS typeof === "number"：布尔不算数 */
    fun num(v: Any?): Double? = (v as? Number)?.toDouble()
    fun bool(v: Any?): Boolean? = v as? Boolean
    fun isNull(v: Any?): Boolean = v == null || v === JSONObject.NULL
    fun stringArray(v: Any?): List<String> {
        val a = v as? JSONArray ?: return emptyList()
        return (0 until a.length()).mapNotNull { a.opt(it) as? String }
    }
    private fun JSONObject.copy(): JSONObject = JSONObject().also { o -> for (k in keys()) o.put(k, opt(k)) }

    /** JS Date.parse：完整 ISO（含时区 / 毫秒）或 YYYY-MM-DD（按 UTC 零点）；解析失败 null */
    fun jsDateParseMs(raw: String?): Double? {
        val s = raw?.trim().orEmpty()
        if (s.isEmpty()) return null
        try { return OffsetDateTime.parse(s).toInstant().toEpochMilli().toDouble() } catch (_: Exception) {}
        val (y, m, d) = PlanDates.parseLocalDate(s) ?: return null
        return PlanDates.daysFromCivil(y, m, d).toDouble() * 86_400_000
    }

    /** RN parseIsoMs：解析失败算 0 */
    fun parseIsoMs(iso: String?): Double = jsDateParseMs(iso) ?: 0.0

    /** JS Date.toISOString：UTC、带毫秒 */
    fun isoString(ms: Double): String = MemberAuthRules.ISO_MILLIS.format(java.time.Instant.ofEpochMilli(ms.toLong()))

    /** JS 默认 sort：按 UTF-16 code unit（Kotlin String.compareTo 就是） */
    fun jsSorted(list: Collection<String>): List<String> = list.sorted()

    private fun jsonNumber(d: Double): Any = if (d == Math.floor(d) && !d.isInfinite() && Math.abs(d) < 1e15) d.toLong() else d

    // ---- 逐键合并（RN mergeReadingBlobs.ts） ----

    fun mergeBookmarks(a: Any?, b: Any?): Any? {
        val da = dict(a) ?: return b
        val db = dict(b) ?: return a
        val out = da.copy()
        for (key in db.keys()) {
            val item = db.opt(key)
            val nextSaved = num(dict(item)?.opt("savedAt"))
            val prevSaved = num(dict(out.opt(key))?.opt("savedAt"))
            if (!out.has(key) || (nextSaved != null && nextSaved >= (prevSaved ?: 0.0))) out.put(key, item)
        }
        return out
    }

    fun mergeHighlightStore(a: Any?, b: Any?): Any? {
        val da = dict(a) ?: return b
        val db = dict(b) ?: return a
        val out = da.copy()
        for (key in db.keys()) {
            val rows = db.opt(key) as? JSONArray ?: continue
            val byIndex = java.util.TreeMap<Int, String>()
            fun put(row: Any?) {
                val r = dict(row) ?: return
                val iRaw = num(r.opt("i")) ?: return
                if (iRaw != Math.floor(iRaw) || iRaw < 0) return
                byIndex[iRaw.toInt()] = r.opt("c") as? String ?: ""
            }
            (out.opt(key) as? JSONArray)?.let { arr -> for (i in 0 until arr.length()) put(arr.opt(i)) }
            for (i in 0 until rows.length()) put(rows.opt(i))
            if (byIndex.isEmpty()) out.remove(key)
            else out.put(key, JSONArray().also { arr -> for ((i, c) in byIndex) arr.put(JSONObject().put("i", i).put("c", c)) })
        }
        return out
    }

    /** chapterCompletion.completed / todayReadingDone.doneKeys / habitStats.completedDates：并集排序，scopeKey 取右边 */
    fun mergeStringSetRecords(a: Any?, b: Any?, field: String): Any? {
        fun read(v: Any?) = stringArray(dict(v)?.opt(field))
        fun scopeKey(v: Any?) = str(dict(v)?.opt("scopeKey"))
        val merged = jsSorted((read(a) + read(b)).toSet())
        val out = (dict(a) ?: dict(b))?.copy() ?: JSONObject()
        out.put("version", 1)
        out.put(field, JSONArray(merged))
        val sa = scopeKey(a); val sb = scopeKey(b)
        when {
            sa != null && sb != null && sa == sb -> out.put("scopeKey", sa)
            sb != null -> out.put("scopeKey", sb)
            sa != null -> out.put("scopeKey", sa)
        }
        return out
    }

    fun mergeFractions(a: Any?, b: Any?): Any? {
        val da = dict(a) ?: return b
        val db = dict(b) ?: return a
        val scopeA = str(da.opt("scopeKey")); val scopeB = str(db.opt("scopeKey"))
        if (!scopeA.isNullOrEmpty() && !scopeB.isNullOrEmpty() && scopeA != scopeB && !isSameTodayReadingPlanScope(scopeA, scopeB)) {
            return if (parseIsoMs(str(db.opt("updatedAt"))) >= parseIsoMs(str(da.opt("updatedAt")))) b else a
        }
        val merged = JSONObject()
        dict(da.opt("fractions"))?.let { fa -> for (k in fa.keys()) merged.put(k, fa.opt(k)) }
        dict(db.opt("fractions"))?.let { fb ->
            for (k in fb.keys()) {
                val v = num(fb.opt(k)) ?: continue
                merged.put(k, jsonNumber(maxOf(num(merged.opt(k)) ?: 0.0, v)))
            }
        }
        // JS `scopeB || scopeA`：空串算假；两边都没有就不写这个键
        val scope = if (!scopeB.isNullOrEmpty()) scopeB else scopeA
        val out = JSONObject().put("version", 1).put("fractions", merged)
        if (scope != null) out.put("scopeKey", scope)
        return out
    }

    fun mergeRecentSearches(a: Any?, b: Any?): Any? {
        fun read(v: Any?) = stringArray(dict(v)?.opt("terms"))
        val seen = HashSet<String>(); val merged = ArrayList<String>()
        for (term in read(b) + read(a)) {
            val trimmed = term.trim().replace(Regex("\\s+"), " ")
            if (trimmed.isEmpty()) continue
            val key = trimmed.lowercase()
            if (!seen.add(key)) continue
            merged.add(trimmed)
            if (merged.size >= 8) break
        }
        return JSONObject().put("version", 1).put("terms", JSONArray(merged))
    }

    /** RN planIdFromTodayReadingScopeKey：`planId:epoch:N` / `planId:day:N` / `planId` 取冒号前 */
    fun planIdFromScopeKey(scopeKey: String?): String? {
        val s = scopeKey?.trim().orEmpty()
        if (s.isEmpty()) return null
        return s.split(":")[0].trim().ifEmpty { null }
    }

    fun isSameTodayReadingPlanScope(a: String?, b: String?): Boolean {
        if (a.isNullOrEmpty() || b.isNullOrEmpty()) return false
        if (a == b) return true
        val pa = planIdFromScopeKey(a); val pb = planIdFromScopeKey(b)
        return pa != null && pb != null && pa == pb
    }

    fun mergeTodayReadingDone(a: Any?, b: Any?): Any? {
        val scopeA = str(dict(a)?.opt("scopeKey")); val scopeB = str(dict(b)?.opt("scopeKey"))
        if (!scopeA.isNullOrEmpty() && !scopeB.isNullOrEmpty() && scopeA == scopeB) return mergeStringSetRecords(a, b, "doneKeys")
        fun keys(v: Any?) = stringArray(dict(v)?.opt("doneKeys")).filter { it.isNotEmpty() }
        val planA = planIdFromScopeKey(scopeA); val planB = planIdFromScopeKey(scopeB)
        if (planA != null && planB != null && planA == planB) {
            return JSONObject().put("version", 1).put("scopeKey", scopeB ?: scopeA ?: "")
                .put("doneKeys", JSONArray(jsSorted((keys(a) + keys(b)).toSet())))
        }
        val ka = keys(a); val kb = keys(b)
        if (kb.size > ka.size) return b
        if (ka.size > kb.size) return a
        return b
    }

    /** RN parseScriptureListenTotalsRecord：version 1、totalSec 有限且 ≥ 0 → 取整 */
    fun parseListenTotals(v: Any?): JSONObject? {
        val d = dict(v) ?: return null
        if (num(d.opt("version")) != 1.0) return null
        val n = num(d.opt("totalSec")) ?: return null
        if (n.isNaN() || n.isInfinite() || n < 0) return null
        return JSONObject().put("version", 1).put("totalSec", Math.floor(n).toLong())
    }

    fun mergeListenTotals(a: Any?, b: Any?): Any? {
        val left = parseListenTotals(a); val right = parseListenTotals(b)
        if (left == null) return right ?: b
        if (right == null) return left
        return JSONObject().put("version", 1).put("totalSec", maxOf(left.optLong("totalSec"), right.optLong("totalSec")))
    }

    // ---- 读经计划偏好合并（lib/read/reading-plan-prefs-merge.ts） ----

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
        val planId = str(p.opt("planId")) ?: ""; val anchor = str(p.opt("anchor")) ?: ""
        if (planId == NT_DEEP_REPEAT_PLAN_ID && anchor == "from-today") {
            val pace = num(p.opt("ntDeepRepeatPace"))
            return pace == null || pace == NT_DEFAULT_PACE
        }
        if (planId != DEFAULT_PLAN_ID) return false
        if (anchor != DEFAULT_ANCHOR) return false
        if (!isNull(p.opt("ntDeepRepeatPace"))) return false
        if (anchor == "calendar-easter") {
            val started = str(p.opt("startedOn"))?.trim() ?: ""
            if (started.isNotEmpty() && started != EASTER_EPOCH) return false
        }
        return true
    }

    /** RN shouldSyncReadingPlanPrefs：用户选过的才上传；产品隐式默认不上传 */
    fun shouldSyncReadingPlanPrefs(prefs: JSONObject?): Boolean {
        val p = prefs ?: return false
        if (num(p.opt("version")) != 1.0) return false
        val id = str(p.opt("planId"))?.trim().orEmpty()
        if (id.isEmpty()) return false
        if (bool(p.opt("chosen")) == true) return true
        return !isUnchosenProductDefault(p)
    }

    private fun selectedAtMs(p: JSONObject): Double {
        val raw = str(p.opt("selectedAt"))?.trim().orEmpty()
        if (raw.isEmpty()) return 0.0
        return jsDateParseMs(raw) ?: 0.0
    }

    private fun prefsWithAhead(prefs: JSONObject, other: JSONObject?): JSONObject {
        val samePlan = other != null && num(other.opt("version")) == 1.0 && str(other.opt("planId")) == str(prefs.opt("planId"))
        val ahead = if (samePlan) maxOf(readAheadDays(prefs), readAheadDays(other!!)) else readAheadDays(prefs)
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
        if (leftChosen != rightChosen) return prefsWithAhead(if (leftChosen) left else right, if (leftChosen) right else left)
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

    // ---- 三循环 / 深读进度合并（merge-triple-loop / merge-nt-deep-repeat） ----

    private fun pointerProgress(p: PlanPointer, order: List<String>): Int = maxOf(0, order.indexOf(p.bookId)) * 10_000 + p.chapter
    private fun mergePointer(a: PlanPointer, b: PlanPointer, order: List<String>): PlanPointer =
        if (pointerProgress(a, order) >= pointerProgress(b, order)) a else b
    private fun earlierStarted(a: String?, b: String?): String? = if (a != null && b != null) (if (a <= b) a else b) else a ?: b

    /** RN mergeTripleLoopReadingState：各轨取读得最远的位置，已读章取并集 */
    fun mergeTripleLoopState(a: Any?, b: Any?): Any? {
        val left = TripleLoop.normalize(PlanStateJson.tripleFrom(dict(a))); val right = TripleLoop.normalize(PlanStateJson.tripleFrom(dict(b)))
        val keys = listOf("ot", "nt", "wisdom").associateWith { t -> jsSorted(((left.chaptersReadKeys[t] ?: emptyList()) + (right.chaptersReadKeys[t] ?: emptyList())).toSet()) }
        val s = TripleLoopState(
            ot = mergePointer(left.ot, right.ot, TripleLoop.OT_ORDER), nt = mergePointer(left.nt, right.nt, TripleLoop.NT_ORDER),
            wisdom = mergePointer(left.wisdom, right.wisdom, TripleLoop.WISDOM_ORDER), chaptersReadKeys = keys,
            startedAt = earlierStarted(left.startedAt, right.startedAt),
        )
        return PlanStateJson.tripleJson(TripleLoop.normalize(s))
    }

    /** RN mergeNtDeepRepeatReadingState：取读得最远的一阶 / 段内天，已读章取并集 */
    fun mergeNtDeepRepeatState(a: Any?, b: Any?, now: LocalDate = LocalDate.now()): Any? {
        val left = NtDeepRepeat.normalize(PlanStateJson.ntFrom(dict(a)), now); val right = NtDeepRepeat.normalize(PlanStateJson.ntFrom(dict(b)), now)
        val keys = listOf("ot", "nt").associateWith { t -> jsSorted(((left.chaptersReadKeys[t] ?: emptyList()) + (right.chaptersReadKeys[t] ?: emptyList())).toSet()) }
        fun progress(s: NtDeepRepeatState) = s.curriculumIndex * 1000 + s.dayInSegment
        val lead = if (progress(left) >= progress(right)) left else right
        val dayInSegment = if (left.curriculumIndex == right.curriculumIndex) maxOf(left.dayInSegment, right.dayInSegment) else lead.dayInSegment
        val s = NtDeepRepeatState(
            ot = mergePointer(left.ot, right.ot, NtDeepRepeat.OT_ORDER), curriculumIndex = lead.curriculumIndex, dayInSegment = dayInSegment,
            pace = lead.pace, segmentDayTarget = 0, chaptersReadKeys = keys, startedAt = earlierStarted(left.startedAt, right.startedAt),
        )
        return PlanStateJson.ntJson(NtDeepRepeat.normalize(s, now))
    }

    // ---- 一条 blob 的合并 + 整份推送合并 ----

    fun mergeBlobValue(key: String, a: Any?, b: Any?, now: LocalDate): Any? = when (key) {
        "bookmarks" -> mergeBookmarks(a, b)
        "highlights" -> mergeHighlightStore(a, b)
        "chapterCompletion" -> mergeStringSetRecords(a, b, "completed")
        "todayReadingDone" -> mergeTodayReadingDone(a, b)
        "habitStats" -> mergeStringSetRecords(a, b, "completedDates")
        "scriptureListenTotals" -> mergeListenTotals(a, b)
        "todayReadingFraction" -> mergeFractions(a, b)
        "recentSearches" -> mergeRecentSearches(a, b)
        "readingPlanPrefs" -> mergeReadingPlanPrefsValue(a, b)
        "tripleLoopProgress" -> mergeTripleLoopState(a, b)
        "ntDeepRepeatProgress" -> mergeNtDeepRepeatState(a, b, now)
        else -> b
    }

    /** RN mergeBlobPair：时间戳新的一侧为准（相等取右），updatedAt 取大 */
    fun mergeBlobPair(key: String, left: JSONObject?, right: JSONObject?, now: LocalDate): JSONObject? {
        if (left == null) return right
        if (right == null) return left
        val lms = parseIsoMs(str(left.opt("updatedAt"))); val rms = parseIsoMs(str(right.opt("updatedAt")))
        val newer = if (rms >= lms) right else left
        val older = if (rms >= lms) left else right
        val out = JSONObject().put("updatedAt", isoString(maxOf(lms, rms)))
        val v = mergeBlobValue(key, older.opt("value"), newer.opt("value"), now)
        out.put("value", v ?: JSONObject.NULL)
        return out
    }

    /** RN mergeMemberReadingSyncPush：只认 23 个键、updatedAt 非空字符串的 blob */
    fun mergePush(base: JSONObject?, incoming: JSONObject?, now: LocalDate = LocalDate.now()): JSONObject {
        val blobs = base?.copy() ?: JSONObject()
        if (incoming != null) for (rawKey in incoming.keys()) {
            if (rawKey !in BLOB_KEYS) continue
            val b = dict(incoming.opt(rawKey)) ?: continue
            val u = str(b.opt("updatedAt")) ?: continue
            if (u.trim().isEmpty()) continue
            blobs.put(rawKey, mergeBlobPair(rawKey, dict(blobs.opt(rawKey)), b, now) ?: JSONObject.NULL)
        }
        return blobs
    }

    /** RN mergeMemberReadingSyncDocuments 的 revision：`${now}-${8 位随机 36 进制}` */
    fun newRevision(nowMs: Long = System.currentTimeMillis(), random: String = randomBase36(8)): String = "$nowMs-$random"
    fun randomBase36(n: Int): String {
        val chars = "0123456789abcdefghijklmnopqrstuvwxyz"
        val r = java.security.SecureRandom()
        return buildString(n) { repeat(n) { append(chars[r.nextInt(chars.length)]) } }
    }

    // ---- 归属判定（memberReadingSyncOwnerPolicy.ts） ----

    enum class SyncPath(val raw: String) { REPLACE("replace"), PULL_ONLY_REINSTALL("pull-only-reinstall"), PULL_ONLY_EMPTY("pull-only-empty"), GUEST_PUSH("guest-push"), CONTINUE("continue") }

    /** 退出 / 手动同步 / 本地改计划：本机已有进度时必须上传 */
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

    /** 云端是否已有会覆盖「空默认本机」的读经进度（设置类 last-wins 不算） */
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

    // ---- appLocale 侧车（readingPlanSyncSidecar.ts） ----

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
    /** 以正式 readingPlanPrefs 为准；侧车只作旧数据回退 */
    fun planIdFromBlobs(blobs: JSONObject?): String? =
        planIdFromValue(blobValue(blobs, "readingPlanPrefs")) ?: planIdFromValue(readingPlanFromAppLocale(blobValue(blobs, "appLocale")))

    // ---- 习惯统计 / 全年轴（reading-habit-stats.ts / year-day-timeline.ts） ----

    /** Howard Hinnant civil_from_days（与 PlanDates.daysFromCivil 互逆） */
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

    /** 连读：从最近完成日往前数连续天数（今日未完成则从昨日算起） */
    fun computeReadingStreak(completedDates: Collection<String>, today: String): Int {
        val set = completedDates.toSet()
        if (set.isEmpty()) return 0
        var cursor = if (today in set) today else shiftLocalDate(today, -1)
        var streak = 0
        while (cursor in set) { streak += 1; cursor = shiftLocalDate(cursor, -1) }
        return streak
    }

    private val DATE_RE = Regex("^\\d{4}-\\d{2}-\\d{2}$")
    /** RN parseRecord：只留 YYYY-MM-DD，去重排序 */
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

    /** 全年轴上今天之前的已读区段（连续日合并），单位「第几天」 */
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

    // ---- 文案（app-usage-time.ts / scripture-listen-totals.ts） ----

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

    // ---- 本机 meta（memberReadingSyncApi.readMemberReadingSyncMeta） ----

    data class Meta(val revision: String? = null, val lastSyncedAt: String? = null, val boundUserId: String? = null,
                    val requirePullOnly: Boolean = false, val lastError: String? = null) {
        fun serialize(): String = JSONObject().put("revision", revision ?: JSONObject.NULL).put("lastSyncedAt", lastSyncedAt ?: JSONObject.NULL)
            .put("boundUserId", boundUserId ?: JSONObject.NULL).put("requirePullOnly", requirePullOnly).put("lastError", lastError ?: JSONObject.NULL).toString()
        companion object {
            fun parse(raw: String?): Meta {
                val o = try { if (raw.isNullOrBlank()) null else JSONObject(raw) } catch (_: Exception) { null } ?: return Meta()
                val bound = (o.opt("boundUserId") as? String)?.trim()?.ifEmpty { null }
                val err = (o.opt("lastError") as? String)?.trim()?.ifEmpty { null }
                return Meta(o.opt("revision") as? String, o.opt("lastSyncedAt") as? String, bound, o.opt("requirePullOnly") == true, err)
            }
        }
    }

    // ---- 对拍用：键排序的规范 JSON（数值按 JS 习惯：整数不带 .0） ----

    fun canonicalJson(v: Any?): String = when (v) {
        null, JSONObject.NULL -> "null"
        is JSONObject -> v.keys().asSequence().sorted().joinToString(",", "{", "}") { k -> jsonString(k) + ":" + canonicalJson(v.opt(k)) }
        is JSONArray -> (0 until v.length()).joinToString(",", "[", "]") { canonicalJson(v.opt(it)) }
        is String -> jsonString(v)
        is Boolean -> v.toString()
        is Number -> { val d = v.toDouble(); if (d == Math.floor(d) && !d.isInfinite() && Math.abs(d) < 1e15) d.toLong().toString() else d.toString() }
        else -> jsonString(v.toString())
    }
    private fun jsonString(s: String): String = JSONObject.quote(s)
}

/** 计划状态 ↔ JSON（RN 存的就是这个形状；同步的 blob 也是）。原来在 app 的 ReadingPlanStore 里，同步合并要用所以搬进 core。 */
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
