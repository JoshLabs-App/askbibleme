import Foundation
import Combine

/// 会员登录状态（RN useMemberAuthProvider + useMemberAuthBootstrap）：本机会话 + 启动时后台校验。
/// 登录 / 注册成功即写会话；退出清会话（服务端 logout 尽力而为）。
@MainActor
final class MemberAuthStore: ObservableObject {
    @Published private(set) var user: MemberUser?
    @Published private(set) var isAdmin = false
    @Published private(set) var bootstrapped = false
    private var session: MemberSession?
    private let defaults: UserDefaults
    /// Changes on authentication attempts/logout, including a new login to the same account.
    /// A response from an older generation must never restore a signed-out session.
    private(set) var sessionGeneration: UInt64 = 0
    private var refreshTask: Task<MemberAuthResult, Never>?
    private var refreshSource: MemberSession?
    /// 当前会话 token（读经同步用；没登录为 nil）
    var sessionToken: String? { session?.sessionToken }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        // 过期但带 refresh_token 的也先算登着（启动后 verifyRemote 会先续期）；RN 是一过期就登出
        if let data = defaults.data(forKey: MemberAuthRules.sessionKey), let s = MemberAuthRules.parseSession(data, allowExpired: true) {
            session = s
            user = s.user
            isAdmin = defaults.bool(forKey: "is-admin.\(s.user.id)")
        } else {
            defaults.removeObject(forKey: MemberAuthRules.sessionKey)
        }
        bootstrapped = true
    }

    func refreshAdminFlag() async {
        let generation = sessionGeneration
        guard let id = user?.id, let token = await ensureFreshToken(), generation == sessionGeneration,
              let remote = await SupabaseAuthClient.fetchIsAdmin(token: token, userId: id),
              generation == sessionGeneration, user?.id == id, !Task.isCancelled else { return }
        isAdmin = remote
        defaults.set(remote, forKey: "is-admin.\(id)")
    }

    /// 拿一个还能用的 access token：快到期（2 分钟内）就先用 refresh_token 续；续期被拒（已作废）→ 登出；断网 → 先用旧的
    func ensureFreshToken() async -> String? {
        guard let s = session else { return nil }
        guard MemberAuthRules.secondsUntilExpiry(s) < 120 else { return s.sessionToken }
        guard let rt = s.refreshToken else {
            if MemberAuthRules.secondsUntilExpiry(s) <= 0 { persist(nil); return nil }
            return s.sessionToken
        }
        return await refreshSession(s, refreshToken: rt)
    }

    private func refreshSession(_ s: MemberSession, refreshToken: String) async -> String? {
        let generation = sessionGeneration
        let task: Task<MemberAuthResult, Never>
        let source: MemberSession
        if let existing = refreshTask, let original = refreshSource, sameCredentials(original, s) {
            task = existing
            source = original
        } else {
            refreshTask?.cancel()
            task = Task { await SupabaseAuthClient.refresh(refreshToken: refreshToken, locale: s.user.locale) }
            source = s
            refreshSource = s
            refreshTask = task
        }
        let result = await task.value
        if refreshTask == task { refreshTask = nil; refreshSource = nil }
        // A cancelled waiter may still have consumed a rotated refresh token on the server.
        // Keep the replacement credentials for the same session; logout/new login changes the generation.
        guard generation == sessionGeneration else { return nil }
        // Another caller may already have committed this shared refresh.
        guard let current = session, sameCredentials(current, source) else { return session?.sessionToken }
        switch result {
        case .ok(var next):
            guard next.user.id == source.user.id else { return nil }
            // A local profile edit must neither abandon rotated tokens nor be overwritten by an older profile response.
            if current.user.name != source.user.name { next.user.name = current.user.name }
            if current.user.locale != source.user.locale { next.user.locale = current.user.locale }
            next.user.createdAt = next.user.createdAt ?? current.user.createdAt
            persist(next)
            return next.sessionToken
        case .failed(_, let code):
            if code == "network" { return MemberAuthRules.secondsUntilExpiry(current) > 0 ? current.sessionToken : nil }
            persist(nil)
            return nil
        }
    }

    private func sameCredentials(_ lhs: MemberSession, _ rhs: MemberSession) -> Bool {
        lhs.user.id == rhs.user.id && lhs.sessionToken == rhs.sessionToken && lhs.refreshToken == rhs.refreshToken
    }

    @discardableResult
    private func invalidatePendingAuthentication() -> UInt64 {
        sessionGeneration &+= 1
        refreshTask?.cancel(); refreshTask = nil; refreshSource = nil
        return sessionGeneration
    }

    private func persist(_ s: MemberSession?) {
        if session?.user.id != s?.user.id { invalidatePendingAuthentication() }
        session = s
        user = s?.user
        isAdmin = s.map { defaults.bool(forKey: "is-admin.\($0.user.id)") } ?? false
        if let s, let data = try? JSONEncoder().encode(s) { defaults.set(data, forKey: MemberAuthRules.sessionKey) }
        else { defaults.removeObject(forKey: MemberAuthRules.sessionKey) }
    }

    /// 启动后校验会话：token 作废就清掉；网络不通保留本机会话（RN 同）
    func verifyRemote() async {
        let generation = sessionGeneration
        guard session != nil, let token = await ensureFreshToken(), generation == sessionGeneration, let s = session else { return }
        do {
            let remote = try await SupabaseAuthClient.verify(token: token)
            guard generation == sessionGeneration, session == s, !Task.isCancelled else { return }
            if var remote {
                guard remote.id == s.user.id else { return }
                remote.createdAt = remote.createdAt ?? s.user.createdAt
                persist(MemberSession(sessionToken: token, expiresAt: s.expiresAt, user: remote, refreshToken: s.refreshToken))
            } else if let rt = s.refreshToken {
                // A temporary refresh failure must retain the current session.
                _ = await refreshSession(s, refreshToken: rt)
            } else {
                persist(nil)
            }
        } catch {
            // 离线：保留本机会话
        }
    }

    func signIn(email: String, password: String, locale: String) async -> String? {
        let generation = invalidatePendingAuthentication()
        let result = await SupabaseAuthClient.signIn(email: email, password: password, locale: locale)
        guard generation == sessionGeneration, !Task.isCancelled else { return "cancelled" }
        switch result {
        case .ok(let s): persist(s); return nil
        case .failed(let error, _): return error
        }
    }

    func register(email: String, password: String, name: String, locale: String) async -> String? {
        let generation = invalidatePendingAuthentication()
        let result = await SupabaseAuthClient.signUp(email: email, password: password, name: name, locale: locale)
        guard generation == sessionGeneration, !Task.isCancelled else { return "cancelled" }
        switch result {
        case .ok(let s): persist(s); return nil
        case .failed(let error, _): return error
        }
    }

    /// 第三方登录结果：成功 / 用户取消（不提示）/ 失败（文案）
    enum SocialOutcome { case done, cancelled, failed(String) }

    /// RN signInWithGoogleMobile 的浏览器分支（Supabase PKCE OAuth）：Safari 登 Google → 回 askbible://auth/callback → code 换会话
    func signInWithGoogle(locale: String) async -> SocialOutcome {
        let generation = invalidatePendingAuthentication()
        let verifier = MemberOAuthRules.randomVerifier()
        let url = MemberOAuthRules.authorizeURL(provider: "google", redirectTo: MemberOAuthRules.appRedirect,
                                                challenge: MemberOAuthRules.pkceChallenge(verifier))
        guard let callback = await WebAuthSession.run(url: url, callbackScheme: MemberOAuthRules.callbackScheme) else { return .cancelled }
        guard generation == sessionGeneration, !Task.isCancelled else { return .cancelled }
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
        guard generation == sessionGeneration, !Task.isCancelled else { return .cancelled }
        return finishSocial(result, provider: "google")
    }

    /// RN signInWithAppleNative + exchangeAppleNativeCredential：系统 Apple 登录 → identityToken → Supabase id_token
    func signInWithApple(locale: String) async -> SocialOutcome {
        let generation = invalidatePendingAuthentication()
        let rawNonce = MemberOAuthRules.randomNonce()
        switch await AppleSignInCoordinator.shared.signIn(hashedNonce: MemberOAuthRules.sha256Hex(rawNonce)) {
        case .cancelled:
            return .cancelled
        case .failed(let code):
            return .failed(MemberOAuthRules.resolveError(provider: "apple", code: code, error: code) ?? MemberOAuthRules.appleFailedText)
        case .ok(let idToken, let name):
            guard generation == sessionGeneration, !Task.isCancelled else { return .cancelled }
            let r = await SupabaseAuthClient.signInWithIdToken(provider: "apple", idToken: idToken, nonce: rawNonce, fallbackName: name, locale: locale)
            guard generation == sessionGeneration, !Task.isCancelled else { return .cancelled }
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
        invalidatePendingAuthentication()
        let token = session?.sessionToken
        persist(nil)
        if let token { Task { await SupabaseAuthClient.signOut(token: token) } }
    }

    /// 删除账户（RN deleteAccount → DELETE /api/mobile/auth/account）：服务端删掉会员，本机再登出。
    /// 返回 nil 表示成功，否则是错误码。调用方只在确认成功后清本机数据。
    func deleteAccount() async -> String? {
        let generation = sessionGeneration
        guard let token = await ensureFreshToken(), generation == sessionGeneration else { return "unauthorized" }
        var req = URLRequest(url: URL(string: Endpoints.siteBase + "/api/mobile/auth/account")!)
        req.httpMethod = "DELETE"
        req.timeoutInterval = 20
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard generation == sessionGeneration, !Task.isCancelled else { return "unauthorized" }
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
