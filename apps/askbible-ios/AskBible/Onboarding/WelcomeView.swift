import SwiftUI

/// 首次打开的欢迎页。
///
/// Josh 2026-09-18（与 ChatGPT 过了一轮版面评审后定）：这一页不再是登录页。
/// App 的主场景排序是 灵修 → 每日读经 → 圣经目录，登录只是「同步进度」的附属能力，
/// 所以首屏只承担一件事：告诉用户这是什么，并让他立刻开始今日灵修（= 首页）。
///
/// 于是原来的「选语言 + Google/Apple + 邮箱密码 + 登录/注册」全部让位：
/// - 语言收到右上角轻量菜单（仍在首屏，因为它联动译本与首页金句，第一次进来选一次比藏进设置合理）
/// - 登录整套收进 sheet，邮箱密码再折叠一层，Apple 在 Google 之前（iOS 习惯）
/// - 「注册」降成文字链接，不再与「登录」并排等重
struct WelcomeView: View {
    @ObservedObject var auth: MemberAuthStore
    let locale: AppLocale
    let localeOverride: AppLocale?
    var onSetLocale: (AppLocale?) -> Void = { _ in }
    var onDone: () -> Void = {}

    @State private var showSignIn = false

    @Environment(\.parchment) private var theme

    var body: some View {
        ZStack {
            ParchmentBackground(theme: theme).ignoresSafeArea()
            // 留白不均分：品牌落在视线上三分之一，主按钮留在拇指区，中间那段空是「呼吸区」
            GeometryReader { geo in
                VStack(spacing: 0) {
                    topBar
                    Spacer(minLength: 0).frame(height: geo.size.height * 0.12)
                    brand
                    Spacer(minLength: 24)
                    bottom
                }
                .frame(maxWidth: 420)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 24)
            }
        }
        .sheet(isPresented: $showSignIn) {
            WelcomeSignInSheet(auth: auth, locale: locale) {
                showSignIn = false
                onDone()
            }
        }
    }

    /// 右上角只放两个轻量入口：语言、登录。都不是主任务。
    private var topBar: some View {
        HStack(spacing: 14) {
            Spacer()
            Menu {
                Picker("", selection: Binding(get: { localeOverride }, set: { onSetLocale($0) })) {
                    Text(SiteCopy.t("native.followSystem", locale)).tag(AppLocale?.none)
                    Text(AppLocale.zhCN.settingLabel).tag(AppLocale?.some(.zhCN))
                    Text(AppLocale.zhTW.settingLabel).tag(AppLocale?.some(.zhTW))
                    Text(AppLocale.en.settingLabel).tag(AppLocale?.some(.en))
                }
            } label: {
                HStack(spacing: 4) {
                    Text(localeOverride?.settingLabel ?? SiteCopy.t("native.followSystem", locale))
                        .font(.system(size: 15))
                    Image(systemName: "chevron.down").font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(theme.muted)
                .frame(minHeight: 40)
                .contentShape(Rectangle())
            }
            Button { showSignIn = true } label: {
                Text(SiteCopy.t("native.welcomeSignIn", locale))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(theme.muted)
                    .frame(minHeight: 40)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.top, 4)
    }

    private var brand: some View {
        VStack(spacing: 10) {
            Text(SiteCopy.t("native.welcomeTitle", locale))
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(theme.ink)
                .multilineTextAlignment(.center)
            Text(SiteCopy.t("native.welcomeTagline", locale))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(theme.accentOt)
            Text(SiteCopy.t("native.welcomeLead", locale))
                .font(.system(size: 14))
                .lineSpacing(4)
                .foregroundStyle(theme.muted)
                .multilineTextAlignment(.center)
        }
    }

    /// 唯一主动作 + 一句同步提示。登录不在这条路径上。
    private var bottom: some View {
        VStack(spacing: 14) {
            Button(action: onDone) {
                Text(SiteCopy.t("native.welcomeStart", locale))
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(theme.ink)
                    .frame(maxWidth: .infinity).frame(minHeight: 52)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(rgb: 0xffb101, opacity: 0.22)))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(theme.border, lineWidth: 0.5))
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Text(SiteCopy.t("native.welcomeSyncHint", locale))
                .font(.system(size: 12))
                .lineSpacing(3)
                .foregroundStyle(theme.muted)
                .multilineTextAlignment(.center)
        }
        .padding(.bottom, 28)
    }
}

/// 登录整套（第三方 + 折叠的邮箱密码）。从欢迎页右上角「登录」拉起，不占首屏。
struct WelcomeSignInSheet: View {
    @ObservedObject var auth: MemberAuthStore
    let locale: AppLocale
    var onDone: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var name = ""
    /// 邮箱密码默认折叠（ChatGPT 评审 P0：三种登录方式同时展开，首屏信息量过大）
    @State private var emailOpen = false
    @State private var registering = false
    @State private var pendingAction: Action?
    @State private var error: String?
    @StateObject private var social = SocialSignInState()

    @Environment(\.dismiss) private var dismiss
    @Environment(\.parchment) private var theme

    var body: some View {
        ZStack {
            ParchmentBackground(theme: theme).ignoresSafeArea()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 12) {
                    Text(SiteCopy.t("auth.pageTitle", locale))
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(theme.ink)
                        .padding(.bottom, 2)
                    SocialSignInButtons(auth: auth, locale: locale, state: social, onDone: onDone)
                    if emailOpen {
                        emailForm
                    } else {
                        Button { emailOpen = true } label: {
                            Text(SiteCopy.t("native.welcomeEmailSignIn", locale))
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(theme.ink)
                                .frame(maxWidth: .infinity).frame(minHeight: 48)
                                .background(RoundedRectangle(cornerRadius: 12).fill(Color(parchment: 0xF8F1E3, opacity: 0.72)))
                                .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(theme.border, lineWidth: 0.5))
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: 420, alignment: .leading)
                .padding(.horizontal, 24)
                .padding(.top, 24)
                .padding(.bottom, 32)
                .frame(maxWidth: .infinity)
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var emailForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            AuthField(label: SiteCopy.t("auth.email", locale), text: $email, locale: locale,
                      keyboard: .emailAddress, contentType: .emailAddress)
            if registering {
                AuthField(label: SiteCopy.t("auth.registerName", locale), text: $name, locale: locale,
                          contentType: .name)
            }
            AuthField(label: SiteCopy.t("auth.password", locale), text: $password, locale: locale,
                      secure: true, contentType: registering ? .newPassword : .password)
            if let error { AuthErrorText(error, locale: locale) }
            AuthSubmit(title: SiteCopy.t(registering ? "auth.registerSubmit" : "auth.submit", locale),
                       pending: pendingAction != nil, locale: locale) {
                submit(registering ? .register : .login)
            }
            // 注册是文字链接，不再和登录并排等重
            AuthLink(title: SiteCopy.t(registering ? "auth.registerGoLogin" : "native.welcomeNoAccount", locale),
                     locale: locale) {
                registering.toggle(); error = nil
            }
        }
    }

    enum Action { case login, register }

    private func submit(_ action: Action) {
        guard pendingAction == nil, !social.busy else { return }
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
