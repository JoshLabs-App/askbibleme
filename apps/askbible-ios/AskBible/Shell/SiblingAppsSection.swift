import SwiftUI
import UIKit

/// 「更多 App」：同系列的圣经软件（DECISIONS D-42），列在探索页最下面。
/// 清单是几个 App 共用的一份 JSON：线上 `askbible-media/sibling-apps/apps.json`（真源 `data/sibling-apps/apps.json`），
/// App 内带一份同样的兜底（`Resources/sibling-apps.json`）。改清单 / 加 App / 换链接只改线上那份，不用发版。
/// 每个 App 显示时去掉自己（这里是 `askbible`）。
struct SiblingApp: Decodable, Identifiable {
    let id: String
    let icon: String?
    let name: [String: String]
    let tagline: [String: String]
    let ios: String?
    let android: String?
    let googlePlay: String?
    let web: String?
}

struct SiblingAppsCatalog: Decodable {
    let version: Int
    let page: [String: [String: String]]
    let apps: [SiblingApp]

    static let selfId = "askbible"
    static let remoteURL = URL(string: "https://askbible-media.joshlabs.app/sibling-apps/apps.json")!
    private static var cacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("sibling-apps.json")
    }

    /// 先用上次拉到的，没有就用 App 内兜底
    static func local() -> SiblingAppsCatalog? {
        if let d = try? Data(contentsOf: cacheURL), let c = try? JSONDecoder().decode(Self.self, from: d) { return c }
        guard let url = Bundle.main.url(forResource: "sibling-apps", withExtension: "json"),
              let d = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Self.self, from: d)
    }

    static func fetchRemote() async -> SiblingAppsCatalog? {
        var req = URLRequest(url: remoteURL)
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.timeoutInterval = 8
        guard let (d, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let c = try? JSONDecoder().decode(Self.self, from: d) else { return nil }
        try? d.write(to: cacheURL, options: .atomic)
        return c
    }

    func text(_ key: String, _ locale: AppLocale) -> String {
        Self.pick(page[key], locale)
    }

    static func pick(_ m: [String: String]?, _ locale: AppLocale) -> String {
        guard let m else { return "" }
        return m[locale.rawValue] ?? m["zh-CN"] ?? m["en"] ?? m.values.first ?? ""
    }
}

/// 探索页最下面的「更多 App」一节（JOSHUA 2026-10-21：不要深菜单，直接在探索页下面列出来）。
/// 一行一个 App，整行可点：iOS 有 App Store 就去 App Store，没上架的去网页版。
struct SiblingAppsSection: View {
    let locale: AppLocale

    @State private var catalog = SiblingAppsCatalog.local()
    @Environment(\.parchment) private var theme
    @Environment(\.openURL) private var openURL

    var body: some View {
        let apps = (catalog?.apps ?? []).filter { $0.id != SiblingAppsCatalog.selfId && $0.iosTarget != nil }
        VStack(alignment: .leading, spacing: 0) {
            if let catalog, !apps.isEmpty {
                Text(catalog.text("title", locale))
                    .font(.system(size: 15))
                    .foregroundStyle(theme.faint)
                    .padding(.top, 28)
                    .padding(.bottom, 6)
                ForEach(apps) { row($0) }
            }
        }
        .padding(.horizontal, 26)
        .task {
            if let fresh = await SiblingAppsCatalog.fetchRemote() { catalog = fresh }
        }
    }

    private func row(_ app: SiblingApp) -> some View {
        Button {
            if let s = app.iosTarget, let u = URL(string: s) { openURL(u) }
        } label: {
            HStack(spacing: 12) {
                icon(app)
                VStack(alignment: .leading, spacing: 2) {
                    Text(SiblingAppsCatalog.pick(app.name, locale))
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(theme.ink)
                    Text(SiblingAppsCatalog.pick(app.tagline, locale))
                        .font(.system(size: 13))
                        .foregroundStyle(theme.muted)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(theme.muted.opacity(0.5))
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func icon(_ app: SiblingApp) -> some View {
        let shape = RoundedRectangle(cornerRadius: 10, style: .continuous)
        Group {
            if let ui = UIImage(named: "sibling-\(app.id)") {
                Image(uiImage: ui).resizable()
            } else if let s = app.icon, let url = URL(string: s) {
                AsyncImage(url: url) { $0.resizable() } placeholder: { theme.border.opacity(0.3) }
            } else {
                theme.border.opacity(0.3)
            }
        }
        .frame(width: 44, height: 44)
        .clipShape(shape)
        .overlay(shape.stroke(theme.border, lineWidth: 0.5))
    }
}

extension SiblingApp {
    /// iOS 上点这一行去哪：App Store 优先，没上架的去网页版
    var iosTarget: String? { ios ?? web }
}
