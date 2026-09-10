import Foundation
import Combine

/// 会员读经进度与云端的同步驱动（RN runMemberReadingSync / requestMemberReadingSync / useMemberReadingSync / readingSyncLocal*）。
/// 纯规则在 MemberReadingSyncRules；这里只搬 blobs：本机各 store ↔ Supabase member_reading_sync_documents。
/// 路径：换帐号 / 退出后重登只拉云端；未绑定先看云端（有进度只拉，没进度才把本机当「游客升级」推上去）；
/// 已绑定同帐号增量合并（推 → 服务端合并 → 本机再合并 → 再推一次确认）。
/// 调度：登录 / 冷启动 / 回前台立即同步，本地改动 1.5 秒防抖，45 秒轮询走 30 秒节流；同一时刻只跑一份。
@MainActor
final class MemberReadingSyncEngine: ObservableObject {
    typealias Rules = MemberReadingSyncRules
    enum Outcome: String { case ok, offline, skipped, unauthorized }

    @Published private(set) var lastError: String?
    @Published private(set) var lastSyncedAt: String?

    private weak var auth: MemberAuthStore?
    private var plans: ReadingPlanStore!
    private var bookmarks: VerseBookmarkStore!
    private var activity: ReadingActivityStore!
    private var search: SearchPrefs!
    /// 当前界面语言（appLocale 侧车的 locale）
    var localeTag: () -> String = { "zh-CN" }

    private let defaults = UserDefaults.standard
    private var inFlight: Task<Outcome, Never>?
    private var pendingFlushReason: String?
    private var lastSyncStartedAt: TimeInterval = 0
    private var debounceTask: Task<Void, Never>?
    private var pendingLocalReason: String?
    private var applyingRemote = false

    func attach(auth: MemberAuthStore, plans: ReadingPlanStore, bookmarks: VerseBookmarkStore, activity: ReadingActivityStore, search: SearchPrefs) {
        self.auth = auth; self.plans = plans; self.bookmarks = bookmarks; self.activity = activity; self.search = search
        plans.onLocalChange = { [weak self] k in self?.notifyLocalChanged(k) }
        bookmarks.onLocalChange = { [weak self] in self?.notifyLocalChanged("bookmarks") }
        activity.onLocalChange = { [weak self] k in self?.notifyLocalChanged(k) }
        search.onLocalChange = { [weak self] in self?.notifyLocalChanged("recentSearches") }
        lastSyncedAt = meta.lastSyncedAt
        lastError = meta.lastError
    }

    // MARK: meta（askbible.member-reading-sync-meta.v1，与 RN 同键同形）

    private var meta: Rules.Meta {
        get { Rules.Meta.parse(defaults.string(forKey: Rules.metaKey)) }
        set { defaults.set(newValue.serialize(), forKey: Rules.metaKey); lastSyncedAt = newValue.lastSyncedAt; lastError = newValue.lastError }
    }
    private func remember(_ error: String?) { var m = meta; m.lastError = error; meta = m }

    // MARK: 导出本机（RN exportLocalReadingBlobs / localHasMemberReadingProgress）

    private func wrap(_ v: Any, _ now: String) -> [String: Any] { ["updatedAt": now, "value": v] }

    /// RN 在 hydrate 时把播放页点听日并入习惯统计；导出时也取并集
    private var habitDates: [String] { Rules.normalizeDates(activity.completedDates + Array(plans.listenedDates)) }

    func exportLocal() -> [String: Any] {
        var blobs: [String: Any] = [:]
        let now = Rules.isoString(ms: Date().timeIntervalSince1970 * 1000)
        let bm = bookmarks.json
        if !bm.isEmpty { blobs["bookmarks"] = wrap(bm, now) }
        if let lp = activity.lastPositionJSON { blobs["lastPosition"] = wrap(lp, now) }
        let completed = plans.completedSorted
        if !completed.isEmpty { blobs["chapterCompletion"] = wrap(["version": 1, "completed": completed] as [String: Any], now) }
        if let prefs = plans.storedPrefsJSON, Rules.shouldSyncReadingPlanPrefs(prefs) {
            blobs["readingPlanPrefs"] = wrap(prefs, now)
            blobs["appLocale"] = wrap(Rules.localeValueWithReadingPlan(locale: ["version": 1, "locale": localeTag()] as [String: Any], plan: prefs), now)
        }
        if let t = plans.tripleJSON { blobs["tripleLoopProgress"] = wrap(t, now) }
        if let n = plans.ntJSON { blobs["ntDeepRepeatProgress"] = wrap(n, now) }
        let habit = habitDates
        if !habit.isEmpty { blobs["habitStats"] = wrap(["version": 1, "completedDates": habit] as [String: Any], now) }
        if activity.listenTotalSec > 0 { blobs["scriptureListenTotals"] = wrap(activity.listenJSON, now) }
        if !search.recent.isEmpty { blobs["recentSearches"] = wrap(["version": 1, "terms": search.recent] as [String: Any], now) }
        return blobs
    }

    func localHasProgress() -> Bool {
        if !bookmarks.store.isEmpty { return true }
        if activity.lastPosition != nil { return true }
        if activity.listenTotalSec > 0 { return true }
        if !plans.completed.isEmpty { return true }
        if !habitDates.isEmpty { return true }
        if Rules.shouldSyncReadingPlanPrefs(plans.storedPrefsJSON) { return true }
        return plans.hasUserTriple || plans.hasUserNt
    }

    // MARK: 应用云端（RN applyMemberReadingSyncBlobs / applyReadingSyncBlob）

    private func beginApplying() {
        applyingRemote = true
        plans.suppressChangeNotify = true; activity.suppressChangeNotify = true
    }
    private func endApplying() {
        plans.suppressChangeNotify = false; activity.suppressChangeNotify = false
        applyingRemote = false
    }

    func applyBlobs(_ blobs: [String: Any]) {
        beginApplying()
        defer { endApplying() }
        for key in Rules.blobKeys {
            guard let blob = Rules.dict(blobs[key]), let value = blob["value"] else { continue }
            apply(key, value)
        }
        // 没有正式 readingPlanPrefs blob 时才用 appLocale 侧车里的旧计划
        if blobs["readingPlanPrefs"] == nil, let side = Rules.dict(Rules.readingPlanFromAppLocale(Rules.dict(blobs["appLocale"])?["value"])),
           Rules.str(side["planId"]) != nil {
            let merged = plans.storedPrefsJSON.map { Rules.mergeReadingPlanPrefsValue(side, $0) } ?? side
            if let m = Rules.dict(merged) { plans.applyRemotePrefs(m) }
        }
    }

    private func apply(_ key: String, _ value: Any) {
        let R = Rules.self
        switch key {
        case "bookmarks":
            if let d = R.dict(value) { bookmarks.replace(json: d) }
        case "lastPosition":
            if let d = R.dict(value), let b = R.str(d["bookId"]), !b.isEmpty, let ch = R.num(d["chapter"]), ch == ch.rounded(), ch >= 1 {
                activity.applyRemoteLastPosition(bookId: b, chapter: Int(ch), bookName: R.str(d["bookName"]) ?? "")
            }
        case "chapterCompletion":
            if let d = R.dict(value), R.num(d["version"]) == 1, let arr = d["completed"] as? [Any] { plans.applyRemoteCompleted(arr.compactMap { $0 as? String }) }
        case "readingPlanPrefs":
            if value is NSNull { plans.applyRemotePrefs(nil) }
            else if let d = R.dict(value), R.str(d["planId"]) != nil {
                let merged = plans.storedPrefsJSON.map { R.mergeReadingPlanPrefsValue(d, $0) } ?? d
                if let m = R.dict(merged) { plans.applyRemotePrefs(m) }
            }
        case "tripleLoopProgress":
            if let d = R.dict(value), R.dict(d["ot"]) != nil, R.dict(d["nt"]) != nil, R.dict(d["wisdom"]) != nil { plans.applyRemoteTriple(d) }
        case "ntDeepRepeatProgress":
            if let d = R.dict(value), R.dict(d["ot"]) != nil, R.num(d["curriculumIndex"]) != nil, R.num(d["dayInSegment"]) != nil, R.num(d["pace"]) != nil {
                plans.applyRemoteNt(d)
            }
        case "habitStats":
            if let d = R.dict(value), R.num(d["version"]) == 1, let arr = d["completedDates"] as? [Any] { activity.mergeRemoteHabit(arr.compactMap { $0 as? String }) }
        case "scriptureListenTotals":
            if let d = R.parseListenTotals(value) { activity.mergeRemoteListen(totalSec: R.num(d["totalSec"]) ?? 0) }
        case "recentSearches":
            if let d = R.dict(value), R.num(d["version"]) == 1, let arr = d["terms"] as? [Any] { search.replaceRecent(arr.compactMap { $0 as? String }) }
        default:
            // 高亮 / 今日完成 / 字体 / 译本 / 首页与自然场景设置 / 音乐主题 / 语速 / 人声 / 探索档案 / 语言：原生没有对应开关，只在云端保留、不动本机
            break
        }
    }

    /// 换帐号 / 退出：清空本机同步数据（RN clearLocalMemberReadingSyncBlobs）
    private func clearLocalBlobs() {
        beginApplying()
        plans.clearForAccountSwitch(); bookmarks.clearForAccountSwitch(); activity.clearForAccountSwitch(); search.clearRecentForAccountSwitch()
        endApplying()
    }

    // MARK: 一次同步（RN runMemberReadingSync，Supabase 直连；不带主站回落与三次回读确认）

    private func stampedPlanPush(_ stored: [String: Any], locale: Any?) -> (plan: [String: Any], locale: [String: Any], at: String) {
        let at = Rules.isoString(ms: Date().timeIntervalSince1970 * 1000)
        var value = stored
        value["chosen"] = true
        if Rules.num(stored["ntDeepRepeatPace"]) == nil { value["ntDeepRepeatPace"] = 7 }
        return (wrap(value, at), wrap(Rules.localeValueWithReadingPlan(locale: locale, plan: value), at), at)
    }

    private func applyPulled(_ doc: SupabaseAuthClient.SyncDocument?, userId: String) -> Outcome {
        applyBlobs(doc?.blobs ?? [:])
        var m = meta
        m.revision = doc?.revision ?? "0"; m.lastSyncedAt = Rules.isoString(ms: Date().timeIntervalSince1970 * 1000)
        m.boundUserId = userId; m.requirePullOnly = false; m.lastError = nil
        meta = m
        return .ok
    }

    private func pullAndApplyRemoteOnly(token: String, userId: String, label: String) async -> Outcome {
        switch await SupabaseAuthClient.fetchSyncDocument(token: token, userId: userId) {
        case .ok(let doc): return applyPulled(doc, userId: userId)
        case .unauthorized: remember(SiteCopy.t("native.syncUnauthorized")); return .unauthorized
        case .failed(let m): remember("\(label)：\(m)"); return .skipped
        case .network: remember(SiteCopy.t("native.syncOffline")); return .offline
        }
    }

    /// RN memberReadingSyncPushSupabase：读云端 → 合并 → upsert，回合并后的文档
    private func pushMerged(token: String, userId: String, blobs: [String: Any]) async -> SupabaseAuthClient.SyncFetch {
        let existing = await SupabaseAuthClient.fetchSyncDocument(token: token, userId: userId)
        guard case .ok(let doc) = existing else { return existing }
        let now = Date()
        let merged = Rules.mergePush(base: doc?.blobs, incoming: blobs, now: now)
        return await SupabaseAuthClient.upsertSyncDocument(token: token, userId: userId, revision: Rules.newRevision(now: now),
                                                           updatedAt: Rules.isoString(ms: now.timeIntervalSince1970 * 1000), blobs: merged)
    }

    /// RN mergeAndApply：网络往返期间本地可能又改了，用最新本地再合并一次再落盘
    private func mergeAndApply(remote: [String: Any]?, localPush: [String: Any]) -> [String: Any] {
        let fresh = exportLocal()
        let merged = Rules.mergePush(base: Rules.mergePush(base: remote, incoming: localPush), incoming: fresh)
        applyBlobs(merged)
        return merged
    }

    func run(reason: String?) async -> Outcome {
        guard let auth, let token = await auth.ensureFreshToken(), let userId = auth.user?.id.trimmingCharacters(in: .whitespaces), !userId.isEmpty else {
            remember(SiteCopy.t("native.syncNoSession")); return .skipped
        }
        var m = meta
        let ownerMode: String
        if m.boundUserId == userId, !m.requirePullOnly { ownerMode = "continue" }
        else if let b = m.boundUserId, b != userId {
            clearLocalBlobs()
            m = Rules.Meta(requirePullOnly: true); meta = m
            ownerMode = "replace"
        } else if m.requirePullOnly { ownerMode = "replace" }
        else { ownerMode = "unbound" }

        let localHas = localHasProgress()
        let storedPlan = plans.storedPrefsJSON
        let forcePush = Rules.shouldForcePush(reason: reason)
        let forcePushPlan = forcePush && (Rules.str(storedPlan?["planId"])?.isEmpty == false)

        if ownerMode == "replace", !(forcePush && (localHas || forcePushPlan)) {
            return await pullAndApplyRemoteOnly(token: token, userId: userId, label: SiteCopy.t("native.syncPullFailedAfterSwitch"))
        }
        if ownerMode == "unbound" {
            switch await SupabaseAuthClient.fetchSyncDocument(token: token, userId: userId) {
            case .unauthorized: remember(SiteCopy.t("native.syncUnauthorized")); return .unauthorized
            case .failed(let msg): remember(SiteCopy.f("native.syncPullFailedFirst", ["message": msg])); return .skipped
            case .network: remember(SiteCopy.t("native.syncOffline")); return .offline
            case .ok(let doc):
                let path = Rules.decidePath(boundUserId: nil, requirePullOnly: false, userId: userId,
                                            remoteHasProgress: Rules.blobsHaveProgress(doc?.blobs), localHasProgress: localHas, forcePush: forcePush)
                if path == .pullOnlyReinstall || path == .pullOnlyEmpty { return applyPulled(doc, userId: userId) }
                // 云端无进度、本机有进度：游客升级，先绑定再推本地
                meta = Rules.Meta(revision: doc?.revision, lastSyncedAt: nil, boundUserId: userId, requirePullOnly: false, lastError: nil)
            }
        } else if !localHas, !forcePushPlan {
            return await pullAndApplyRemoteOnly(token: token, userId: userId, label: SiteCopy.t("native.syncPullFailed"))
        }

        var localPush = exportLocal()
        if forcePushPlan, let latest = plans.storedPrefsJSON ?? storedPlan {
            let stamped = stampedPlanPush(latest, locale: Rules.dict(localPush["appLocale"])?["value"])
            localPush["readingPlanPrefs"] = stamped.plan
            localPush["appLocale"] = stamped.locale
        }
        switch await pushMerged(token: token, userId: userId, blobs: localPush) {
        case .ok(let doc):
            let merged = mergeAndApply(remote: doc?.blobs, localPush: localPush)
            // 首推成功后再确认一次：同步期间本地又改过的，把合并结果再推上去
            switch await pushMerged(token: token, userId: userId, blobs: merged) {
            case .ok(let confirm):
                var mm = meta
                mm.revision = confirm?.revision ?? doc?.revision; mm.lastSyncedAt = Rules.isoString(ms: Date().timeIntervalSince1970 * 1000)
                mm.boundUserId = userId; mm.requirePullOnly = false; mm.lastError = nil
                meta = mm
                return .ok
            case .unauthorized: remember(SiteCopy.t("native.syncUnauthorized")); return .unauthorized
            case .failed(let msg): remember(SiteCopy.f("native.syncPushFailedAfterMerge", ["message": msg])); return .skipped
            case .network: remember(SiteCopy.t("native.syncOffline")); return .offline
            }
        case .unauthorized: remember(SiteCopy.t("native.syncUnauthorized")); return .unauthorized
        case .failed(let msg): remember(SiteCopy.f("native.syncPushFailed", ["message": msg])); return .skipped
        case .network: remember(SiteCopy.t("native.syncOffline")); return .offline
        }
    }

    // MARK: 调度（RN scheduleMemberReadingSync / flushMemberReadingSyncNow / notifyMemberReadingLocalChanged）

    private var loggedIn: Bool { auth?.user != nil && auth?.sessionToken != nil }

    /// 前台轮询用：30 秒内跑过就不再跑
    func schedule(reason: String = "foreground") {
        guard loggedIn else { return }
        let now = Date().timeIntervalSince1970
        guard inFlight == nil, now - lastSyncStartedAt >= Rules.minSyncIntervalMs / 1000 else { return }
        lastSyncStartedAt = now
        let task = Task { [weak self] () -> Outcome in
            guard let self else { return .skipped }
            return await self.run(reason: reason)
        }
        inFlight = task
        Task { [weak self] in _ = await task.value; if self?.inFlight == task { self?.inFlight = nil } }
    }

    /// 登录 / 回前台 / 本地改动 / 退出前：跳过节流；已有同步在跑就等它完再用最新本地跑一轮
    @discardableResult
    func flushNow(reason: String) async -> Outcome {
        guard loggedIn else { return .skipped }
        if let t = inFlight {
            pendingFlushReason = reason
            let o = await t.value
            guard let again = pendingFlushReason else { return o }
            pendingFlushReason = nil
            return await flushNow(reason: again)
        }
        lastSyncStartedAt = 0
        let task = Task { [weak self] () -> Outcome in
            guard let self else { return .skipped }
            return await self.run(reason: reason)
        }
        inFlight = task
        let o = await task.value
        if inFlight == task { inFlight = nil }
        lastSyncStartedAt = Date().timeIntervalSince1970
        return o
    }

    /// 本地读经数据变更后 1.5 秒内合并成一次上传
    func notifyLocalChanged(_ reason: String) {
        guard !applyingRemote, loggedIn else { return }
        pendingLocalReason = reason
        debounceTask?.cancel()
        debounceTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(Rules.localChangeDebounceMs * 1_000_000))
            guard !Task.isCancelled, let self else { return }
            let r = self.pendingLocalReason ?? "local-change"
            self.pendingLocalReason = nil
            _ = await self.flushNow(reason: r)
        }
    }

    /// 退出登录前（RN signOut）：把没发出去的本地改动推上去（最多等 12 秒），再清本机、标记下次只拉云端
    func prepareSignOut() async {
        debounceTask?.cancel(); debounceTask = nil; pendingLocalReason = nil
        if loggedIn {
            await withTaskGroup(of: Void.self) { group in
                group.addTask { [weak self] in _ = await self?.flushNow(reason: "sign-out") }
                group.addTask { try? await Task.sleep(nanoseconds: 12_000_000_000) }
                await group.next()
                group.cancelAll()
            }
        }
        clearLocalBlobs()
        meta = Rules.Meta(revision: nil, lastSyncedAt: nil, boundUserId: nil, requirePullOnly: true, lastError: nil)
    }
}
