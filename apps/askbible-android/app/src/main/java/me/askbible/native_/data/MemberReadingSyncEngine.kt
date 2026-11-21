package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import me.askbible.native_.data.AskBibleSyncClient.SyncFetch
import me.askbible.native_.data.MemberReadingSyncRules as R
import me.askbible.native_.home.ReadingPlanStore
import org.json.JSONArray
import org.json.JSONObject

/**
 * 会员读经进度与云端的同步驱动（DECISIONS D-44：去客户端重复合并器，统一走 `askbible-sync` Worker 单次往返权威合并）。
 * 与 iOS `MemberReadingSyncEngine.swift` 同构。
 */
class MemberReadingSyncEngine(context: Context) {
    enum class Outcome { OK, OFFLINE, SKIPPED, UNAUTHORIZED }

    private val sp = context.applicationContext.getSharedPreferences("member-reading-sync", Context.MODE_PRIVATE)
    private val scope = CoroutineScope(Dispatchers.Main)

    var lastError by mutableStateOf<String?>(null); private set
    var lastSyncedAt by mutableStateOf<String?>(null); private set

    private lateinit var auth: MemberAuthStore
    private lateinit var plans: ReadingPlanStore
    private lateinit var bookmarks: VerseBookmarkStore
    private lateinit var activity: ReadingActivityStore
    private lateinit var search: SearchPrefs
    var localeTag: () -> String = { "zh-CN" }

    private var inFlight: Deferred<Outcome>? = null
    private var pendingFlushReason: String? = null
    private var lastSyncStartedAt = 0L
    private var debounceJob: Job? = null
    private var pendingLocalReason: String? = null
    private var applyingRemote = false
    private var syncGeneration = 0L
    private data class Attempt(val userId: String, val accountRevision: Long, val generation: Long)
    private class StaleAttempt : CancellationException("Account changed during reading sync")

    private fun requireCurrent(attempt: Attempt) {
        if (auth.user?.id != attempt.userId || auth.accountRevision != attempt.accountRevision ||
            syncGeneration != attempt.generation) throw StaleAttempt()
    }

    private var highlights: VerseHighlightStore? = null
    private var achievements: AchievementStore? = null
    private var applyingUpdatedAtMs = 0L

    fun attach(auth: MemberAuthStore, plans: ReadingPlanStore, bookmarks: VerseBookmarkStore, activity: ReadingActivityStore,
               search: SearchPrefs, highlights: VerseHighlightStore? = null,
               achievements: AchievementStore? = null) {
        this.highlights = highlights
        this.achievements = achievements
        achievements?.onLocalChange = { k -> notifyLocalChanged(k) }
        highlights?.onLocalChange = { k -> notifyLocalChanged(k) }
        this.auth = auth; this.plans = plans; this.bookmarks = bookmarks; this.activity = activity; this.search = search
        plans.onLocalChange = { notifyLocalChanged(it) }
        bookmarks.onLocalChange = { notifyLocalChanged("bookmarks") }
        activity.onLocalChange = { notifyLocalChanged(it) }
        search.onLocalChange = { notifyLocalChanged("recentSearches") }
        val m = meta
        lastSyncedAt = m.lastSyncedAt; lastError = m.lastError
    }

    // ---- meta ----

    private var meta: R.Meta
        get() = R.Meta.parse(sp.getString(R.META_KEY, null))
        set(v) { sp.edit().putString(R.META_KEY, v.serialize()).apply(); lastSyncedAt = v.lastSyncedAt; lastError = v.lastError }
    private fun remember(error: String?) { meta = meta.copy(lastError = error) }

    // ---- 导出本机 ----

    private fun wrap(v: Any, now: String) = JSONObject().put("updatedAt", now).put("value", v)

    private val habitDates: List<String> get() = R.normalizeDates(activity.completedDates + plans.listenedDates)

    fun exportLocal(): JSONObject {
        val blobs = JSONObject()
        val now = R.isoString(System.currentTimeMillis().toDouble())
        val bm = bookmarks.json
        if (bm.length() > 0) blobs.put("bookmarks", wrap(bm, now))
        activity.lastPositionJson?.let { blobs.put("lastPosition", wrap(it, now)) }
        val completed = plans.completedSorted
        if (completed.isNotEmpty()) blobs.put("chapterCompletion", wrap(JSONObject().put("version", 1).put("completed", JSONArray(completed)), now))
        val prefs = plans.storedPrefsJson
        if (prefs != null && R.shouldSyncReadingPlanPrefs(prefs)) {
            blobs.put("readingPlanPrefs", wrap(prefs, now))
            blobs.put("appLocale", wrap(R.localeValueWithReadingPlan(JSONObject().put("version", 1).put("locale", localeTag()), prefs), now))
        }
        plans.tripleJsonOrNull?.let { blobs.put("tripleLoopProgress", wrap(it, now)) }
        plans.ntJsonOrNull?.let { blobs.put("ntDeepRepeatProgress", wrap(it, now)) }
        val habit = habitDates
        if (habit.isNotEmpty()) blobs.put("habitStats", wrap(JSONObject().put("version", 1).put("completedDates", JSONArray(habit)), now))
        if (activity.listenTotalSec > 0) blobs.put("scriptureListenTotals", wrap(activity.listenJson, now))
        if (search.recent.isNotEmpty()) blobs.put("recentSearches", wrap(JSONObject().put("version", 1).put("terms", JSONArray(search.recent)), now))
        if (activity.usageTotalSec > 0) blobs.put("appUsageTime", wrap(activity.usageJson(), now))
        if (activity.recent.isNotEmpty()) blobs.put("recentChapters", wrap(activity.recentJson(), now))
        highlights?.let { h ->
            val hl = h.json()
            if (hl.length() > 0) {
                val ts = if (h.localUpdatedAtMs > 0) R.isoString(h.localUpdatedAtMs.toDouble()) else now
                blobs.put("highlights", wrap(hl, ts))
            }
        }
        achievements?.let { a -> if (a.hasProgress) blobs.put("achievements", wrap(a.syncJson(), now)) }
        return blobs
    }

    fun localHasProgress(): Boolean {
        if (bookmarks.store.isNotEmpty() || bookmarks.tombstones.isNotEmpty()) return true
        if (highlights?.store?.isNotEmpty() == true || highlights?.verseTimestamps?.isNotEmpty() == true || highlights?.dirty == true) return true
        if (achievements?.hasProgress == true) return true
        if (activity.lastPosition != null) return true
        if (activity.listenTotalSec > 0) return true
        if (plans.completed.isNotEmpty()) return true
        if (habitDates.isNotEmpty()) return true
        if (R.shouldSyncReadingPlanPrefs(plans.storedPrefsJson)) return true
        return plans.hasUserTriple || plans.hasUserNt
    }

    // ---- 应用云端 ----

    private fun beginApplying() { applyingRemote = true; plans.suppressChangeNotify = true; activity.suppressChangeNotify = true; achievements?.suppressChangeNotify = true }
    private fun endApplying() { plans.suppressChangeNotify = false; activity.suppressChangeNotify = false; achievements?.suppressChangeNotify = false; applyingRemote = false }

    fun applyBlobs(blobs: JSONObject) {
        beginApplying()
        try {
            for (key in R.BLOB_KEYS) {
                val blob = R.dict(blobs.opt(key)) ?: continue
                if (!blob.has("value")) continue
                applyingUpdatedAtMs = R.parseIsoMs(R.str(blob.opt("updatedAt"))).toLong()
                apply(key, blob.opt("value"))
            }
            if (!blobs.has("readingPlanPrefs")) {
                val side = R.dict(R.readingPlanFromAppLocale(R.dict(blobs.opt("appLocale"))?.opt("value")))
                if (side != null && R.str(side.opt("planId")) != null) {
                    val local = plans.storedPrefsJson
                    val merged = if (local != null) R.mergeReadingPlanPrefsValue(side, local) else side
                    R.dict(merged)?.let { plans.applyRemotePrefs(it) }
                }
            }
        } finally { endApplying() }
    }

    private fun apply(key: String, value: Any?) {
        when (key) {
            "bookmarks" -> R.dict(value)?.let { bookmarks.replace(it) }
            "lastPosition" -> R.dict(value)?.let { d ->
                val b = R.str(d.opt("bookId")) ?: return
                val ch = R.num(d.opt("chapter")) ?: return
                if (b.isNotEmpty() && ch == Math.floor(ch) && ch >= 1) activity.applyRemoteLastPosition(b, ch.toInt(), R.str(d.opt("bookName")) ?: "")
            }
            "chapterCompletion" -> R.dict(value)?.let { d ->
                if (R.num(d.opt("version")) == 1.0 && d.opt("completed") is JSONArray) plans.applyRemoteCompleted(R.stringArray(d.opt("completed")))
            }
            "readingPlanPrefs" -> {
                if (value === JSONObject.NULL) plans.applyRemotePrefs(null)
                else R.dict(value)?.let { d ->
                    if (R.str(d.opt("planId")) != null) {
                        val local = plans.storedPrefsJson
                        val merged = if (local != null) R.mergeReadingPlanPrefsValue(d, local) else d
                        R.dict(merged)?.let { plans.applyRemotePrefs(it) }
                    }
                }
            }
            "tripleLoopProgress" -> R.dict(value)?.let { d ->
                if (R.dict(d.opt("ot")) != null && R.dict(d.opt("nt")) != null && R.dict(d.opt("wisdom")) != null) plans.applyRemoteTriple(d)
            }
            "ntDeepRepeatProgress" -> R.dict(value)?.let { d ->
                if (R.dict(d.opt("ot")) != null && R.num(d.opt("curriculumIndex")) != null && R.num(d.opt("dayInSegment")) != null && R.num(d.opt("pace")) != null) plans.applyRemoteNt(d)
            }
            "habitStats" -> R.dict(value)?.let { d ->
                if (R.num(d.opt("version")) == 1.0 && d.opt("completedDates") is JSONArray) activity.mergeRemoteHabit(R.stringArray(d.opt("completedDates")))
            }
            "scriptureListenTotals" -> R.parseListenTotals(value)?.let { activity.mergeRemoteListen(R.num(it.opt("totalSec")) ?: 0.0) }
            "recentSearches" -> R.dict(value)?.let { d ->
                if (R.num(d.opt("version")) == 1.0 && d.opt("terms") is JSONArray) search.replaceRecent(R.stringArray(d.opt("terms")))
            }
            "highlights" -> R.dict(value)?.let { highlights?.replace(it, applyingUpdatedAtMs) }
            "achievements" -> R.dict(value)?.let { achievements?.mergeRemote(it) }
            "appUsageTime" -> R.dict(value)?.let { d -> R.num(d.opt("totalSec"))?.let { activity.mergeRemoteUsage(it) } }
            "recentChapters" -> R.dict(value)?.let { d ->
                val items = d.opt("items") as? JSONArray ?: return@let
                val parsed = ArrayList<ReadingActivityStore.RecentChapter>(items.length())
                for (i in 0 until items.length()) {
                    val o = items.opt(i) as? JSONObject ?: continue
                    val bookId = (R.str(o.opt("bookId")) ?: "").trim()
                    val ch = (R.num(o.opt("chapter")) ?: 0.0).toInt()
                    if (bookId.isEmpty() || ch < 1) continue
                    parsed.add(ReadingActivityStore.RecentChapter(
                        bookId.uppercase(), ch, R.str(o.opt("bookName")) ?: bookId, R.num(o.opt("at")) ?: 0.0))
                }
                if (parsed.isNotEmpty()) activity.mergeRemoteRecent(parsed)
            }
            else -> {}
        }
    }

    private fun clearLocalBlobs() {
        beginApplying()
        try { plans.clearForAccountSwitch(); bookmarks.clearForAccountSwitch(); highlights?.clearForAccountSwitch(); activity.clearForAccountSwitch(); search.clearRecentForAccountSwitch(); achievements?.clearForAccountSwitch() }
        finally { endApplying() }
    }

    // ---- 一次同步（Worker 单次往返权威合并） ----

    private fun stampedPlanPush(stored: JSONObject, locale: Any?): Triple<JSONObject, JSONObject, String> {
        val at = R.isoString(System.currentTimeMillis().toDouble())
        val value = JSONObject(stored.toString())
        value.put("chosen", true)
        if (R.num(stored.opt("ntDeepRepeatPace")) == null) value.put("ntDeepRepeatPace", 7)
        return Triple(wrap(value, at), wrap(R.localeValueWithReadingPlan(locale, value), at), at)
    }

    private fun applyPulled(doc: AskBibleSyncClient.SyncDocument?, userId: String): Outcome {
        applyBlobs(doc?.blobs ?: JSONObject())
        highlights?.markSynced()
        meta = meta.copy(revision = doc?.revision ?: "0", lastSyncedAt = R.isoString(System.currentTimeMillis().toDouble()),
                         boundUserId = userId, requirePullOnly = false, lastError = null)
        return Outcome.OK
    }

    private suspend fun fetch(token: String, attempt: Attempt): SyncFetch {
        requireCurrent(attempt)
        val result = withContext(Dispatchers.IO) { AskBibleSyncClient.fetchSyncDocument(token) }
        requireCurrent(attempt)
        return result
    }

    private suspend fun push(token: String, attempt: Attempt, blobs: JSONObject): SyncFetch {
        requireCurrent(attempt)
        val result = withContext(Dispatchers.IO) { AskBibleSyncClient.pushSyncDocument(token, blobs) }
        requireCurrent(attempt)
        return result
    }

    private suspend fun pullAndApplyRemoteOnly(token: String, attempt: Attempt, label: String): Outcome = when (val r = fetch(token, attempt)) {
        is SyncFetch.Ok -> applyPulled(r.doc, attempt.userId)
        SyncFetch.Unauthorized -> { remember(SiteCopy.t("native.syncUnauthorized")); Outcome.UNAUTHORIZED }
        is SyncFetch.Failed -> { remember("$label：${r.message}"); Outcome.SKIPPED }
        SyncFetch.Network -> { remember(SiteCopy.t("native.syncOffline")); Outcome.OFFLINE }
    }

    suspend fun run(reason: String?): Outcome {
        val accountRevision = auth.accountRevision
        val generation = syncGeneration
        val token = auth.ensureFreshToken()
        val userId = auth.user?.id?.trim().orEmpty()
        if (accountRevision != auth.accountRevision || generation != syncGeneration) return Outcome.SKIPPED
        if (token == null || userId.isEmpty()) { remember(SiteCopy.t("native.syncNoSession")); return Outcome.SKIPPED }
        val attempt = Attempt(userId, accountRevision, generation)
        return try { runCurrent(reason, token, attempt) } catch (_: StaleAttempt) { Outcome.SKIPPED }
    }

    private suspend fun runCurrent(reason: String?, token: String, attempt: Attempt): Outcome {
        requireCurrent(attempt)
        val userId = attempt.userId
        var m = meta
        val ownerMode = when {
            m.boundUserId == userId && !m.requirePullOnly -> "continue"
            m.boundUserId != null && m.boundUserId != userId -> { clearLocalBlobs(); m = R.Meta(requirePullOnly = true); meta = m; "replace" }
            m.requirePullOnly -> "replace"
            else -> "unbound"
        }
        val localHas = localHasProgress()
        val storedPlan = plans.storedPrefsJson
        val forcePush = R.shouldForcePush(reason)
        val forcePushPlan = forcePush && !R.str(storedPlan?.opt("planId")).isNullOrEmpty()

        if (ownerMode == "replace" && !(forcePush && (localHas || forcePushPlan))) {
            return pullAndApplyRemoteOnly(token, attempt, SiteCopy.t("native.syncPullFailedAfterSwitch"))
        }
        if (ownerMode == "unbound") {
            when (val r = fetch(token, attempt)) {
                SyncFetch.Unauthorized -> { remember(SiteCopy.t("native.syncUnauthorized")); return Outcome.UNAUTHORIZED }
                is SyncFetch.Failed -> { remember(SiteCopy.f("native.syncPullFailedFirst", mapOf("message" to r.message))); return Outcome.SKIPPED }
                SyncFetch.Network -> { remember(SiteCopy.t("native.syncOffline")); return Outcome.OFFLINE }
                is SyncFetch.Ok -> {
                    val path = R.decidePath(null, false, userId, R.blobsHaveProgress(r.doc?.blobs), localHas, forcePush)
                    if (path == R.SyncPath.PULL_ONLY_REINSTALL || path == R.SyncPath.PULL_ONLY_EMPTY) return applyPulled(r.doc, userId)
                    meta = R.Meta(revision = r.doc?.revision, lastSyncedAt = null, boundUserId = userId, requirePullOnly = false, lastError = null)
                }
            }
        } else if (!localHas && !forcePushPlan) {
            return pullAndApplyRemoteOnly(token, attempt, SiteCopy.t("native.syncPullFailed"))
        }

        val localPush = exportLocal()
        if (forcePushPlan) {
            val latest = plans.storedPrefsJson ?: storedPlan
            if (latest != null) {
                val (plan, locale, _) = stampedPlanPush(latest, R.dict(localPush.opt("appLocale"))?.opt("value"))
                localPush.put("readingPlanPrefs", plan); localPush.put("appLocale", locale)
            }
        }
        return when (val pushed = push(token, attempt, localPush)) {
            is SyncFetch.Ok -> applyPulled(pushed.doc, userId)
            SyncFetch.Unauthorized -> { remember(SiteCopy.t("native.syncUnauthorized")); Outcome.UNAUTHORIZED }
            is SyncFetch.Failed -> { remember(SiteCopy.f("native.syncPushFailed", mapOf("message" to pushed.message))); Outcome.SKIPPED }
            SyncFetch.Network -> { remember(SiteCopy.t("native.syncOffline")); Outcome.OFFLINE }
        }
    }

    // ---- 调度 ----

    private val loggedIn: Boolean get() = ::auth.isInitialized && auth.user != null && auth.sessionToken != null

    fun schedule(reason: String = "foreground") {
        if (!loggedIn) return
        val now = System.currentTimeMillis()
        if (inFlight != null || now - lastSyncStartedAt < R.MIN_SYNC_INTERVAL_MS) return
        lastSyncStartedAt = now
        val d = scope.async { run(reason) }
        inFlight = d
        scope.launch { try { d.await() } finally { if (inFlight === d) inFlight = null } }
    }

    suspend fun flushNow(reason: String): Outcome {
        if (!loggedIn) return Outcome.SKIPPED
        var next = reason
        while (true) {
            val t = inFlight
            if (t != null) {
                pendingFlushReason = next
                val o = t.await()
                if (inFlight === t) inFlight = null
                val again = pendingFlushReason ?: return o
                pendingFlushReason = null
                next = again
                continue
            }
            lastSyncStartedAt = 0
            val r = next
            val d = scope.async { run(r) }
            inFlight = d
            val o = try { d.await() } finally { if (inFlight === d) inFlight = null; lastSyncStartedAt = System.currentTimeMillis() }
            return o
        }
    }

    fun flushInBackground(reason: String) { scope.launch { flushNow(reason) } }

    fun notifyLocalChanged(reason: String) {
        if (applyingRemote || !loggedIn) return
        pendingLocalReason = reason
        debounceJob?.cancel()
        debounceJob = scope.launch {
            delay(R.LOCAL_CHANGE_DEBOUNCE_MS)
            val r = pendingLocalReason ?: "local-change"
            pendingLocalReason = null
            flushNow(r)
        }
    }

    suspend fun prepareSignOut() {
        debounceJob?.cancel(); debounceJob = null; pendingLocalReason = null
        if (loggedIn) withTimeoutOrNull(12_000) { flushNow("sign-out") }
        syncGeneration++
        inFlight?.cancel()
        inFlight = null
        pendingFlushReason = null
        lastSyncStartedAt = 0L
        clearLocalBlobs()
        meta = R.Meta(revision = null, lastSyncedAt = null, boundUserId = null, requirePullOnly = true, lastError = null)
    }
}
