import Foundation
import Combine

/// 会员读经进度与云端的同步驱动（DECISIONS D-44：去客户端三端重复合并器，统一走 `askbible-sync` Worker 权威合并）。
/// 路径：换帐号 / 退出后重登只拉云端；未绑定先看云端（有进度只拉，没进度把本机当「游客升级」推上去）；
/// 已绑定同帐号直接一次 `POST /v1/sync/reading` 原子合并并返回最新文档落盘。
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
    private var highlights: VerseHighlightStore!
    private var achievements: AchievementStore!
    var localeTag: () -> String = { "zh-CN" }

    private let defaults: UserDefaults
    private var inFlight: Task<Outcome, Never>?
    private var pendingFlushReason: String?
    private var lastSyncStartedAt: TimeInterval = 0
    private var debounceTask: Task<Void, Never>?
    private var pendingLocalReason: String?
    private var applyingRemote = false
    private var syncGeneration: UInt64 = 0

    private struct RunContext {
        let userId: String
        let sessionGeneration: UInt64
        let syncGeneration: UInt64
    }

    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    private func isCurrent(_ context: RunContext) -> Bool {
        !Task.isCancelled && context.syncGeneration == syncGeneration
            && context.sessionGeneration == auth?.sessionGeneration && context.userId == auth?.user?.id
    }

    func cancelPendingWork() {
        syncGeneration &+= 1
        inFlight?.cancel(); inFlight = nil
        debounceTask?.cancel(); debounceTask = nil
        pendingFlushReason = nil; pendingLocalReason = nil; lastSyncStartedAt = 0
    }

    func resetForAccountChange() {
        cancelPendingWork()
        clearLocalBlobs()
        meta = Rules.Meta(revision: nil, lastSyncedAt: nil, boundUserId: nil, requirePullOnly: true, lastError: nil)
    }

    func attach(auth: MemberAuthStore, plans: ReadingPlanStore, bookmarks: VerseBookmarkStore, activity: ReadingActivityStore,
                search: SearchPrefs, highlights: VerseHighlightStore, achievements: AchievementStore) {
        self.auth = auth; self.plans = plans; self.bookmarks = bookmarks; self.activity = activity; self.search = search
        self.highlights = highlights
        self.achievements = achievements
        achievements.onLocalChange = { [weak self] k in self?.notifyLocalChanged(k) }
        highlights.onLocalChange = { [weak self] k in self?.notifyLocalChanged(k) }
        plans.onLocalChange = { [weak self] k in self?.notifyLocalChanged(k) }
        bookmarks.onLocalChange = { [weak self] in self?.notifyLocalChanged("bookmarks") }
        activity.onLocalChange = { [weak self] k in self?.notifyLocalChanged(k) }
        search.onLocalChange = { [weak self] in self?.notifyLocalChanged("recentSearches") }
        lastSyncedAt = meta.lastSyncedAt
        lastError = meta.lastError
    }

    // MARK: meta

    private var meta: Rules.Meta {
        get { Rules.Meta.parse(defaults.string(forKey: Rules.metaKey)) }
        set { defaults.set(newValue.serialize(), forKey: Rules.metaKey); lastSyncedAt = newValue.lastSyncedAt; lastError = newValue.lastError }
    }
    private func remember(_ error: String?) { var m = meta; m.lastError = error; meta = m }

    // MARK: 导出本机

    private func wrap(_ v: Any, _ now: String) -> [String: Any] { ["updatedAt": now, "value": v] }

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
        if activity.usageTotalSec > 0 { blobs["appUsageTime"] = wrap(activity.usageJSON, now) }
        if !activity.recent.isEmpty { blobs["recentChapters"] = wrap(activity.recentJSON, now) }
        let hl = highlights.json
        if !hl.isEmpty { blobs["highlights"] = wrap(hl, now) }
        if achievements.hasProgress { blobs["achievements"] = wrap(achievements.syncJSON, now) }
        return blobs
    }

    func localHasProgress() -> Bool {
        if !bookmarks.store.isEmpty || !bookmarks.tombstones.isEmpty || !highlights.store.isEmpty || !highlights.verseTimestamps.isEmpty || achievements.hasProgress { return true }
        if activity.lastPosition != nil { return true }
        if activity.listenTotalSec > 0 { return true }
        if !plans.completed.isEmpty { return true }
        if !habitDates.isEmpty { return true }
        if Rules.shouldSyncReadingPlanPrefs(plans.storedPrefsJSON) { return true }
        return plans.hasUserTriple || plans.hasUserNt
    }

    // MARK: 应用云端

    private func beginApplying() {
        applyingRemote = true
        plans.suppressChangeNotify = true; activity.suppressChangeNotify = true; achievements.suppressChangeNotify = true
    }
    private func endApplying() {
        plans.suppressChangeNotify = false; activity.suppressChangeNotify = false; achievements.suppressChangeNotify = false
        applyingRemote = false
    }

    func applyBlobs(_ blobs: [String: Any]) {
        beginApplying()
        defer { endApplying() }
        for key in Rules.blobKeys {
            guard let blob = Rules.dict(blobs[key]), let value = blob["value"] else { continue }
            apply(key, value)
        }
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
        case "highlights":
            if let o = R.dict(value) { highlights.replace(json: o) }
        case "achievements":
            if let d = R.dict(value) { achievements.mergeRemote(d) }
        case "appUsageTime":
            if let d = R.dict(value), let sec = R.num(d["totalSec"]) { activity.mergeRemoteUsage(totalSec: sec) }
        case "recentChapters":
            if let d = R.dict(value), let items = d["items"] as? [Any] {
                let parsed: [ReadingActivityStore.RecentChapter] = items.compactMap { raw in
                    guard let o = raw as? [String: Any],
                          let bookId = (o["bookId"] as? String)?.trimmingCharacters(in: .whitespaces), !bookId.isEmpty,
                          let ch = R.num(o["chapter"]), ch >= 1 else { return nil }
                    return ReadingActivityStore.RecentChapter(
                        bookId: bookId.uppercased(), chapter: Int(ch),
                        bookName: (o["bookName"] as? String) ?? bookId,
                        at: R.num(o["at"]) ?? 0)
                }
                if !parsed.isEmpty { activity.mergeRemoteRecent(parsed) }
            }
        default:
            break
        }
    }

    private func clearLocalBlobs() {
        beginApplying()
        plans.clearForAccountSwitch(); bookmarks.clearForAccountSwitch(); activity.clearForAccountSwitch(); search.clearRecentForAccountSwitch()
        highlights.clearForAccountSwitch(); achievements.clearForAccountSwitch()
        endApplying()
    }

    // MARK: 一次同步（Worker 单次往返权威合并）

    private func stampedPlanPush(_ stored: [String: Any], locale: Any?) -> (plan: [String: Any], locale: [String: Any], at: String) {
        let at = Rules.isoString(ms: Date().timeIntervalSince1970 * 1000)
        var value = stored
        value["chosen"] = true
        if Rules.num(stored["ntDeepRepeatPace"]) == nil { value["ntDeepRepeatPace"] = 7 }
        return (wrap(value, at), wrap(Rules.localeValueWithReadingPlan(locale: locale, plan: value), at), at)
    }

    private func applyPulled(_ doc: AskBibleSyncClient.SyncDocument?, userId: String) -> Outcome {
        applyBlobs(doc?.blobs ?? [:])
        var m = meta
        m.revision = doc?.revision ?? "0"; m.lastSyncedAt = Rules.isoString(ms: Date().timeIntervalSince1970 * 1000)
        m.boundUserId = userId; m.requirePullOnly = false; m.lastError = nil
        meta = m
        return .ok
    }

    private func pullAndApplyRemoteOnly(token: String, context: RunContext, label: String) async -> Outcome {
        let result = await AskBibleSyncClient.fetchSyncDocument(token: token)
        guard isCurrent(context) else { return .skipped }
        switch result {
        case .ok(let doc): return applyPulled(doc, userId: context.userId)
        case .unauthorized: remember(SiteCopy.t("native.syncUnauthorized")); return .unauthorized
        case .failed(let m): remember("\(label)：\(m)"); return .skipped
        case .network: remember(SiteCopy.t("native.syncOffline")); return .offline
        }
    }

    func run(reason: String?) async -> Outcome {
        guard let auth, let userId = auth.user?.id, !userId.trimmingCharacters(in: .whitespaces).isEmpty else {
            remember(SiteCopy.t("native.syncNoSession")); return .skipped
        }
        let context = RunContext(userId: userId, sessionGeneration: auth.sessionGeneration, syncGeneration: syncGeneration)
        let token = await auth.ensureFreshToken()
        guard isCurrent(context), let token else { return .skipped }
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
            return await pullAndApplyRemoteOnly(token: token, context: context, label: SiteCopy.t("native.syncPullFailedAfterSwitch"))
        }
        if ownerMode == "unbound" {
            let initial = await AskBibleSyncClient.fetchSyncDocument(token: token)
            guard isCurrent(context) else { return .skipped }
            switch initial {
            case .unauthorized: remember(SiteCopy.t("native.syncUnauthorized")); return .unauthorized
            case .failed(let msg): remember(SiteCopy.f("native.syncPullFailedFirst", ["message": msg])); return .skipped
            case .network: remember(SiteCopy.t("native.syncOffline")); return .offline
            case .ok(let doc):
                let path = Rules.decidePath(boundUserId: nil, requirePullOnly: false, userId: userId,
                                            remoteHasProgress: Rules.blobsHaveProgress(doc?.blobs), localHasProgress: localHas, forcePush: forcePush)
                if path == .pullOnlyReinstall || path == .pullOnlyEmpty { return applyPulled(doc, userId: userId) }
                meta = Rules.Meta(revision: doc?.revision, lastSyncedAt: nil, boundUserId: userId, requirePullOnly: false, lastError: nil)
            }
        } else if !localHas, !forcePushPlan {
            return await pullAndApplyRemoteOnly(token: token, context: context, label: SiteCopy.t("native.syncPullFailed"))
        }

        var localPush = exportLocal()
        if forcePushPlan, let latest = plans.storedPrefsJSON ?? storedPlan {
            let stamped = stampedPlanPush(latest, locale: Rules.dict(localPush["appLocale"])?["value"])
            localPush["readingPlanPrefs"] = stamped.plan
            localPush["appLocale"] = stamped.locale
        }
        let pushed = await AskBibleSyncClient.pushSyncDocument(token: token, blobs: localPush)
        guard isCurrent(context) else { return .skipped }
        switch pushed {
        case .ok(let doc):
            return applyPulled(doc, userId: userId)
        case .unauthorized:
            remember(SiteCopy.t("native.syncUnauthorized"))
            return .unauthorized
        case .failed(let msg):
            remember(SiteCopy.f("native.syncPushFailed", ["message": msg]))
            return .skipped
        case .network:
            remember(SiteCopy.t("native.syncOffline"))
            return .offline
        }
    }

    // MARK: 调度

    private var loggedIn: Bool { auth?.user != nil && auth?.sessionToken != nil }

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

    @discardableResult
    func flushNow(reason: String) async -> Outcome {
        guard loggedIn else { return .skipped }
        var reason = reason
        let generation = syncGeneration
        let sessionGeneration = auth?.sessionGeneration
        while true {
            guard !Task.isCancelled, generation == syncGeneration,
                  sessionGeneration == auth?.sessionGeneration, loggedIn else { return .skipped }
            if let t = inFlight {
                pendingFlushReason = reason
                let o = await withTaskCancellationHandler(operation: { await t.value }, onCancel: { t.cancel() })
                guard !Task.isCancelled, generation == syncGeneration,
                      sessionGeneration == auth?.sessionGeneration else { return .skipped }
                if inFlight == t { inFlight = nil }
                guard let again = pendingFlushReason else { return o }
                pendingFlushReason = nil
                reason = again
                continue
            }
            lastSyncStartedAt = 0
            let task = Task { [weak self] () -> Outcome in
                guard let self else { return .skipped }
                return await self.run(reason: reason)
            }
            inFlight = task
            let o = await withTaskCancellationHandler(operation: { await task.value }, onCancel: { task.cancel() })
            guard !Task.isCancelled, generation == syncGeneration,
                  sessionGeneration == auth?.sessionGeneration else { return .skipped }
            if inFlight == task { inFlight = nil }
            lastSyncStartedAt = Date().timeIntervalSince1970
            return o
        }
    }

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

    func prepareSignOut() async -> Bool {
        let generation = auth?.sessionGeneration
        debounceTask?.cancel(); debounceTask = nil; pendingLocalReason = nil
        if loggedIn {
            await withTaskGroup(of: Void.self) { group in
                group.addTask { [weak self] in _ = await self?.flushNow(reason: "sign-out") }
                group.addTask { try? await Task.sleep(nanoseconds: 12_000_000_000) }
                await group.next()
                group.cancelAll()
            }
        }
        guard generation == auth?.sessionGeneration else { return false }
        resetForAccountChange()
        return true
    }
}
