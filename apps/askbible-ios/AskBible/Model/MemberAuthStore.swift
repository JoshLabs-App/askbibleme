import Foundation

/// 会员登录状态（RN useMemberAuthProvider + useMemberAuthBootstrap）：本机会话 + 启动时后台校验。
/// 登录 / 注册成功即写会话；退出清会话（服务端 logout 尽力而为）。
@MainActor
final class MemberAuthStore: ObservableObject {
    @Published private(set) var user: MemberUser?
    @Published private(set) var bootstrapped = false
    private var session: MemberSession?
    private let defaults = UserDefaults.standard
    /// 当前会话 token（读经同步用；没登录为 nil）
    var sessionToken: String? { session?.sessionToken }

    init() {
        // 过期但带 refresh_token 的也先算登着（启动后 verifyRemote 会先续期）；RN 是一过期就登出
        if let data = defaults.data(forKey: MemberAuthRules.sessionKey), let s = MemberAuthRules.parseSession(data, allowExpired: true) {
            session = s
            user = s.user
        } else {
            defaults.removeObject(forKey: MemberAuthRules.sessionKey)
        }
        bootstrapped = true
    }

    /// 拿一个还能用的 access token：快到期（2 分钟内）就先用 refresh_token 续；续期被拒（已作废）→ 登出；断网 → 先用旧的
    func ensureFreshToken() async -> String? {
        guard let s = session else { return nil }
        guard MemberAuthRules.secondsUntilExpiry(s) < 120 else { return s.sessionToken }
        guard let rt = s.refreshToken else {
            if MemberAuthRules.secondsUntilExpiry(s) <= 0 { persist(nil); return nil }
            return s.sessionToken
        }
        switch await SupabaseAuthClient.refresh(refreshToken: rt, locale: s.user.locale) {
        case .ok(let next):
            var merged = next
            merged.user.createdAt = next.user.createdAt ?? s.user.createdAt
            persist(merged)
            return merged.sessionToken
        case .failed(_, let code):
            if code == "network" { return MemberAuthRules.secondsUntilExpiry(s) > 0 ? s.sessionToken : nil }
            persist(nil)
            return nil
        }
    }

    private func persist(_ s: MemberSession?) {
        session = s
        user = s?.user
        if let s, let data = try? JSONEncoder().encode(s) { defaults.set(data, forKey: MemberAuthRules.sessionKey) }
        else { defaults.removeObject(forKey: MemberAuthRules.sessionKey) }
    }

    /// 启动后校验会话：token 作废就清掉；网络不通保留本机会话（RN 同）
    func verifyRemote() async {
        guard session != nil, let token = await ensureFreshToken(), let s = session else { return }
        do {
            if let remote = try await SupabaseAuthClient.verify(token: token) {
                var merged = remote
                merged.createdAt = remote.createdAt ?? s.user.createdAt
                persist(MemberSession(sessionToken: token, expiresAt: s.expiresAt, user: merged, refreshToken: s.refreshToken))
            } else if let rt = s.refreshToken, case .ok(let next) = await SupabaseAuthClient.refresh(refreshToken: rt, locale: s.user.locale) {
                // access token 被服务端作废但 refresh_token 还在：续一次
                persist(next)
            } else {
                persist(nil)
            }
        } catch {
            // 离线：保留本机会话
        }
    }

    func signIn(email: String, password: String, locale: String) async -> String? {
        switch await SupabaseAuthClient.signIn(email: email, password: password, locale: locale) {
        case .ok(let s): persist(s); return nil
        case .failed(let error, _): return error
        }
    }

    func register(email: String, password: String, name: String, locale: String) async -> String? {
        switch await SupabaseAuthClient.signUp(email: email, password: password, name: name, locale: locale) {
        case .ok(let s): persist(s); return nil
        case .failed(let error, _): return error
        }
    }

    /// 第三方登录结果：成功 / 用户取消（不提示）/ 失败（文案）
    enum SocialOutcome { case done, cancelled, failed(String) }

    /// RN signInWithGoogleMobile 的浏览器分支（Supabase PKCE OAuth）：Safari 登 Google → 回 askbible://auth/callback → code 换会话
    func signInWithGoogle(locale: String) async -> SocialOutcome {
        let verifier = MemberOAuthRules.randomVerifier()
        let url = MemberOAuthRules.authorizeURL(provider: "google", redirectTo: MemberOAuthRules.appRedirect,
                                                challenge: MemberOAuthRules.pkceChallenge(verifier))
        guard let callback = await WebAuthSession.run(url: url, callbackScheme: MemberOAuthRules.callbackScheme) else { return .cancelled }
        let p = MemberOAuthRules.parseCallback(callback)
        if let e = p.errorCode { return .failed(MemberOAuthRules.resolveError(provider: "google", code: e, error: e) ?? MemberOAuthRules.googleFailedText) }
        let result: MemberAuthResult
        if let code = p.code {
            result = await SupabaseAuthClient.exchangeCode(code, verifier: verifier, locale: locale)
        } else if let access = p.accessToken, p.refreshToken != nil {
            result = await SupabaseAuthClient.sessionFromTokens(accessToken: access, locale: locale)
        } else {
            result = .failed(error: "missing_code", code: "google_failed")
        }
        return finishSocial(result, provider: "google")
    }

    /// RN signInWithAppleNative + exchangeAppleNativeCredential：系统 Apple 登录 → identityToken → Supabase id_token
    func signInWithApple(locale: String) async -> SocialOutcome {
        let rawNonce = MemberOAuthRules.randomNonce()
        switch await AppleSignInCoordinator.shared.signIn(hashedNonce: MemberOAuthRules.sha256Hex(rawNonce)) {
        case .cancelled:
            return .cancelled
        case .failed(let code):
            return .failed(MemberOAuthRules.resolveError(provider: "apple", code: code, error: code) ?? MemberOAuthRules.appleFailedText)
        case .ok(let idToken, let name):
            let r = await SupabaseAuthClient.signInWithIdToken(provider: "apple", idToken: idToken, nonce: rawNonce, fallbackName: name, locale: locale)
            return finishSocial(r, provider: "apple")
        }
    }

    private func finishSocial(_ r: MemberAuthResult, provider: String) -> SocialOutcome {
        switch r {
        case .ok(let s): persist(s); return .done
        case .failed(let error, let code):
            return .failed(MemberOAuthRules.resolveError(provider: provider, code: code, error: error)
                           ?? (provider == "apple" ? MemberOAuthRules.appleFailedText : MemberOAuthRules.googleFailedText))
        }
    }

    func signOut() {
        let token = session?.sessionToken
        persist(nil)
        if let token { Task { await SupabaseAuthClient.signOut(token: token) } }
    }

    /// 删除账户（RN deleteAccount → DELETE /api/mobile/auth/account）：服务端删掉会员，本机再登出。
    /// 返回 nil 表示成功，否则是错误码。调用方负责先把本机进度推上云（其实删了也就没了）并清本机数据。
    func deleteAccount() async -> String? {
        guard let token = await ensureFreshToken() else { return "unauthorized" }
        var req = URLRequest(url: URL(string: "https://askbible.me/api/mobile/auth/account")!)
        req.httpMethod = "DELETE"
        req.timeoutInterval = 20
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
            let json = data.isEmpty ? nil : (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            if status == 200, (json?["ok"] as? Bool) != false {
                persist(nil)
                return nil
            }
            return (json?["code"] as? String) ?? (json?["error"] as? String) ?? "network"
        } catch {
            return "network"
        }
    }

    /// 改称呼：先改本机（马上生效），再写服务端 profile
    func updateDisplayName(_ raw: String) async -> Bool {
        let name = MemberAuthRules.normalizeDisplayName(raw)
        guard MemberAuthRules.isValidDisplayName(name), let s = session else { return false }
        var u = s.user; u.name = name
        persist(MemberSession(sessionToken: s.sessionToken, expiresAt: s.expiresAt, user: u, refreshToken: s.refreshToken))
        _ = await SupabaseAuthClient.updateDisplayName(token: s.sessionToken, userId: u.id, name: name)
        return true
    }
}
