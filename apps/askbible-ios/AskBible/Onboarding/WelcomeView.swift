import SwiftUI

/// 首次打开的欢迎页，对齐 RN `/welcome`（OnboardingDevotionIntro）：选语言 + 登录 / 注册，右上「略过」。
/// RN 那一版中间还有「每日读经提醒」，原生还没有本地通知，这一段先不做。
struct WelcomeView: View {
    @ObservedObject var auth: MemberAuthStore
    let locale: AppLocale
    let localeOverride: AppLocale?
    var onSetLocale: (AppLocale?) -> Void = { _ in }
    var onDone: () -> Void = {}

    @State private var email = ""
    @State private var password = ""
    /// nil = 没在提交；否则是正在跑的那个动作
    @State private var pendingAction: Action?
    @State private var error: String?
    /// 点了「注册」先展开昵称，再点一次才提交（RN OnboardingWelcomeLoginPanel 的做法）
    @State private var registering = false
    @State private var name = ""
    @StateObject private var social = SocialSignInState()

    private let theme = Parchment.light

    var body: some View {
        ZStack {
            ParchmentBackground(theme: theme).ignoresSafeArea()
            GeometryReader { geo in
                VStack(spacing: 0) {
                    HStack {
                        Spacer()
                        Button(action: onDone) {
                            Text(SiteCopy.t("onboarding.welcome.loginSkip", locale))
                                .font(.system(size: 17))
                                .foregroundStyle(theme.muted)
                                .frame(minHeight: 32)
                                .padding(.horizontal, 4)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .disabled(pending)
                    }
                    .padding(.top, geo.safeAreaInsets.top + 6)
                    .padding(.horizontal, 20)

                    // 内容不满屏时整体居中（RN contentInner justifyContent center）
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 18) {
                            brand
                            language
                            login
                        }
                        .frame(maxWidth: 420, alignment: .leading)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .frame(maxWidth: .infinity, minHeight: geo.size.height - geo.safeAreaInsets.top - 44, alignment: .center)
                    }
                }
            }
        }
    }

    /// 抬头：应用名 + 一句引言，欢迎页不该只有一堆输入框
    private var brand: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(SiteCopy.t("native.welcomeTitle", locale))
                .font(.system(size: 28, weight: .bold))
                .foregroundStyle(theme.ink)
            Text(SiteCopy.t("onboarding.welcome.loginIntro", locale))
                .font(.system(size: 14))
                .lineSpacing(4)
                .foregroundStyle(theme.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var language: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(SiteCopy.t("onboarding.welcome.languageTitle", locale))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(theme.muted)
            HStack(spacing: 0) {
                chip(nil, label: SiteCopy.t("native.followSystem", locale))
                chip(.zhCN, label: AppLocale.zhCN.settingLabel)
                chip(.zhTW, label: AppLocale.zhTW.settingLabel)
                chip(.en, label: AppLocale.en.settingLabel)
            }
            .frame(minHeight: 50)
            .background(RoundedRectangle(cornerRadius: 10).fill(theme.surface))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(theme.border, lineWidth: 0.5))
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    private func chip(_ value: AppLocale?, label: String) -> some View {
        let on = localeOverride == value
        return Button { onSetLocale(value) } label: {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(on ? theme.ink : theme.muted)
                .lineLimit(1)
                .frame(maxWidth: .infinity, minHeight: 50)
                .background(on ? Color(rgb: 0xffb101, opacity: 0.18) : Color.clear)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(pending)
    }

    private var login: some View {
        VStack(alignment: .leading, spacing: 10) {
            // 标题那句引言已经说了「登录或注册」，这里不再重复一遍
            SocialSignInButtons(auth: auth, locale: locale, state: social, onDone: onDone)
            AuthField(label: SiteCopy.t("auth.email", locale), text: $email, locale: locale,
                      keyboard: .emailAddress, contentType: .emailAddress)
            if registering {
                AuthField(label: SiteCopy.t("auth.registerName", locale), text: $name, locale: locale,
                          contentType: .name)
            }
            AuthField(label: SiteCopy.t("auth.password", locale), text: $password, locale: locale,
                      secure: true, contentType: .password)
            if let error { AuthErrorText(error, locale: locale) }
            // RN actionRow：登录 / 注册并排，各占一半
            HStack(spacing: 10) {
                actionButton(SiteCopy.t("auth.submit", locale), action: .login) { submit(.login) }
                actionButton(SiteCopy.t("auth.registerSubmit", locale), action: .register) {
                    if registering { submit(.register) } else { registering = true }
                }
            }
            .padding(.top, 6)
        }
    }

    private func actionButton(_ title: String, action: Action, run: @escaping () -> Void) -> some View {
        Button(action: run) {
            ZStack {
                if pendingAction == action { ProgressView().tint(theme.ink) }
                else {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(theme.ink)
                }
            }
            .frame(maxWidth: .infinity).frame(minHeight: 48)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(rgb: 0xFFFCF5, opacity: 0.62)))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(theme.border, lineWidth: 0.5))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(pending)
        .opacity(pending ? 0.55 : 1)
    }

    enum Action { case login, register }
    private var pending: Bool { pendingAction != nil }

    private func submit(_ action: Action) {
        guard !pending, !social.busy else { return }
        pendingAction = action; error = nil; social.clearErrors()
        Task {
            let err: String?
            switch action {
            case .login: err = await auth.signIn(email: email, password: password, locale: locale.rawValue)
            case .register: err = await auth.register(email: email, password: password, name: name, locale: locale.rawValue)
            }
            pendingAction = nil
            if let err {
                error = err == "network" ? SiteCopy.t("auth.errorNetwork", locale) : SiteCopy.localizeKnown(err, locale)
            } else {
                onDone()
            }
        }
    }
}

/// 欢迎页只出一次（RN `onboardingCompleted`）
enum OnboardingPrefs {
    private static let key = "onboardingCompleted"

    static var completed: Bool { UserDefaults.standard.string(forKey: key) == "1" }
    static func complete() { UserDefaults.standard.set("1", forKey: key) }
    static func reset() { UserDefaults.standard.removeObject(forKey: key) }
}
