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
    @State private var pending = false
    @State private var error: String?
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

                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 16) {
                            language
                            login
                        }
                        .frame(maxWidth: 420)
                        .padding(.horizontal, 20)
                        .padding(.top, 12)
                        .padding(.bottom, geo.safeAreaInsets.bottom + 24)
                        .frame(maxWidth: .infinity)
                    }
                }
            }
        }
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
        VStack(alignment: .leading, spacing: 12) {
            Text(SiteCopy.t("onboarding.welcome.loginTitle", locale))
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(theme.ink)
            Text(SiteCopy.t("onboarding.welcome.loginIntro", locale))
                .font(.system(size: 14))
                .foregroundStyle(theme.muted)
            SocialSignInButtons(auth: auth, locale: locale, state: social, onDone: onDone)
            AuthField(label: SiteCopy.t("auth.email", locale), text: $email, locale: locale,
                      keyboard: .emailAddress, contentType: .emailAddress)
            AuthField(label: SiteCopy.t("auth.password", locale), text: $password, locale: locale,
                      secure: true, contentType: .password)
            if let error { AuthErrorText(error, locale: locale) }
            AuthSubmit(title: SiteCopy.t("auth.submit", locale), pending: pending, locale: locale) { submit() }
        }
    }

    private func submit() {
        guard !pending, !social.busy else { return }
        pending = true; error = nil; social.clearErrors()
        Task {
            let err = await auth.signIn(email: email, password: password, locale: locale.rawValue)
            pending = false
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
