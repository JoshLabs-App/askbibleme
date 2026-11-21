import Foundation

/// 会员登录与读经同步客户端（DECISIONS D-44：去 Supabase → Cloudflare Worker `askbible-sync` + D1）。
/// 支持：6 位邮箱验证码登录、Apple / Google 原生 ID Token 公钥直验（零浏览器跳转）、会话滑动续期、修改昵称、原子注销账户、服务端权威合并读经同步。
struct MemberUser: Codable, Equatable {
    var id: String
    var email: String
    var name: String
    var locale: String?
    var createdAt: String?
    var isAdmin: Bool?
}

struct MemberSession: Codable, Equatable {
    var sessionToken: String
    var expiresAt: String
    var user: MemberUser
}

/// 纯规则：错误文案映射、显示名回退、会话解析、称呼校验
enum MemberAuthRules {
    static let sessionKey = "askbible.mobile.member-session.v1"
    static let displayNameMaxLen = 24

    static func mapAuthError(_ message: String) -> (error: String, code: String) {
        let msg = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let m = msg.isEmpty ? "auth_failed" : msg
        func has(_ pattern: String) -> Bool { m.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil }
        if has("invalid_email") { return ("请输入有效的邮箱地址。", "invalid_email") }
        if has("invalid_otp") { return ("验证码不正确，请核对后重试。", "invalid_otp") }
        if has("otp_expired") { return ("验证码已过期，请重新获取。", "otp_expired") }
        if has("otp_too_many_attempts") { return ("尝试次数过多，请重新获取验证码。", "otp_too_many_attempts") }
        if has("network request failed|failed to fetch|network error|timed out|failed to connect") { return ("network", "network") }
        return (m, "auth_failed")
    }

    static func displayName(email: String, id: String, metadata: [String: Any], fallback: String?) -> String {
        if let f = fallback?.trimmingCharacters(in: .whitespaces), !f.isEmpty { return f }
        for key in ["full_name", "name", "display_name"] {
            if let v = metadata[key] as? String {
                let t = v.trimmingCharacters(in: .whitespaces)
                if !t.isEmpty { return t }
            }
        }
        return email.isEmpty ? id : email
    }

    static func parseSession(_ data: Data, now: Date = Date()) -> MemberSession? {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let token = (obj["sessionToken"] as? String)?.trimmingCharacters(in: .whitespaces),
              !token.isEmpty,
              // 旧版 v1 的 JWT 含 `.` 分段，升到 v2 时静默丢弃旧 token（保留本机读经进度，重新验证登录即无缝合并同 UUID 账户）
              !token.contains("."),
              let expiresAt = obj["expiresAt"] as? String,
              let u = obj["user"] as? [String: Any],
              let id = u["id"] as? String, !id.isEmpty,
              let email = u["email"] as? String else { return nil }
        guard let exp = ISO8601DateFormatter.flexible(expiresAt), exp > now else { return nil }
        let name = (u["name"] as? String) ?? email
        let created = (u["createdAt"] as? String)?.trimmingCharacters(in: .whitespaces)
        let isAdmin = u["isAdmin"] as? Bool
        return MemberSession(
            sessionToken: token,
            expiresAt: expiresAt,
            user: MemberUser(
                id: id,
                email: email,
                name: name,
                locale: u["locale"] as? String,
                createdAt: (created?.isEmpty ?? true) ? nil : created,
                isAdmin: isAdmin
            )
        )
    }

    static func secondsUntilExpiry(_ s: MemberSession, now: Date = Date()) -> Double {
        (ISO8601DateFormatter.flexible(s.expiresAt) ?? now).timeIntervalSince(now)
    }

    static func normalizeDisplayName(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    }

    static func isValidDisplayName(_ raw: String) -> Bool {
        let n = normalizeDisplayName(raw)
        return !n.isEmpty && n.count <= displayNameMaxLen
    }

    static func shortAccountName(_ raw: String) -> String {
        let n = normalizeDisplayName(raw)
        let base = n.contains("@") ? String(n.prefix(while: { $0 != "@" })) : n
        return base.count > 14 ? String(base.prefix(13)) + "\u{2026}" : base
    }

    static func greeting(_ user: MemberUser?) -> String {
        guard let user else { return "请登录，解锁更多" }
        let n = normalizeDisplayName(user.name)
        return "你好，\(n.isEmpty ? "用户" : n)"
    }

    static func expiresAtISO(expiresAtSeconds: Double?, now: Date = Date()) -> String {
        let d = expiresAtSeconds.map { Date(timeIntervalSince1970: $0) } ?? now.addingTimeInterval(365 * 86_400)
        return ISO8601DateFormatter.millis.string(from: d)
    }
}

extension ISO8601DateFormatter {
    static let millis: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return f
    }()
    static let plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime]; return f
    }()
    static func flexible(_ s: String) -> Date? { millis.date(from: s) ?? plain.date(from: s) }
}

enum MemberAuthResult {
    case ok(MemberSession)
    case failed(error: String, code: String)
}

enum OtpSendResult {
    case ok(expiresInSec: Int)
    case failed(error: String, code: String)
}

/// AskBible Sync Worker（`/v1/auth/*` + `/v1/sync/reading`）请求客户端
enum AskBibleSyncClient {
    struct VerifiedSession {
        var user: MemberUser
        var expiresAt: String
    }

    struct SyncDocument {
        var revision: String
        var updatedAt: String
        var blobs: [String: Any]
    }

    enum SyncFetch {
        case ok(SyncDocument?)
        case unauthorized
        case failed(String)
        case network
    }

    private static let deviceIdKey = "askbible.sync.device-id.v1"

    private static var deviceId: String {
        if let existing = UserDefaults.standard.string(forKey: deviceIdKey), !existing.isEmpty {
            return existing
        }
        let fresh = UUID().uuidString.lowercased()
        UserDefaults.standard.set(fresh, forKey: deviceIdKey)
        return fresh
    }

    private static func request(
        _ path: String,
        method: String,
        token: String? = nil,
        body: [String: Any]? = nil,
        timeout: TimeInterval = 20
    ) async throws -> (status: Int, json: Any?) {
        guard let url = URL(string: Endpoints.apiBase + path) else {
            throw URLError(.badURL)
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = timeout
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("ios", forHTTPHeaderField: "X-Platform")
        req.setValue(deviceId, forHTTPHeaderField: "X-Device-Id")
        if let token, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = data.isEmpty ? nil : try? JSONSerialization.jsonObject(with: data)
        return (status, json)
    }

    private static func errorMessage(_ json: Any?, status: Int) -> String {
        guard let o = json as? [String: Any] else { return "HTTP \(status)" }
        for k in ["error", "message", "msg"] {
            if let s = o[k] as? String, !s.isEmpty { return s }
        }
        return "HTTP \(status)"
    }

    private static func errorCode(_ json: Any?, fallback: String) -> String {
        if let o = json as? [String: Any], let c = o["code"] as? String, !c.isEmpty { return c }
        return fallback
    }

    private static func parseUser(_ u: [String: Any]) -> MemberUser? {
        guard let id = u["id"] as? String, !id.isEmpty,
              let email = u["email"] as? String else { return nil }
        let name = (u["name"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
        let created = (u["createdAt"] as? String)?.trimmingCharacters(in: .whitespaces)
        return MemberUser(
            id: id,
            email: email,
            name: name.isEmpty ? email : name,
            locale: u["locale"] as? String,
            createdAt: (created?.isEmpty ?? true) ? nil : created,
            isAdmin: u["isAdmin"] as? Bool
        )
    }

    private static func parseSessionResponse(_ o: [String: Any]) -> MemberSession? {
        guard let token = (o["sessionToken"] as? String)?.trimmingCharacters(in: .whitespaces), !token.isEmpty,
              let u = o["user"] as? [String: Any],
              let user = parseUser(u) else { return nil }
        let expiresAt = (o["expiresAt"] as? String) ?? MemberAuthRules.expiresAtISO(expiresAtSeconds: nil)
        return MemberSession(sessionToken: token, expiresAt: expiresAt, user: user)
    }

    /// 1. 发送 6 位邮箱验证码
    static func sendOtp(email: String, locale: String?) async -> OtpSendResult {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleanEmail.contains("@"), cleanEmail.contains(".") else {
            return .failed(error: "请输入有效的邮箱地址。", code: "invalid_email")
        }
        var body: [String: Any] = ["email": cleanEmail]
        if let locale, !locale.isEmpty { body["locale"] = locale }
        do {
            let (status, json) = try await request("/v1/auth/otp/send", method: "POST", body: body)
            if status >= 200, status < 300, let o = json as? [String: Any], (o["ok"] as? Bool) != false {
                let sec = (o["expiresInSec"] as? NSNumber)?.intValue ?? 600
                return .ok(expiresInSec: sec)
            }
            let msg = errorMessage(json, status: status)
            let code = errorCode(json, fallback: "otp_send_failed")
            return .failed(error: msg, code: code)
        } catch {
            return .failed(error: "network", code: "network")
        }
    }

    /// 2. 校验 6 位验证码并建立会话（新邮箱自动创建账号）
    static func verifyOtp(email: String, code: String, name: String?, locale: String?) async -> MemberAuthResult {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let digits = code.filter(\.isNumber)
        guard digits.count == 6 else {
            return .failed(error: "请输入 6 位数字验证码。", code: "invalid_otp")
        }
        var body: [String: Any] = [
            "email": cleanEmail,
            "code": digits,
            "deviceId": deviceId,
            "platform": "ios",
        ]
        if let n = name?.trimmingCharacters(in: .whitespaces), !n.isEmpty { body["displayName"] = n }
        if let locale, !locale.isEmpty { body["locale"] = locale }
        do {
            let (status, json) = try await request("/v1/auth/otp/verify", method: "POST", body: body)
            if status >= 200, status < 300, let o = json as? [String: Any], let s = parseSessionResponse(o) {
                return .ok(s)
            }
            let msg = errorMessage(json, status: status)
            let c = errorCode(json, fallback: "invalid_otp")
            return .failed(error: msg, code: c)
        } catch {
            return .failed(error: "network", code: "network")
        }
    }

    /// 3. Apple / Google 原生 ID Token 直验（WebCrypto JWKS，零浏览器跳转）
    static func signInWithOAuthIdToken(
        provider: String,
        idToken: String,
        nonce: String?,
        fallbackName: String?,
        locale: String?
    ) async -> MemberAuthResult {
        var body: [String: Any] = [
            "idToken": idToken,
            "deviceId": deviceId,
            "platform": "ios",
        ]
        if let nonce, !nonce.isEmpty { body["nonce"] = nonce }
        if let n = fallbackName?.trimmingCharacters(in: .whitespaces), !n.isEmpty { body["displayName"] = n }
        if let locale, !locale.isEmpty { body["locale"] = locale }
        let path = provider == "apple" ? "/v1/auth/oauth/apple" : "/v1/auth/oauth/google"
        do {
            let (status, json) = try await request(path, method: "POST", body: body, timeout: 30)
            if status >= 200, status < 300, let o = json as? [String: Any], let s = parseSessionResponse(o) {
                return .ok(s)
            }
            if status == 429 || status >= 500 {
                return .failed(error: "network", code: "network")
            }
            let msg = errorMessage(json, status: status)
            if MemberOAuthRules.isNetworkMessage(msg) { return .failed(error: "network", code: "network") }
            return .failed(error: msg, code: MemberOAuthRules.idTokenFailureCode(provider: provider, message: msg))
        } catch {
            return .failed(error: "network", code: "network")
        }
    }

    /// 4. 校验并滑动续期当前会话：401/403 返回 nil（作废）；429/5xx 或断网抛错（保留本机会话，不误踢下线）
    static func verify(token: String) async throws -> VerifiedSession? {
        let (status, json) = try await request("/v1/auth/session", method: "GET", token: token)
        if status == 401 || status == 403 { return nil }
        guard status == 200,
              let o = json as? [String: Any],
              let u = o["user"] as? [String: Any],
              let user = parseUser(u) else {
            throw URLError(.badServerResponse)
        }
        let expiresAt = (o["expiresAt"] as? String) ?? MemberAuthRules.expiresAtISO(expiresAtSeconds: nil)
        return VerifiedSession(user: user, expiresAt: expiresAt)
    }

    /// 5. 修改昵称
    static func updateDisplayName(token: String, name: String, locale: String? = nil) async -> Bool {
        var body: [String: Any] = ["name": name]
        if let locale, !locale.isEmpty { body["locale"] = locale }
        guard let (status, _) = try? await request("/v1/auth/profile", method: "PATCH", token: token, body: body) else {
            return false
        }
        return (200..<300).contains(status)
    }

    /// 6. 退出当前设备会话
    static func signOut(token: String) async {
        _ = try? await request("/v1/auth/logout", method: "POST", token: token)
    }

    /// 7. 原子删除账户（云端 D1 同步文档 + 会话 + 用户一并清除）
    static func deleteAccount(token: String) async -> String? {
        do {
            let (status, json) = try await request("/v1/auth/account", method: "DELETE", token: token, timeout: 20)
            let o = json as? [String: Any]
            if status == 200, (o?["ok"] as? Bool) != false {
                return nil
            }
            return (o?["code"] as? String) ?? (o?["error"] as? String) ?? "network"
        } catch {
            return "network"
        }
    }

    // MARK: 会员读经同步（Worker 单点权威合并）

    private static func parseSyncDoc(_ raw: Any?) -> SyncDocument? {
        guard let d = raw as? [String: Any] else { return nil }
        return SyncDocument(
            revision: (d["revision"] as? String) ?? "0",
            updatedAt: (d["updatedAt"] as? String) ?? "",
            blobs: (d["blobs"] as? [String: Any]) ?? [:]
        )
    }

    static func fetchSyncDocument(token: String) async -> SyncFetch {
        do {
            let (status, json) = try await request("/v1/sync/reading", method: "GET", token: token, timeout: 30)
            if status == 401 || status == 403 { return .unauthorized }
            guard status == 200, let o = json as? [String: Any], (o["ok"] as? Bool) != false else {
                return .failed(errorMessage(json, status: status))
            }
            if o["doc"] == nil || o["doc"] is NSNull { return .ok(nil) }
            return .ok(parseSyncDoc(o["doc"]))
        } catch {
            return .network
        }
    }

    static func pushSyncDocument(token: String, blobs: [String: Any], replace: Bool = false) async -> SyncFetch {
        do {
            var body: [String: Any] = ["blobs": blobs]
            if replace { body["replace"] = true }
            let (status, json) = try await request("/v1/sync/reading", method: "POST", token: token, body: body, timeout: 30)
            if status == 401 || status == 403 { return .unauthorized }
            guard (200..<300).contains(status), let o = json as? [String: Any], (o["ok"] as? Bool) != false else {
                return .failed(errorMessage(json, status: status))
            }
            return .ok(parseSyncDoc(o["doc"]))
        } catch {
            return .network
        }
    }
}
