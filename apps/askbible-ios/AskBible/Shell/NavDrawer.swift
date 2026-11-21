import SwiftUI

/// 首页左上角的用户菜单，对齐 RN `ShellNavDrawer`：自左侧滑出、宽度 80%、羊皮卷底。
/// 行样式来自 `shellNavDrawerMenuStyles`（圆角 10、内边 12 × 10、正文 16、右侧细节 12）。
struct NavDrawerView: View {
    @AppStorage("askbible.appearance") private var appearance = "system"
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
    var onOpenMusic: () -> Void = {}
    /// 每日读经提醒：开关 + 当前时间（点一下开面板改时间）
    var reminderEnabled = false
    var reminderTime = "07:00"
    var onToggleReminder: () -> Void = {}
    var onPickReminderTime: () -> Void = {}
    /// 检查更新（手动检查客户端版本与离线包热更）
    var updateDetail: String? = nil
    var onCheckUpdates: () -> Void = {}

    /// 删除账户（只在登录后出；二次确认在壳里弹）
    var onDeleteAccount: () -> Void = {}
    var onClose: () -> Void = {}

    @Environment(\.parchment) private var theme
    private static let supportEmail = "hello@askbible.me"

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .bottom) {
                Color.black.opacity(0.42)
                    .ignoresSafeArea()
                    .onTapGesture { onClose() }

                VStack(alignment: .leading, spacing: 0) {
                    Capsule()
                        .fill(theme.ink.opacity(0.24))
                        .frame(width: 38, height: 4)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 10)
                        .padding(.bottom, 6)

                    header
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 14) {
                            settingsGroup(AppLocale.pick("阅读与陪伴", "Reading & Companion", locale)) {
                                localeRow
                                Divider().overlay(theme.border)
                                appearanceRow
                                Divider().overlay(theme.border)
                                menuRow(SiteCopy.t("native.bibleVersion", locale), detail: "\(translationLabel) \u{203A}", action: onOpenTranslations)
                                Divider().overlay(theme.border)
                                reminderRow
                            }

                            settingsGroup(AppLocale.pick("账号与云端同步", "Account & Sync", locale)) {
                                if let userName {
                                    menuRow(SiteCopy.t("native.signedIn", locale), detail: userName, action: onClose)
                                    if let syncDetail {
                                        Divider().overlay(theme.border)
                                        menuRow(SiteCopy.t("native.readingSync", locale), detail: syncDetail, action: onClose)
                                    }
                                    Divider().overlay(theme.border)
                                    menuRow(SiteCopy.t("auth.drawerLogout", locale), action: onLogout)
                                } else {
                                    menuRow(SiteCopy.t("auth.pageTitle", locale), detail: "\u{203A}", action: onLogin)
                                }
                            }

                            settingsGroup(AppLocale.pick("全局字号与支持", "Display & Support", locale)) {
                                AppTextSizePicker(locale: locale)
                                Divider().overlay(theme.border)
                                menuRow(SiteCopy.t("native.checkForUpdates", locale), detail: updateDetail ?? Self.versionWithTimeLabel, action: onCheckUpdates)
                                Divider().overlay(theme.border)
                                menuRow(SiteCopy.t("native.sendFeedback", locale), detail: Self.supportEmail, action: onFeedback)
                            }

                            if userName != nil {
                                Button(action: onDeleteAccount) {
                                    Text(SiteCopy.t("native.deleteAccount", locale))
                                        .askFont(size: 12)
                                        .foregroundStyle(theme.ink.opacity(0.42))
                                        .frame(maxWidth: .infinity, alignment: .center)
                                        .padding(.vertical, 6)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }

                            Button(action: onCheckUpdates) {
                                Text(SiteCopy.t("native.appVersion", locale).replacingOccurrences(of: "{{version}}", with: Self.versionWithTimeLabel))
                                    .askFont(size: 11)
                                    .foregroundStyle(theme.ink.opacity(0.42))
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .padding(.bottom, 8)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.bottom, 12)
                    }
                }
                .padding(.horizontal, 18)
                .padding(.bottom, max(geo.safeAreaInsets.bottom, 16))
                .frame(maxWidth: 500)
                .frame(maxHeight: geo.size.height * 0.84)
                .background(ParchmentBackground(theme: theme))
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 26, bottomLeadingRadius: 0, bottomTrailingRadius: 0, topTrailingRadius: 26, style: .continuous))
                .askFloatingShadow(.overlay)
                .ignoresSafeArea(edges: .bottom)
            }
        }
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }

    @ViewBuilder
    private func settingsGroup<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .askFont(size: 12, weight: .semibold)
                .foregroundStyle(theme.muted)
                .padding(.horizontal, 4)
            VStack(alignment: .leading, spacing: 0) {
                content()
            }
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(theme.border, lineWidth: 1))
        }
    }

    private var header: some View {
        HStack {
            Text(AppLocale.pick("偏好设置", "Preferences", locale))
                .askFont(size: 18, weight: .bold)
                .foregroundStyle(theme.ink)
            Spacer()
            Button(action: onClose) {
                Text(SiteCopy.t("native.done", locale))
                    .askFont(size: 15, weight: .semibold)
                    .foregroundStyle(theme.accentOt)
                    .frame(minWidth: 44, minHeight: 40, alignment: .trailing)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.bottom, 10)
    }

    /// 每日读经提醒：左边开关（点文字切换），右边时间（点时间改）
    private var reminderRow: some View {
        HStack(spacing: 8) {
            Button(action: onToggleReminder) {
                HStack(spacing: 8) {
                    Text(SiteCopy.t("native.reminderTitle", locale))
                        .askFont(size: 16)
                        .foregroundStyle(theme.ink)
                        .lineLimit(1)
                    Text(SiteCopy.t(reminderEnabled ? "native.reminderOn" : "native.reminderOff", locale))
                        .askFont(size: 11, weight: .semibold)
                        .foregroundStyle(reminderEnabled ? Color(parchment: 0x784b1e) : theme.ink.opacity(0.5))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(
                            Capsule().fill(reminderEnabled ? Color(rgb: 0xffb101, opacity: 0.22) : Color(parchment: 0xfff8eb, opacity: 0.5))
                        )
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Spacer(minLength: 8)
            Button(action: onPickReminderTime) {
                Text(reminderTime)
                    .askFont(size: 13, weight: .semibold)
                    .foregroundStyle(theme.ink.opacity(0.7))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    /// 语言行：RN 是「语言 + EN / 繁 / 简」三个胶囊，原生多一个「跟随系统」
    private var localeRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(SiteCopy.t("nav.language", locale))
                .askFont(size: 16)
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

    private var appearanceRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(SiteCopy.t("native.appearance", locale))
                .askFont(size: 16)
                .foregroundStyle(theme.ink)
            HStack(spacing: 6) {
                ForEach([("system", "native.followSystem"), ("light", "native.appearanceLight"), ("dark", "native.appearanceDark")], id: \.0) { mode, key in
                    let on = appearance == mode
                    Button { appearance = mode } label: {
                        Text(SiteCopy.t(key, locale))
                            .askFont(size: 12, weight: .semibold)
                            .foregroundStyle(on ? Color(parchment: 0x784b1e) : theme.ink.opacity(0.72))
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, minHeight: 32)
                            .background(
                                RoundedRectangle(cornerRadius: 999)
                                    .fill(on ? Color(rgb: 0xffb101, opacity: 0.18) : Color(parchment: 0xfff8eb, opacity: 0.45))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 999)
                                    .stroke(on ? Color(rgb: 0xffb101, opacity: 0.75) : theme.border, lineWidth: 0.5)
                            )
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
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
                .askFont(size: 12, weight: .semibold)
                .foregroundStyle(on ? Color(parchment: 0x784b1e) : theme.ink.opacity(0.72))
                .lineLimit(1)
                .frame(maxWidth: .infinity, minHeight: 32)
                .background(
                    RoundedRectangle(cornerRadius: 999)
                        .fill(on ? Color(rgb: 0xffb101, opacity: 0.18) : Color(parchment: 0xfff8eb, opacity: 0.45))
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
                    .askFont(size: 16)
                    .foregroundStyle(theme.ink)
                    .lineLimit(1)
                Spacer(minLength: 8)
                if let detail {
                    Text(detail)
                        .askFont(size: 12)
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

    static func formatTimestamp(_ date: Date = Date()) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = .current
        fmt.dateFormat = "yyyy-MM-dd HH:mm"
        return fmt.string(from: date)
    }

    static var versionWithTimeLabel: String {
        let ver = versionLabel
        if let execPath = Bundle.main.executablePath,
           let attrs = try? FileManager.default.attributesOfItem(atPath: execPath),
           let modDate = attrs[.modificationDate] as? Date {
            return "\(ver) · \(formatTimestamp(modDate))"
        }
        return ver
    }
}
