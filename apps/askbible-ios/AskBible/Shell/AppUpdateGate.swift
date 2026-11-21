import SwiftUI
import StoreKit

/// 版本自动检查 + 手动「检查更新」+ 好评邀请（D-46）。
enum AppStoreInfo {
    static let appId = "6771996188"
    static var writeReviewURL: URL? { URL(string: "https://apps.apple.com/app/id\(appId)?action=write-review") }
    static var storeURL: URL? { URL(string: "https://apps.apple.com/app/id\(appId)") }
}

@MainActor
final class AppUpdateChecker: ObservableObject {
    enum CheckOutcome: Equatable {
        case throttled
        case upToDate
        case updateAvailable(String)
        case networkFailed
    }

    @Published var newVersion: String?

    private let defaults = UserDefaults.standard
    private let lastCheckKey = "askbible-update-last-check"
    private let skippedKey = "askbible-update-skipped-version"
    /// 自动检查 6 小时内只查一次，与安卓同一个节奏；手动点「检查更新」传 force=true 不受限
    private let quiet: TimeInterval = 6 * 60 * 60

    var localVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0"
    }

    @discardableResult
    func check(force: Bool = false) async -> CheckOutcome {
        let now = Date().timeIntervalSince1970
        if !force, now - defaults.double(forKey: lastCheckKey) < quiet {
            return .throttled
        }

        guard let bundleId = Bundle.main.bundleIdentifier,
              let url = URL(string: "https://itunes.apple.com/lookup?bundleId=\(bundleId)&t=\(Int(now))")
        else { return .networkFailed }

        do {
            var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
            req.setValue("application/json", forHTTPHeaderField: "Accept")
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
                return .networkFailed
            }
            defaults.set(now, forKey: lastCheckKey)
            guard
                let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                let results = json["results"] as? [[String: Any]],
                let store = results.first?["version"] as? String
            else {
                return .upToDate
            }

            guard isNewer(store, than: localVersion) else {
                newVersion = nil
                return .upToDate
            }
            if !force, defaults.string(forKey: skippedKey) == store {
                return .throttled
            }
            newVersion = store
            return .updateAvailable(store)
        } catch {
            return .networkFailed
        }
    }

    func skipCurrent() {
        if let v = newVersion { defaults.set(v, forKey: skippedKey) }
        newVersion = nil
    }

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

/// 挂在根视图上：有新版就用羊皮卡片提示（对齐安卓 `UpdateGate.kt` `surfaceSolid`，不用系统玻璃弹窗）。
struct AppUpdateGate: View {
    @ObservedObject var checker: AppUpdateChecker
    var locale: AppLocale = AppLocale.current
    @Environment(\.parchment) private var theme

    var body: some View {
        ZStack {
            if let version = checker.newVersion {
                theme.modalBackdrop
                    .ignoresSafeArea()
                    .contentShape(Rectangle())
                    .onTapGesture { checker.skipCurrent() }

                VStack(alignment: .leading, spacing: 0) {
                    Text(SiteCopy.f("native.updateTitle", ["version": version], locale))
                        .askFont(size: 18, weight: .semibold)
                        .foregroundStyle(theme.ink)

                    Text(SiteCopy.t("native.updateHintIOS", locale))
                        .askFont(size: 14)
                        .lineSpacing(4)
                        .foregroundStyle(theme.inkSoft)
                        .padding(.top, 10)

                    HStack(spacing: 16) {
                        Spacer()
                        Button {
                            checker.skipCurrent()
                        } label: {
                            Text(SiteCopy.t("native.updateLater", locale))
                                .askFont(size: 15, weight: .medium)
                                .foregroundStyle(theme.muted)
                                .padding(.vertical, 8).padding(.horizontal, 6)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        Button {
                            if let url = AppStoreInfo.storeURL { UIApplication.shared.open(url) }
                            checker.newVersion = nil
                        } label: {
                            Text(SiteCopy.t("native.updateOpenAppStore", locale))
                                .askFont(size: 15, weight: .semibold)
                                .foregroundStyle(theme.accentOt)
                                .padding(.vertical, 8).padding(.horizontal, 6)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.top, 18)
                }
                .padding(.horizontal, 22).padding(.top, 20).padding(.bottom, 16)
                .frame(maxWidth: 320, alignment: .leading)
                .parchmentCard(cornerRadius: AskCorner.card)
                .askFloatingShadow(.overlay)
                .padding(.horizontal, 28)
            }
        }
    }
}

// MARK: - 好评邀请

@MainActor
enum RatePrompt {
    private static let defaults = UserDefaults.standard
    private static let firstRunKey = "askbible-rate-first-run-at"
    private static let askedVersionKey = "askbible-rate-asked-version"

    private static let minChapters = 5
    private static let minDays: TimeInterval = 3 * 24 * 60 * 60

    static func noteLaunch() {
        if defaults.double(forKey: firstRunKey) == 0 {
            defaults.set(Date().timeIntervalSince1970, forKey: firstRunKey)
        }
    }

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

    static func openWriteReview() {
        if let url = AppStoreInfo.writeReviewURL { UIApplication.shared.open(url) }
    }
}
