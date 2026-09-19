package me.askbible.native_.data

import me.askbible.native_.data.SiteCopy
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import me.askbible.native_.data.MemberReadingSyncRules as R
import me.askbible.native_.data.SupabaseAuthClient.SyncFetch
import me.askbible.native_.home.ReadingPlanStore
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/**
 * 会员读经进度与云端的同步驱动（RN runMemberReadingSync / requestMemberReadingSync / useMemberReadingSync / readingSyncLocal*）。
 * 纯规则在 MemberReadingSyncRules；这里只搬 blobs：本机各 store ↔ Supabase member_reading_sync_documents。与 iOS MemberReadingSyncEngine 同构。
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
    /** 当前界面语言（appLocale 侧车的 locale） */
    var localeTag: () -> String = { "zh-CN" }

    private var inFlight: Deferred<Outcome>? = null
    private var pendingFlushReason: String? = null
    private var lastSyncStartedAt = 0L
    private var debounceJob: Job? = null
    private var pendingLocalReason: String? = null
    private var applyingRemote = false

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

    // ---- meta（askbible.member-reading-sync-meta.v1，与 RN 同键同形） ----

    private var meta: R.Meta
        get() = R.Meta.parse(sp.getString(R.META_KEY, null))
        set(v) { sp.edit().putString(R.META_KEY, v.serialize()).apply(); lastSyncedAt = v.lastSyncedAt; lastError = v.lastError }
    private fun remember(error: String?) { meta = meta.copy(lastError = error) }

    // ---- 导出本机（RN exportLocalReadingBlobs / localHasMemberReadingProgress） ----

    private fun wrap(v: Any, now: String) = JSONObject().put("updatedAt", now).put("value", v)

    /** RN 在 hydrate 时把播放页点听日并入习惯统计；导出时也取并集 */
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
        // Josh 2026-09-11：使用时长与最近阅读也上云
        if (activity.usageTotalSec > 0) blobs.put("appUsageTime", wrap(activity.usageJson(), now))
        if (activity.recent.isNotEmpty()) blobs.put("recentChapters", wrap(activity.recentJson(), now))
        highlights?.let { h ->
            if (h.localUpdatedAtMs > 0) blobs.put("highlights", wrap(h.json(), R.isoString(h.localUpdatedAtMs.toDouble())))
            else { val hl = h.json(); if (hl.length() > 0) blobs.put("highlights", wrap(hl, now)) }
        }
        achievements?.let { a -> if (a.hasProgress) blobs.put("achievements", wrap(a.syncJson(), now)) }
        return blobs
    }

    fun localHasProgress(): Boolean {
        if (bookmarks.store.isNotEmpty()) return true
        if (highlights?.dirty == true) return true
        if (activity.lastPosition != null) return true
        if (activity.listenTotalSec > 0) return true
        if (plans.completed.isNotEmpty()) return true
        if (habitDates.isNotEmpty()) return true
        if (R.shouldSyncReadingPlanPrefs(plans.storedPrefsJson)) return true
        return plans.hasUserTriple || plans.hasUserNt
    }

    // ---- 应用云端（RN applyMemberReadingSyncBlobs / applyReadingSyncBlob） ----

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
            // 没有正式 readingPlanPrefs blob 时才用 appLocale 侧车里的旧计划
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
            "highlights" -> R.dict(value)?.let { highlights?.replace(VerseHighlightStore.parse(it), applyingUpdatedAtMs) }
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
            else -> {} // 高亮 / 今日完成 / 字体 / 译本 / 首页与自然场景设置 / 音乐主题 / 语速 / 人声 / 探索档案 / 语言：原生没有对应开关，只在云端保留、不动本机
        }
    }

    /** 换帐号 / 退出：清空本机同步数据（RN clearLocalMemberReadingSyncBlobs） */
    private fun clearLocalBlobs() {
        beginApplying()
        try { plans.clearForAccountSwitch(); bookmarks.clearForAccountSwitch(); activity.clearForAccountSwitch(); search.clearRecentForAccountSwitch(); achievements?.clearForAccountSwitch() }
        finally { endApplying() }
    }

    // ---- 一次同步（RN runMemberReadingSync，Supabase 直连；不带主站回落与三次回读确认） ----

    private fun stampedPlanPush(stored: JSONObject, locale: Any?): Triple<JSONObject, JSONObject, String> {
        val at = R.isoString(System.currentTimeMillis().toDouble())
        val value = JSONObject(stored.toString())
        value.put("chosen", true)
        if (R.num(stored.opt("ntDeepRepeatPace")) == null) value.put("ntDeepRepeatPace", 7)
        return Triple(wrap(value, at), wrap(R.localeValueWithReadingPlan(locale, value), at), at)
    }

    private fun applyPulled(doc: SupabaseAuthClient.SyncDocument?, userId: String): Outcome {
        applyBlobs(doc?.blobs ?: JSONObject())
        meta = meta.copy(revision = doc?.revision ?: "0", lastSyncedAt = R.isoString(System.currentTimeMillis().toDouble()),
                         boundUserId = userId, requirePullOnly = false, lastError = null)
        return Outcome.OK
    }

    private suspend fun fetch(token: String, userId: String): SyncFetch = withContext(Dispatchers.IO) { SupabaseAuthClient.fetchSyncDocument(token, userId) }

    private suspend fun pullAndApplyRemoteOnly(token: String, userId: String, label: String): Outcome = when (val r = fetch(token, userId)) {
        is SyncFetch.Ok -> applyPulled(r.doc, userId)
        SyncFetch.Unauthorized -> { remember(SiteCopy.t("native.syncUnauthorized")); Outcome.UNAUTHORIZED }
        is SyncFetch.Failed -> { remember("$label：${r.message}"); Outcome.SKIPPED }
        SyncFetch.Network -> { remember(SiteCopy.t("native.syncOffline")); Outcome.OFFLINE }
    }

    /** RN memberReadingSyncPushSupabase：读云端 → 合并 → upsert，回合并后的文档 */
    private suspend fun pushMerged(token: String, userId: String, blobs: JSONObject): SyncFetch {
        val existing = fetch(token, userId)
        val doc = (existing as? SyncFetch.Ok)?.doc ?: return if (existing is SyncFetch.Ok) upsertNow(token, userId, null, blobs) else existing
        return upsertNow(token, userId, doc, blobs)
    }

    private suspend fun upsertNow(token: String, userId: String, doc: SupabaseAuthClient.SyncDocument?, blobs: JSONObject): SyncFetch {
        val nowMs = System.currentTimeMillis()
        val merged = R.mergePush(doc?.blobs, blobs, LocalDate.now())
        return withContext(Dispatchers.IO) {
            SupabaseAuthClient.upsertSyncDocument(token, userId, R.newRevision(nowMs), R.isoString(nowMs.toDouble()), merged)
        }
    }

    /** RN mergeAndApply：网络往返期间本地可能又改了，用最新本地再合并一次再落盘 */
    private fun mergeAndApply(remote: JSONObject?, localPush: JSONObject): JSONObject {
        val fresh = exportLocal()
        val merged = R.mergePush(R.mergePush(remote, localPush), fresh)
        applyBlobs(merged)
        return merged
    }

    suspend fun run(reason: String?): Outcome {
        val token = auth.ensureFreshToken()
        val userId = auth.user?.id?.trim().orEmpty()
        if (token == null || userId.isEmpty()) { remember(SiteCopy.t("native.syncNoSession")); return Outcome.SKIPPED }
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

        if (ownerMode == "replace" && !(forcePush && (localHas || forcePushPlan))) return pullAndApplyRemoteOnly(token, userId, SiteCopy.t("native.syncPullFailedAfterSwitch"))
        if (ownerMode == "unbound") {
            when (val r = fetch(token, userId)) {
                SyncFetch.Unauthorized -> { remember(SiteCopy.t("native.syncUnauthorized")); return Outcome.UNAUTHORIZED }
                is SyncFetch.Failed -> { remember(SiteCopy.f("native.syncPullFailedFirst", mapOf("message" to r.message))); return Outcome.SKIPPED }
                SyncFetch.Network -> { remember(SiteCopy.t("native.syncOffline")); return Outcome.OFFLINE }
                is SyncFetch.Ok -> {
                    val path = R.decidePath(null, false, userId, R.blobsHaveProgress(r.doc?.blobs), localHas, forcePush)
                    if (path == R.SyncPath.PULL_ONLY_REINSTALL || path == R.SyncPath.PULL_ONLY_EMPTY) return applyPulled(r.doc, userId)
                    // 云端无进度、本机有进度：游客升级，先绑定再推本地
                    meta = R.Meta(revision = r.doc?.revision, lastSyncedAt = null, boundUserId = userId, requirePullOnly = false, lastError = null)
                }
            }
        } else if (!localHas && !forcePushPlan) {
            return pullAndApplyRemoteOnly(token, userId, SiteCopy.t("native.syncPullFailed"))
        }

        val localPush = exportLocal()
        if (forcePushPlan) {
            val latest = plans.storedPrefsJson ?: storedPlan
            if (latest != null) {
                val (plan, locale, _) = stampedPlanPush(latest, R.dict(localPush.opt("appLocale"))?.opt("value"))
                localPush.put("readingPlanPrefs", plan); localPush.put("appLocale", locale)
            }
        }
        return when (val pushed = pushMerged(token, userId, localPush)) {
            is SyncFetch.Ok -> {
                val merged = mergeAndApply(pushed.doc?.blobs, localPush)
                // 首推成功后再确认一次：同步期间本地又改过的，把合并结果再推上去
                when (val confirm = pushMerged(token, userId, merged)) {
                    is SyncFetch.Ok -> {
                        highlights?.markSynced()
                        meta = meta.copy(revision = confirm.doc?.revision ?: pushed.doc?.revision, lastSyncedAt = R.isoString(System.currentTimeMillis().toDouble()),
                                         boundUserId = userId, requirePullOnly = false, lastError = null)
                        Outcome.OK
                    }
                    SyncFetch.Unauthorized -> { remember(SiteCopy.t("native.syncUnauthorized")); Outcome.UNAUTHORIZED }
                    is SyncFetch.Failed -> { remember(SiteCopy.f("native.syncPushFailedAfterMerge", mapOf("message" to confirm.message))); Outcome.SKIPPED }
                    SyncFetch.Network -> { remember(SiteCopy.t("native.syncOffline")); Outcome.OFFLINE }
                }
            }
            SyncFetch.Unauthorized -> { remember(SiteCopy.t("native.syncUnauthorized")); Outcome.UNAUTHORIZED }
            is SyncFetch.Failed -> { remember(SiteCopy.f("native.syncPushFailed", mapOf("message" to pushed.message))); Outcome.SKIPPED }
            SyncFetch.Network -> { remember(SiteCopy.t("native.syncOffline")); Outcome.OFFLINE }
        }
    }

    // ---- 调度（RN scheduleMemberReadingSync / flushMemberReadingSyncNow / notifyMemberReadingLocalChanged） ----

    private val loggedIn: Boolean get() = ::auth.isInitialized && auth.user != null && auth.sessionToken != null

    /** 前台轮询用：30 秒内跑过就不再跑 */
    fun schedule(reason: String = "foreground") {
        if (!loggedIn) return
        val now = System.currentTimeMillis()
        if (inFlight != null || now - lastSyncStartedAt < R.MIN_SYNC_INTERVAL_MS) return
        lastSyncStartedAt = now
        val d = scope.async { run(reason) }
        inFlight = d
        scope.launch { try { d.await() } finally { if (inFlight === d) inFlight = null } }
    }

    /**
     * 登录 / 回前台 / 本地改动 / 退出前：跳过节流；已有同步在跑就等它完再用最新本地跑一轮
     *
     * 这里**不能写成递归**（2026-09-19 修，iOS 侧同一个 bug 已实测炸过）：
     * `schedule()` 把 `inFlight` 的清理挂在另一条协程上（第 338 行的 `scope.launch`），
     * 所以 `t.await()` 返回时 `inFlight` 很可能还指着那个**已经跑完**的 Deferred。
     * 递归回来一看它非 null，又去 await 一个完成态 Deferred —— 立即返回、不挂起，
     * `pendingFlushReason` 还是自己刚写进去的，于是无限递归，把主线程占死，
     * 负责清 `inFlight` 的那条协程永远排不上队。iOS 上实测每秒造上百万个 Task，
     * 几秒钟就顶到 2GB 被系统杀掉（表现为「启动几秒就闪退」且没有崩溃报告）。
     * 改法两条：等完就地把 `inFlight` 清掉；递归改循环。
     */
    suspend fun flushNow(reason: String): Outcome {
        if (!loggedIn) return Outcome.SKIPPED
        var next = reason
        while (true) {
            val t = inFlight
            if (t != null) {
                pendingFlushReason = next
                val o = t.await()
                // t 已经结束了。别等那条异步清理 —— 就地清，否则下一轮又 await 一个完成态 Deferred 空转
                if (inFlight === t) inFlight = null
                val again = pendingFlushReason ?: return o
                pendingFlushReason = null
                next = again
                continue        // 用最新的理由真正跑一轮（此时 inFlight 已是 null，不会再空转）
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

    /** 本地读经数据变更后 1.5 秒内合并成一次上传 */
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

    /** 退出登录前（RN signOut）：把没发出去的本地改动推上去（最多等 12 秒），再清本机、标记下次只拉云端 */
    suspend fun prepareSignOut() {
        debounceJob?.cancel(); debounceJob = null; pendingLocalReason = null
        if (loggedIn) withTimeoutOrNull(12_000) { flushNow("sign-out") }
        clearLocalBlobs()
        meta = R.Meta(revision = null, lastSyncedAt = null, boundUserId = null, requirePullOnly = true, lastError = null)
    }
}
