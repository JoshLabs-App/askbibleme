import SwiftUI

/// 登录页（DECISIONS D-44：全屏羊皮卷底、窄栏版心，Apple 原生一键登录 + 6 位邮箱验证码无密码登录/自动建号）。
struct LoginView: View {
    @ObservedObject var auth: MemberAuthStore
    let locale: AppLocale
    var onBack: () -> Void
    var onRegister: () -> Void = {}
    var onDone: () -> Void

    @StateObject private var social = SocialSignInState()

    var body: some View {
        AuthPage(locale: locale, title: SiteCopy.t("auth.pageTitle", locale), onBack: onBack) {
            SocialSignInButtons(auth: auth, locale: locale, state: social, onDone: onDone)
            EmailOtpForm(auth: auth, locale: locale, externalBusy: social.busy, onBeforeSubmit: { social.clearErrors() }, onDone: onDone)
        }
    }
}

/// 兼容旧路由入口：无密码 6 位验证码已合并登录与新账号自动创建，保持同一低认知负荷页面
struct RegisterView: View {
    @ObservedObject var auth: MemberAuthStore
    let locale: AppLocale
    var onBack: () -> Void
    var onLogin: () -> Void = {}
    var onDone: () -> Void

    var body: some View {
        LoginView(auth: auth, locale: locale, onBack: onBack, onRegister: onLogin, onDone: onDone)
    }
}

/// 登录页与欢迎页共用的 6 位邮箱验证码表单（支持 iOS 系统 `.oneTimeCode` 短信/邮件自动填充与 45 秒重发倒计时）
struct EmailOtpForm: View {
    @ObservedObject var auth: MemberAuthStore
    let locale: AppLocale
    var externalBusy: Bool = false
    var onBeforeSubmit: () -> Void = {}
    var onDone: () -> Void

    @State private var email = ""
    @State private var code = ""
    @State private var stepSent = false
    @State private var pending = false
    @State private var error: String?
    @State private var cooldown = 0
    @Environment(\.parchment) private var theme

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !stepSent {
                AuthField(
                    label: SiteCopy.t("auth.email", locale),
                    text: $email,
                    locale: locale,
                    keyboard: .emailAddress,
                    contentType: .emailAddress
                )
                if let error { AuthErrorText(error, locale: locale) }
                AuthSubmit(title: SiteCopy.t("native.otpSendCode", locale), pending: pending, locale: locale) {
                    sendCode()
                }
            } else {
                Text(SiteCopy.f("native.otpSentTo", ["email": email.trimmingCharacters(in: .whitespacesAndNewlines)], locale))
                    .askFont(size: 13)
                    .lineSpacing(4)
                    .foregroundStyle(theme.muted)
                    .padding(.top, 6)
                AuthField(
                    label: SiteCopy.t("native.otpCodeLabel", locale),
                    text: Binding(
                        get: { code },
                        set: { next in
                            let digits = String(next.filter(\.isNumber).prefix(6))
                            code = digits
                        }
                    ),
                    locale: locale,
                    keyboard: .numberPad,
                    contentType: .oneTimeCode
                )
                if let error { AuthErrorText(error, locale: locale) }
                AuthSubmit(title: SiteCopy.t("native.otpVerifySubmit", locale), pending: pending, locale: locale) {
                    verifyCode()
                }
                HStack {
                    Button {
                        guard !pending, cooldown == 0 else { return }
                        sendCode()
                    } label: {
                        Text(cooldown > 0
                             ? SiteCopy.f("native.otpResendIn", ["n": "\(cooldown)"], locale)
                             : SiteCopy.t("native.otpResend", locale))
                            .askFont(size: 13, weight: .medium)
                            .foregroundStyle(cooldown > 0 ? theme.faint : theme.muted)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    .disabled(pending || cooldown > 0)

                    Spacer()

                    Button {
                        guard !pending else { return }
                        stepSent = false
                        code = ""
                        error = nil
                    } label: {
                        Text(SiteCopy.t("native.otpChangeEmail", locale))
                            .askFont(size: 13, weight: .medium)
                            .underline()
                            .foregroundStyle(theme.muted)
                            .padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                }
                .padding(.top, 4)
            }
        }
        .onReceive(timer) { _ in
            if cooldown > 0 { cooldown -= 1 }
        }
    }

    private func sendCode() {
        guard !pending, !externalBusy else { return }
        let clean = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard clean.contains("@"), clean.contains(".") else {
            error = SiteCopy.t("native.otpInvalidEmail", locale)
            return
        }
        pending = true; error = nil; onBeforeSubmit()
        Task {
            let err = await auth.sendOtp(email: clean, locale: locale.rawValue)
            pending = false
            if let err {
                error = err == "network" ? SiteCopy.t("auth.errorNetwork", locale) : SiteCopy.localizeKnown(err, locale)
            } else {
                email = clean
                stepSent = true
                cooldown = 45
            }
        }
    }

    private func verifyCode() {
        guard !pending, !externalBusy else { return }
        let digits = code.filter(\.isNumber)
        guard digits.count == 6 else {
            error = SiteCopy.t("native.otpInvalidCode", locale)
            return
        }
        pending = true; error = nil; onBeforeSubmit()
        Task {
            let err = await auth.verifyOtp(email: email, code: digits, locale: locale.rawValue)
            pending = false
            if let err {
                error = err == "network" ? SiteCopy.t("auth.errorNetwork", locale) : SiteCopy.localizeKnown(err, locale)
            } else {
                onDone()
            }
        }
    }
}

final class SocialSignInState: ObservableObject {
    @Published var applePending = false
    @Published var appleError: String?
    var busy: Bool { applePending }
    func clearErrors() { appleError = nil }
}

/// 系统原生 Apple 一键登录 + 「或」分隔线
struct SocialSignInButtons: View {
    @ObservedObject var auth: MemberAuthStore
    let locale: AppLocale
    @ObservedObject var state: SocialSignInState
    var onDone: () -> Void

    var body: some View {
        VStack(spacing: 6) {
            AuthProviderButton(
                label: SiteCopy.t("auth.continueWithApple", locale),
                pending: state.applePending,
                disabled: state.busy,
                locale: locale
            ) { apple() }
            if let e = state.appleError { AuthOAuthError(e, locale: locale) }
        }
        AuthMethodDivider(locale: locale)
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

private struct AuthProviderButton: View {
    let label: String
    let pending: Bool
    let disabled: Bool
    let locale: AppLocale
    let action: () -> Void
    @Environment(\.parchment) private var theme

    var body: some View {
        Button(action: { if !(disabled || pending) { action() } }) {
            ZStack {
                if pending {
                    ProgressView().tint(theme.ink)
                } else {
                    HStack(spacing: 0) {
                        AppleBrandMark(color: theme.ink)
                            .frame(width: 20, height: 20)
                        Text(locale.zh(label)).askFont(size: 15, weight: .semibold).lineSpacing(5).foregroundStyle(theme.ink)
                            .multilineTextAlignment(.center).lineLimit(2).frame(maxWidth: .infinity)
                        Color.clear.frame(width: 20, height: 20)
                    }
                    .padding(.horizontal, 16)
                }
            }
            .frame(maxWidth: .infinity).frame(minHeight: 48)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(parchment: 0xF8F1E3, opacity: 0.72)))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(theme.border, lineWidth: 0.5))
        }
        .buttonStyle(AuthPressStyle())
        .disabled(disabled || pending)
        .opacity(disabled || pending ? 0.55 : 1)
    }
}

private struct AuthPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.opacity(configuration.isPressed ? 0.88 : 1)
    }
}

private struct AuthOAuthError: View {
    let text: String
    let locale: AppLocale
    init(_ text: String, locale: AppLocale) { self.text = text; self.locale = locale }
    var body: some View {
        Text(locale.zh(text)).askFont(size: 13, weight: .medium).lineSpacing(5).foregroundStyle(Color(rgb: 0xB42318))
            .multilineTextAlignment(.center).frame(maxWidth: .infinity)
    }
}

private struct AuthMethodDivider: View {
    let locale: AppLocale
    @Environment(\.parchment) private var theme
    var body: some View {
        HStack(spacing: 12) {
            Rectangle().fill(theme.border).frame(height: 0.5)
            Text(SiteCopy.t("auth.orDivider", locale)).askFont(size: 11, weight: .semibold).tracking(0.6).textCase(.uppercase).foregroundStyle(theme.faint)
            Rectangle().fill(theme.border).frame(height: 0.5)
        }
        .padding(.vertical, 6)
    }
}

private struct AuthPage<Content: View>: View {
    let locale: AppLocale
    let title: String
    var onBack: () -> Void
    @ViewBuilder var content: () -> Content
    @Environment(\.parchment) private var theme

    var body: some View {
        GeometryReader { geo in
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    Button(action: onBack) {
                        Text(SiteCopy.t("pages.read.chapterChromeBack", locale)).askFont(size: 14, weight: .medium).foregroundStyle(theme.faint).padding(.vertical, 8)
                    }
                    .buttonStyle(.plain)
                    Text(locale.zh(title)).askFont(size: 18, weight: .semibold).foregroundStyle(theme.ink)
                        .frame(maxWidth: .infinity).padding(.top, 8)
                    Text(SiteCopy.t("native.otpIntro", locale)).askFont(size: 14).lineSpacing(4).foregroundStyle(theme.muted)
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

struct AuthField: View {
    let label: String
    @Binding var text: String
    let locale: AppLocale
    var keyboard: UIKeyboardType = .default
    var secure = false
    var contentType: UITextContentType? = nil
    @Environment(\.parchment) private var theme

    var body: some View {
        Text(locale.zh(label)).askFont(size: 15, weight: .semibold).foregroundStyle(theme.muted).padding(.top, 10)
        Group {
            if secure { SecureField("", text: $text) } else { TextField("", text: $text) }
        }
        .askFont(size: 17)
        .foregroundStyle(theme.ink)
        .keyboardType(keyboard)
        .textContentType(contentType)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .padding(.horizontal, 14)
        .frame(minHeight: 50)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color(parchment: 0xF8F1E3, opacity: 0.72)))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(theme.border, lineWidth: 0.5))
    }
}

struct AuthErrorText: View {
    let text: String
    let locale: AppLocale
    init(_ text: String, locale: AppLocale) { self.text = text; self.locale = locale }
    var body: some View {
        Text(SiteCopy.localizeKnown(text, locale)).askFont(size: 13, weight: .medium).foregroundStyle(Color(rgb: 0xB42318))
            .multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.top, 8)
    }
}

struct AuthSubmit: View {
    let title: String
    let pending: Bool
    let locale: AppLocale
    let action: () -> Void
    @Environment(\.parchment) private var theme
    var body: some View {
        Button(action: action) {
            ZStack {
                if pending { ProgressView().tint(theme.ink) }
                else { Text(locale.zh(title)).askFont(size: 15, weight: .semibold).foregroundStyle(theme.ink) }
            }
            .frame(maxWidth: .infinity).frame(minHeight: 48)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color(rgb: 0xffb101, opacity: 0.22)))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(theme.border, lineWidth: 0.5))
        }
        .buttonStyle(.plain).disabled(pending).opacity(pending ? 0.55 : 1).padding(.top, 16)
    }
}

struct AuthLink: View {
    let title: String
    let locale: AppLocale
    let action: () -> Void
    @Environment(\.parchment) private var theme
    var body: some View {
        Button(action: action) {
            Text(locale.zh(title)).askFont(size: 13, weight: .medium).underline().foregroundStyle(theme.muted)
                .frame(maxWidth: .infinity).padding(.vertical, 8)
        }
        .buttonStyle(.plain).padding(.top, 14)
    }
}
