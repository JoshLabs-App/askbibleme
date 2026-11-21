import Foundation
import Combine

/// 会员登录状态（DECISIONS D-44：`askbible-sync` 1 年滑动会话 + 6 位邮箱验证码 + 系统 Apple 原生登录）。
/// 保留完整的 `sessionGeneration` 隔离：退出或切换账号后，任何在途旧请求绝不能恢复旧会话或覆盖新昵称。
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
    private var verifyTask: Task<String?, Never>?
    private var verifySourceToken: String?

    var sessionToken: String? { session?.sessionToken }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let data = defaults.data(forKey: MemberAuthRules.sessionKey),
           let s = MemberAuthRules.parseSession(data) {
            session = s
            user = s.user
            isAdmin = s.user.isAdmin ?? defaults.bool(forKey: "is-admin.\(s.user.id)")
        } else {
            defaults.removeObject(forKey: MemberAuthRules.sessionKey)
        }
        bootstrapped = true
    }

    func refreshAdminFlag() async {
        await verifyRemote()
    }

    /// 拿一个有效会话 token：距过期不足 24 小时时后台滑动续期一次（合并并发调用）；429/5xx/断网保留当前有效会话
    func ensureFreshToken() async -> String? {
        guard let s = session else { return nil }
        if MemberAuthRules.secondsUntilExpiry(s) <= 0 {
            persist(nil)
            return nil
        }
        guard MemberAuthRules.secondsUntilExpiry(s) < 86_400 else {
            return s.sessionToken
        }
        return await refreshSlidingSession(s)
    }

    private func refreshSlidingSession(_ s: MemberSession) async -> String? {
        let generation = sessionGeneration
        let task: Task<String?, Never>
        if let existing = verifyTask, verifySourceToken == s.sessionToken {
            task = existing
        } else {
            verifyTask?.cancel()
            let token = s.sessionToken
            let sourceUser = s.user
            let sourceExpires = s.expiresAt
            let newTask = Task { @MainActor [weak self] () -> String? in
                do {
                    let verified = try await AskBibleSyncClient.verify(token: token)
                    guard let self, generation == self.sessionGeneration else { return nil }
                    guard let current = self.session, current.sessionToken == token, current.user.id == sourceUser.id else {
                        return self.session?.sessionToken
                    }
                    if var remoteUser = verified?.user {
                        guard remoteUser.id == sourceUser.id else { return nil }
                        if current.user.name != sourceUser.name { remoteUser.name = current.user.name }
                        if current.user.locale != sourceUser.locale { remoteUser.locale = current.user.locale }
                        remoteUser.createdAt = remoteUser.createdAt ?? current.user.createdAt
                        let next = MemberSession(sessionToken: token, expiresAt: verified?.expiresAt ?? sourceExpires, user: remoteUser)
                        self.persist(next)
                        return next.sessionToken
                    } else {
                        self.persist(nil)
                        return nil
                    }
                } catch {
                    guard let self, generation == self.sessionGeneration, let current = self.session else { return nil }
                    return MemberAuthRules.secondsUntilExpiry(current) > 0 ? current.sessionToken : nil
                }
            }
            verifySourceToken = s.sessionToken
            verifyTask = newTask
            task = newTask
        }
        let result = await task.value
        if verifyTask == task { verifyTask = nil; verifySourceToken = nil }
        guard generation == sessionGeneration else { return nil }
        return result
    }

    @discardableResult
    private func invalidatePendingAuthentication() -> UInt64 {
        sessionGeneration &+= 1
        verifyTask?.cancel(); verifyTask = nil; verifySourceToken = nil
        return sessionGeneration
    }

    private func persist(_ s: MemberSession?) {
        if session?.user.id != s?.user.id { invalidatePendingAuthentication() }
        session = s
        user = s?.user
        if let s {
            let admin = s.user.isAdmin ?? defaults.bool(forKey: "is-admin.\(s.user.id)")
            isAdmin = admin
            defaults.set(admin, forKey: "is-admin.\(s.user.id)")
            if let data = try? JSONEncoder().encode(s) {
                defaults.set(data, forKey: MemberAuthRules.sessionKey)
            }
        } else {
            isAdmin = false
            defaults.removeObject(forKey: MemberAuthRules.sessionKey)
        }
    }

    /// 启动后校验会话：401/403 清掉本机会话；断网或 5xx 保留本机会话
    func verifyRemote() async {
        let generation = sessionGeneration
        guard let s = session else { return }
        _ = await refreshSlidingSession(s)
        guard generation == sessionGeneration else { return }
    }

    /// 发送 6 位邮箱验证码（成功返回 nil，失败返回错误文案）
    func sendOtp(email: String, locale: String) async -> String? {
        switch await AskBibleSyncClient.sendOtp(email: email, locale: locale) {
        case .ok:
            return nil
        case .failed(let error, _):
            return error
        }
    }

    /// 校验 6 位邮箱验证码并登录（成功返回 nil，失败返回错误文案）
    func verifyOtp(email: String, code: String, name: String? = nil, locale: String) async -> String? {
        let generation = invalidatePendingAuthentication()
        let result = await AskBibleSyncClient.verifyOtp(email: email, code: code, name: name, locale: locale)
        guard generation == sessionGeneration, !Task.isCancelled else { return "cancelled" }
        switch result {
        case .ok(let s):
            persist(s)
            return nil
        case .failed(let error, _):
            return error
        }
    }

    enum SocialOutcome { case done, cancelled, failed(String) }

    /// 系统原生 Apple 登录 → identityToken → `POST /v1/auth/oauth/apple`（无浏览器重定向）
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
            let r = await AskBibleSyncClient.signInWithOAuthIdToken(
                provider: "apple",
                idToken: idToken,
                nonce: rawNonce,
                fallbackName: name,
                locale: locale
            )
            guard generation == sessionGeneration, !Task.isCancelled else { return .cancelled }
            switch r {
            case .ok(let s):
                persist(s)
                return .done
            case .failed(let error, let code):
                return .failed(MemberOAuthRules.resolveError(provider: "apple", code: code, error: error) ?? MemberOAuthRules.appleFailedText)
            }
        }
    }

    func signOut() {
        invalidatePendingAuthentication()
        let token = session?.sessionToken
        persist(nil)
        if let token { Task { await AskBibleSyncClient.signOut(token: token) } }
    }

    /// 原子注销账户（`DELETE /v1/auth/account`）：成功才清本机态，失败保留本机数据
    func deleteAccount() async -> String? {
        let generation = sessionGeneration
        guard let s = session, MemberAuthRules.secondsUntilExpiry(s) > 0 else { return "unauthorized" }
        let err = await AskBibleSyncClient.deleteAccount(token: s.sessionToken)
        guard generation == sessionGeneration, !Task.isCancelled else { return "unauthorized" }
        if err == nil {
            persist(nil)
            return nil
        }
        return err
    }

    /// 改称呼：先改本机（立即生效），再写服务端 profile
    func updateDisplayName(_ raw: String) async -> Bool {
        let name = MemberAuthRules.normalizeDisplayName(raw)
        guard MemberAuthRules.isValidDisplayName(name), let s = session else { return false }
        var u = s.user; u.name = name
        persist(MemberSession(sessionToken: s.sessionToken, expiresAt: s.expiresAt, user: u))
        _ = await AskBibleSyncClient.updateDisplayName(token: s.sessionToken, name: name, locale: u.locale)
        return true
    }
}
