import SwiftUI
import StoreKit

/// 版本对照 + 好评邀请（Josh 2026-09-23）。
///
/// **iOS 和安卓的能力不一样，别照抄**：
/// - 安卓站外版能自己下 APK 装上（`AppUpdater`），iOS 不行 —— 苹果不允许 App Store 之外的分发，
///   所以这里只做「**对照版本号 → 提示 → 送去 App Store**」，下载安装由 App Store 完成。
/// - 版本真源是 **iTunes Lookup 接口**（`itunes.apple.com/lookup?bundleId=…`），
///   不是我们自己的 version.json —— 商店上架要审核，我们这边发版的那一刻商店上还是旧的，
///   用自家文件对照会提示一个用户根本装不到的版本。
///
/// TestFlight 装的包版本号通常**高于**商店版，此时对照结果是「没有新版」，不打扰内测。
enum AppStoreInfo {
    static let appId = "6771996188"
    static var writeReviewURL: URL? { URL(string: "https://apps.apple.com/app/id\(appId)?action=write-review") }
    static var storeURL: URL? { URL(string: "https://apps.apple.com/app/id\(appId)") }
}

@MainActor
final class AppUpdateChecker: ObservableObject {
    @Published var newVersion: String?

    private let defaults = UserDefaults.standard
    private let lastCheckKey = "askbible-update-last-check"
    private let skippedKey = "askbible-update-skipped-version"
    /// 6 小时内只查一次，和安卓那边同一个节奏
    private let quiet: TimeInterval = 6 * 60 * 60

    var localVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
    }

    func check(force: Bool = false) async {
        let now = Date().timeIntervalSince1970
        if !force, now - defaults.double(forKey: lastCheckKey) < quiet { return }

        guard let bundleId = Bundle.main.bundleIdentifier,
              let url = URL(string: "https://itunes.apple.com/lookup?bundleId=\(bundleId)&t=\(Int(now))")
        else { return }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            defaults.set(now, forKey: lastCheckKey)
            guard
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                let results = json["results"] as? [[String: Any]],
                let store = results.first?["version"] as? String
            else { return }

            guard isNewer(store, than: localVersion) else { return }
            if !force, defaults.string(forKey: skippedKey) == store { return }
            newVersion = store
        } catch {
            // 断网不提示、也不记时间，下次进来再试
        }
    }

    func skipCurrent() {
        if let v = newVersion { defaults.set(v, forKey: skippedKey) }
        newVersion = nil
    }

    /// 逐段比数字。`1.1.10` > `1.1.9` —— 字符串比较会搞反，所以不能直接用 `>`。
    private func isNewer(_ a: String, than b: String) -> Bool {
        let x = a.split(separator: ".").map { Int($0) ?? 0 }
        let y = b.split(separator: ".").map { Int($0) ?? 0 }
        for i in 0..<max(x.count, y.count) {
            let l = i < x.count ? x[i] : 0
            let r = i < y.count ? y[i] : 0
            if l != r { return l > r }
        }
        return false
    }
}

/// 挂在根视图上：有新版就弹一次，送去 App Store。
struct AppUpdateGate: View {
    @StateObject private var checker = AppUpdateChecker()
    @Environment(\.parchment) private var theme

    var body: some View {
        Color.clear
            .task { await checker.check() }
            .alert(
                SiteCopy.f("native.updateTitle", ["version": checker.newVersion ?? ""]),
                isPresented: Binding(get: { checker.newVersion != nil },
                                     set: { if !$0 { checker.skipCurrent() } })
            ) {
                Button(SiteCopy.t("native.updateOpenAppStore")) {
                    if let url = AppStoreInfo.storeURL { UIApplication.shared.open(url) }
                    checker.newVersion = nil
                }
                Button(SiteCopy.t("native.updateLater"), role: .cancel) { checker.skipCurrent() }
            } message: {
                Text(SiteCopy.t("native.updateHintIOS"))
            }
    }
}

// MARK: - 好评邀请

/// 好评邀请（Josh 2026-09-23「增加一个去给我们在商店里好评反馈的弹出框」）。
///
/// **用系统的 `requestReview`，不自己画弹窗**：苹果每年只放行 3 次、且由系统决定要不要真的弹，
/// 自己画一个「去评分」的框再跳出去，转化更差，还容易被审核挑「引导好评」。
///
/// **时机要挑**，不能一进来就问：
/// - 至少读过 5 章（对这个 App 有感觉了才问得出口）
/// - 装上至少 3 天（当天就问像推销）
/// - 每个大版本只问一次
@MainActor
enum RatePrompt {
    private static let defaults = UserDefaults.standard
    private static let firstRunKey = "askbible-rate-first-run-at"
    private static let askedVersionKey = "askbible-rate-asked-version"

    private static let minChapters = 5
    private static let minDays: TimeInterval = 3 * 24 * 60 * 60

    /// 记一次「首次运行」时间；App 启动时调一次
    static func noteLaunch() {
        if defaults.double(forKey: firstRunKey) == 0 {
            defaults.set(Date().timeIntervalSince1970, forKey: firstRunKey)
        }
    }

    /// 读完一章之后调；条件不满足就什么都不做
    static func maybeAsk(chaptersRead: Int) {
        guard chaptersRead >= minChapters else { return }
        let firstRun = defaults.double(forKey: firstRunKey)
        guard firstRun > 0, Date().timeIntervalSince1970 - firstRun >= minDays else { return }

        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
        guard defaults.string(forKey: askedVersionKey) != version else { return }
        defaults.set(version, forKey: askedVersionKey)

        guard let scene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
        else { return }
        AppStore.requestReview(in: scene)
    }

    /// 「去评分」的手动入口（成就墙 / 设置里用），直接开写评价页
    static func openWriteReview() {
        if let url = AppStoreInfo.writeReviewURL { UIApplication.shared.open(url) }
    }
}
