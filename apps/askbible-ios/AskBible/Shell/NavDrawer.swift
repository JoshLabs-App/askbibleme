import SwiftUI

/// 首页左上角的用户菜单，对齐 RN `ShellNavDrawer`：自左侧滑出、宽度 80%、羊皮卷底。
/// 行样式来自 `shellNavDrawerMenuStyles`（圆角 10、内边 12 × 10、正文 16、右侧细节 12）。
struct NavDrawerView: View {
    let locale: AppLocale
    /// 界面语言手动设置（nil = 跟随系统）
    let localeOverride: AppLocale?
    let userName: String?
    /// 当前主译本的短名，显示在「圣经版本」右边
    let translationLabel: String
    /// 读经同步的右侧细节：已同步给时间，没有给「尚未同步」
    let syncDetail: String?
    var onSetLocale: (AppLocale?) -> Void = { _ in }
    var onOpenTranslations: () -> Void = {}
    var onLogin: () -> Void = {}
    var onRegister: () -> Void = {}
    var onLogout: () -> Void = {}
    var onFeedback: () -> Void = {}
    var onClose: () -> Void = {}

    private let theme = Parchment.light
    private static let supportEmail = "askbibleme@gmail.com"

    var body: some View {
        GeometryReader { geo in
            let panelW = min(geo.size.width * 0.8, 360)
            ZStack(alignment: .leading) {
                Color.black.opacity(0.42)
                    .ignoresSafeArea()
                    .onTapGesture { onClose() }

                VStack(alignment: .leading, spacing: 0) {
                    header
                    ScrollView(showsIndicators: false) { rows }
                    Text(SiteCopy.t("native.appVersion", locale).replacingOccurrences(of: "{{version}}", with: Self.versionLabel))
                        .font(.system(size: 11))
                        .foregroundStyle(theme.ink.opacity(0.42))
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
                .padding(.horizontal, 14)
                .padding(.top, max(geo.safeAreaInsets.top, 12))
                .padding(.bottom, max(geo.safeAreaInsets.bottom, 16))
                .frame(width: panelW, height: geo.size.height + geo.safeAreaInsets.top + geo.safeAreaInsets.bottom)
                .background(ParchmentBackground(theme: theme))
                .overlay(alignment: .trailing) { Rectangle().fill(theme.border).frame(width: 0.5) }
                .ignoresSafeArea()
            }
        }
        .transition(.move(edge: .leading).combined(with: .opacity))
    }

    private var header: some View {
        HStack {
            Text(SiteCopy.t("native.userMenu", locale))
                .font(.system(size: 14, weight: .semibold))
                .kerning(0.5)
                .foregroundStyle(theme.ink.opacity(0.55))
            Spacer()
            Button(action: onClose) {
                MaterialIcon(glyph: MI.close, size: 22, color: theme.ink.opacity(0.82))
                    .frame(width: 40, height: 40)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.bottom, 10)
    }

    @ViewBuilder
    private var rows: some View {
        localeRow
        menuRow(SiteCopy.t("native.bibleVersion", locale), detail: "\(translationLabel) \u{203A}", action: onOpenTranslations)
        if let userName {
            menuRow(SiteCopy.t("native.signedIn", locale), detail: userName, action: onClose)
            menuRow(SiteCopy.t("auth.drawerLogout", locale), action: onLogout)
        } else {
            menuRow(SiteCopy.t("auth.pageTitle", locale), action: onLogin)
            menuRow(SiteCopy.t("native.register", locale), action: onRegister)
        }
        menuRow(SiteCopy.t("native.sendFeedback", locale), detail: Self.supportEmail, action: onFeedback)
        if let syncDetail {
            menuRow(SiteCopy.t("native.readingSync", locale), detail: syncDetail, action: onClose)
        }
    }

    /// 语言行：RN 是「语言 + EN / 繁 / 简」三个胶囊，原生多一个「跟随系统」
    private var localeRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(SiteCopy.t("nav.language", locale))
                .font(.system(size: 16))
                .foregroundStyle(theme.ink)
            HStack(spacing: 6) {
                localeChip(nil, label: SiteCopy.t("native.followSystem", locale))
                ForEach([AppLocale.zhCN, .zhTW, .en], id: \.rawValue) { l in
                    localeChip(l, label: l.settingLabel)
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    private func localeChip(_ value: AppLocale?, label: String) -> some View {
        let on = localeOverride == value
        return Button { onSetLocale(value) } label: {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(on ? Color(rgb: 0x784b1e) : theme.ink.opacity(0.72))
                .lineLimit(1)
                .frame(maxWidth: .infinity, minHeight: 32)
                .background(
                    RoundedRectangle(cornerRadius: 999)
                        .fill(on ? Color(rgb: 0xffb101, opacity: 0.18) : Color(rgb: 0xfff8eb, opacity: 0.45))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 999)
                        .stroke(on ? Color(rgb: 0xffb101, opacity: 0.75) : theme.border, lineWidth: 0.5)
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func menuRow(_ label: String, detail: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Text(label)
                    .font(.system(size: 16))
                    .foregroundStyle(theme.ink)
                    .lineLimit(1)
                Spacer(minLength: 8)
                if let detail {
                    Text(detail)
                        .font(.system(size: 12))
                        .foregroundStyle(theme.ink.opacity(0.55))
                        .lineLimit(1)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.bottom, 2)
    }

    /// 「1.2.3 (45)」
    static var versionLabel: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "—"
        let build = info?["CFBundleVersion"] as? String
        return build.map { "\(short) (\($0))" } ?? short
    }
}
