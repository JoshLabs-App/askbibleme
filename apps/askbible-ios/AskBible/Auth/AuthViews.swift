import SwiftUI

/// 登录 / 注册页（RN MemberLoginScreen / MemberRegisterScreen + AuthParchmentScreen + authFormSurface）：
/// 全屏羊皮卷底、窄栏版心，返回链接 → 标题 → 引言 → Google / Apple 按钮 → 「或」分隔 → 邮箱 / 密码（注册多一个昵称）→ 提交 → 切换链接。
/// Google 走 Supabase 浏览器 OAuth（RN googleOAuthBrowser 分支），Apple 走系统登录（RN expo-apple-authentication）。
struct LoginView: View {
    @ObservedObject var auth: MemberAuthStore
    let locale: AppLocale
    var onBack: () -> Void
    var onRegister: () -> Void
    var onDone: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var pending = false
    @State private var error: String?
    @StateObject private var social = SocialSignInState()

    var body: some View {
        AuthPage(locale: locale, title: SiteCopy.t("auth.pageTitle", locale), onBack: onBack) {
            SocialSignInButtons(auth: auth, locale: locale, state: social, onDone: onDone)
            AuthField(label: SiteCopy.t("auth.email", locale), text: $email, locale: locale, keyboard: .emailAddress, contentType: .emailAddress)
            AuthField(label: SiteCopy.t("auth.password", locale), text: $password, locale: locale, secure: true, contentType: .password)
            if let error { AuthErrorText(error, locale: locale) }
            AuthSubmit(title: SiteCopy.t("auth.submit", locale), pending: pending, locale: locale) { submit() }
            AuthLink(title: SiteCopy.t("auth.loginFooterRegister", locale), locale: locale, action: onRegister)
        }
    }

    private func submit() {
        guard !pending, !social.busy else { return }
        pending = true; error = nil; social.clearErrors()
        Task {
            let err = await auth.signIn(email: email, password: password, locale: locale.rawValue)
            pending = false
            if let err { error = err == "network" ? SiteCopy.t("auth.errorNetwork", locale) : SiteCopy.localizeKnown(err, locale) } else { onDone() }
        }
    }
}

struct RegisterView: View {
    @ObservedObject var auth: MemberAuthStore
    let locale: AppLocale
    var onBack: () -> Void
    var onLogin: () -> Void
    var onDone: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    @State private var pending = false
    @State private var error: String?
    @StateObject private var social = SocialSignInState()

    var body: some View {
        AuthPage(locale: locale, title: SiteCopy.t("auth.registerPageTitle", locale), onBack: onBack) {
            SocialSignInButtons(auth: auth, locale: locale, state: social, onDone: onDone)
            AuthField(label: SiteCopy.t("auth.email", locale), text: $email, locale: locale, keyboard: .emailAddress, contentType: .emailAddress)
            AuthField(label: SiteCopy.t("auth.password", locale), text: $password, locale: locale, secure: true, contentType: .newPassword)
            AuthField(label: SiteCopy.t("auth.registerName", locale), text: $name, locale: locale, contentType: .nickname)
            if let error { AuthErrorText(error, locale: locale) }
            AuthSubmit(title: SiteCopy.t("auth.registerSubmit", locale), pending: pending, locale: locale) { submit() }
            AuthLink(title: SiteCopy.t("auth.registerGoLogin", locale), locale: locale, action: onLogin)
        }
    }

    private func submit() {
        guard !pending, !social.busy else { return }
        pending = true; error = nil; social.clearErrors()
        Task {
            let err = await auth.register(email: email, password: password, name: name, locale: locale.rawValue)
            pending = false
            if let err { error = err == "network" ? SiteCopy.t("auth.errorNetwork", locale) : SiteCopy.localizeKnown(err, locale) } else { onDone() }
        }
    }
}

/// 两个第三方按钮各自的 pending / 错误（RN MemberLoginScreen 的 googlePending / appleError 等）
final class SocialSignInState: ObservableObject {
    @Published var googlePending = false
    @Published var applePending = false
    @Published var googleError: String?
    @Published var appleError: String?
    var busy: Bool { googlePending || applePending }
    func clearErrors() { googleError = nil; appleError = nil }
}

/// RN MemberGoogleSignInButton + MemberAppleSignInButton + MemberAuthMethodDivider（登录 / 注册页共用）
struct SocialSignInButtons: View {
    @ObservedObject var auth: MemberAuthStore
    let locale: AppLocale
    @ObservedObject var state: SocialSignInState
    var onDone: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            AuthProviderButton(variant: .google, label: SiteCopy.t("auth.continueWithGoogle", locale), pending: state.googlePending, disabled: state.busy, locale: locale) { google() }
            if let e = state.googleError { AuthOAuthError(e, locale: locale) }
        }
        VStack(spacing: 6) {
            AuthProviderButton(variant: .apple, label: SiteCopy.t("auth.continueWithApple", locale), pending: state.applePending, disabled: state.busy, locale: locale) { apple() }
            if let e = state.appleError { AuthOAuthError(e, locale: locale) }
        }
        AuthMethodDivider(locale: locale)
    }

    private func google() {
        guard !state.busy else { return }
        state.googlePending = true; state.clearErrors()
        Task {
            let outcome = await auth.signInWithGoogle(locale: locale.rawValue)
            state.googlePending = false
            switch outcome {
            case .done: onDone()
            case .cancelled: break
            case .failed(let msg): state.googleError = msg
            }
        }
    }

    private func apple() {
        guard !state.busy else { return }
        state.applePending = true; state.clearErrors()
        Task {
            let outcome = await auth.signInWithApple(locale: locale.rawValue)
            state.applePending = false
            switch outcome {
            case .done: onDone()
            case .cancelled: break
            case .failed(let msg): state.appleError = msg
            }
        }
    }
}

/// RN OAuthProviderButton：48 高、圆角 12、hairline 边、parchmentControlSurface.fillStrong 底；左 20 槽放品牌标，文字居中，右侧对称留 20 槽
private struct AuthProviderButton: View {
    enum Variant { case google, apple }
    let variant: Variant
    let label: String
    let pending: Bool
    let disabled: Bool
    let locale: AppLocale
    let action: () -> Void
    private let theme = Parchment.light

    var body: some View {
        Button(action: { if !(disabled || pending) { action() } }) {
            ZStack {
                if pending {
                    ProgressView().tint(theme.ink)
                } else {
                    HStack(spacing: 0) {
                        ZStack {
                            if variant == .apple { AppleBrandMark(color: theme.ink) } else { GoogleBrandMark() }
                        }
                        .frame(width: 20, height: 20)
                        Text(locale.zh(label)).font(.system(size: 15, weight: .semibold)).lineSpacing(5).foregroundStyle(theme.ink)
                            .multilineTextAlignment(.center).lineLimit(2).frame(maxWidth: .infinity)
                        Color.clear.frame(width: 20, height: 20)
                    }
                    .padding(.horizontal, 16)
                }
            }
            .frame(maxWidth: .infinity).frame(minHeight: 48)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(rgb: 0xFFFCF5, opacity: 0.62)))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(theme.border, lineWidth: 0.5))
        }
        .buttonStyle(AuthPressStyle())
        .disabled(disabled || pending)
        .opacity(disabled || pending ? 0.55 : 1)
    }
}

/// RN buttonPressed：按下 0.88
private struct AuthPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.88 : 1)
    }
}

/// RN OAuthInlineError：13 号 / 行高 18 / #b42318 居中
private struct AuthOAuthError: View {
    let text: String
    let locale: AppLocale
    init(_ text: String, locale: AppLocale) { self.text = text; self.locale = locale }
    var body: some View {
        Text(locale.zh(text)).font(.system(size: 13, weight: .medium)).lineSpacing(5).foregroundStyle(Color(rgb: 0xB42318))
            .multilineTextAlignment(.center).frame(maxWidth: .infinity)
    }
}

/// RN MemberAuthMethodDivider：hairline 线 —「或」— 线，上下 16
private struct AuthMethodDivider: View {
    let locale: AppLocale
    private let theme = Parchment.light
    var body: some View {
        HStack(spacing: 12) {
            Rectangle().fill(theme.border).frame(height: 0.5)
            Text(SiteCopy.t("auth.orDivider", locale)).font(.system(size: 11, weight: .semibold)).tracking(0.6).textCase(.uppercase).foregroundStyle(theme.faint)
            Rectangle().fill(theme.border).frame(height: 0.5)
        }
        .padding(.vertical, 6)
    }
}

/// 页面骨架：羊皮卷底 + 返回 + 标题 + 引言 + 表单（键盘顶起靠 ScrollView）。
/// 顶部安全区照 PlansListView 的写法：GeometryReader 本身不 ignoresSafeArea（那样 safeAreaInsets 会归零，「返回」就顶进状态栏——Josh 真机 2026-09-09），
/// 只让羊皮卷底铺满，内容按 geo.safeAreaInsets.top 让开刘海。
private struct AuthPage<Content: View>: View {
    let locale: AppLocale
    let title: String
    var onBack: () -> Void
    @ViewBuilder var content: () -> Content
    private let theme = Parchment.light

    var body: some View {
        GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    Button(action: onBack) {
                        Text(SiteCopy.t("pages.read.chapterChromeBack", locale)).font(.system(size: 14, weight: .medium)).foregroundStyle(theme.faint).padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    Text(locale.zh(title)).font(.system(size: 18, weight: .semibold)).foregroundStyle(theme.ink)
                        .frame(maxWidth: .infinity).padding(.top, 8)
                    Text(SiteCopy.t("auth.registerIntro", locale)).font(.system(size: 14)).lineSpacing(4).foregroundStyle(theme.muted)
                        .multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 10)
                    VStack(alignment: .leading, spacing: 10) { content() }.padding(.top, 24)
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, geo.safeAreaInsets.bottom + 24)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(ParchmentBackground(theme: theme).ignoresSafeArea())
        }
    }
}

private struct AuthField: View {
    let label: String
    @Binding var text: String
    let locale: AppLocale
    var keyboard: UIKeyboardType = .default
    var secure = false
    var contentType: UITextContentType? = nil
    private let theme = Parchment.light

    var body: some View {
        Text(locale.zh(label)).font(.system(size: 15, weight: .semibold)).foregroundStyle(theme.muted).padding(.top, 10)
        Group {
            if secure { SecureField("", text: $text) } else { TextField("", text: $text) }
        }
        .font(.system(size: 17))
        .foregroundStyle(theme.ink)
        .keyboardType(keyboard)
        .textContentType(contentType)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .padding(.horizontal, 14)
        .frame(minHeight: 50)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color(rgb: 0xFFFCF5, opacity: 0.62)))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(theme.border, lineWidth: 0.5))
    }
}

private struct AuthErrorText: View {
    let text: String
    let locale: AppLocale
    init(_ text: String, locale: AppLocale) { self.text = text; self.locale = locale }
    var body: some View {
        Text(SiteCopy.localizeKnown(text, locale)).font(.system(size: 13, weight: .medium)).foregroundStyle(Color(rgb: 0xB42318))
            .multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 8)
    }
}

private struct AuthSubmit: View {
    let title: String
    let pending: Bool
    let locale: AppLocale
    let action: () -> Void
    private let theme = Parchment.light
    var body: some View {
        Button(action: action) {
            ZStack {
                if pending { ProgressView().tint(theme.ink) }
                else { Text(locale.zh(title)).font(.system(size: 15, weight: .semibold)).foregroundStyle(theme.ink) }
            }
            .frame(maxWidth: .infinity).frame(minHeight: 48)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(rgb: 0x1C1410, opacity: 0.1)))
        }
        .buttonStyle(.plain).disabled(pending).opacity(pending ? 0.55 : 1).padding(.top, 16)
    }
}

private struct AuthLink: View {
    let title: String
    let locale: AppLocale
    let action: () -> Void
    private let theme = Parchment.light
    var body: some View {
        Button(action: action) {
            Text(locale.zh(title)).font(.system(size: 13, weight: .medium)).underline().foregroundStyle(theme.muted)
                .frame(maxWidth: .infinity).padding(.vertical, 8)
        }
        .buttonStyle(.plain).padding(.top, 14)
    }
}
