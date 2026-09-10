import Foundation

/// 会员登录（RN src/auth：memberSession / supabaseMemberAuth / memberAuthSessionCommit）。
/// RN 用 supabase-js 直连 Supabase（不经 askbible.me）；这里用同一套 GoTrue / PostgREST 接口手写请求。
/// 本机会话 JSON 与 RN 同形（sessionToken / expiresAt / user），键也一样，装回 RN 版也能认。
struct MemberUser: Codable, Equatable {
    var id: String
    var email: String
    var name: String
    var locale: String?
    var createdAt: String?
}

struct MemberSession: Codable, Equatable {
    var sessionToken: String
    var expiresAt: String
    var user: MemberUser
}

/// 纯规则（check:member-auth 对拍）：错误文案映射、显示名回退、会话解析、称呼校验
enum MemberAuthRules {
    static let sessionKey = "askbible.mobile.member-session.v1"
    static let displayNameMaxLen = 24

    /// RN mapAuthErrorMessage：GoTrue 的英文错误 → 中文提示 + code
    static func mapAuthError(_ message: String) -> (error: String, code: String) {
        let msg = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let m = msg.isEmpty ? "auth_failed" : msg
        func has(_ pattern: String) -> Bool { m.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil }
        if has("invalid login credentials|invalid_credentials") { return ("邮箱或密码不正确。", "invalid_credentials") }
        if has("email not confirmed") { return ("请先完成邮箱验证后再登录。", "email_not_confirmed") }
        if has("user already registered|already been registered") { return ("该邮箱已注册。", "email_taken") }
        if has("network request failed|failed to fetch|network error|timed out|failed to connect") { return ("network", "network") }
        return (m, "auth_failed")
    }

    /// RN displayNameFromUser：优先传入的名字，再看 user_metadata 的 full_name / name / display_name，最后邮箱、id
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

    /// RN readMemberSession：字段齐全且未过期才算有会话
    static func parseSession(_ data: Data, now: Date = Date()) -> MemberSession? {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let token = (obj["sessionToken"] as? String)?.trimmingCharacters(in: .whitespaces), !token.isEmpty,
              let expiresAt = obj["expiresAt"] as? String,
              let u = obj["user"] as? [String: Any],
              let id = u["id"] as? String, let email = u["email"] as? String else { return nil }
        guard let exp = ISO8601DateFormatter.flexible(expiresAt), exp > now else { return nil }
        let name = (u["name"] as? String) ?? email
        let created = (u["createdAt"] as? String)?.trimmingCharacters(in: .whitespaces)
        return MemberSession(sessionToken: token, expiresAt: expiresAt,
                             user: MemberUser(id: id, email: email, name: name, locale: u["locale"] as? String,
                                              createdAt: (created?.isEmpty ?? true) ? nil : created))
    }

    /// RN normalizeExploreDisplayName / isValidExploreDisplayName
    static func normalizeDisplayName(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    }
    static func isValidDisplayName(_ raw: String) -> Bool {
        let n = normalizeDisplayName(raw)
        return !n.isEmpty && n.count <= displayNameMaxLen
    }

    /// 探索页抬头：登录了「你好，名字」，没登录「请登录，解锁更多」
    static func greeting(_ user: MemberUser?) -> String {
        guard let user else { return "请登录，解锁更多" }
        let n = normalizeDisplayName(user.name)
        return "你好，\(n.isEmpty ? "用户" : n)"
    }

    /// GoTrue 的 expires_at（unix 秒）→ ISO；缺了按一小时
    static func expiresAtISO(expiresAtSeconds: Double?, now: Date = Date()) -> String {
        let d = expiresAtSeconds.map { Date(timeIntervalSince1970: $0) } ?? now.addingTimeInterval(3600)
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
    /// JS Date.toISOString() 带毫秒；有的接口不带
    static func flexible(_ s: String) -> Date? { millis.date(from: s) ?? plain.date(from: s) }
}

/// Supabase 直连（与 RN app.config extra.supabaseUrl / anon key 同一套；anon key 是公开的发布密钥，RN 包里也带着）
enum SupabaseAuthConfig {
    static let url = "https://tgobadhdylarhssudplc.supabase.co"
    static let anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb2JhZGhkeWxhcmhzc3VkcGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTMwMDAsImV4cCI6MjA5Njc4OTAwMH0.5EqC5hJFmydZaVBmpXJk1ddJNGX_fY2hN83k5IzAO3I"
}

enum MemberAuthResult {
    case ok(MemberSession)
    case failed(error: String, code: String)
}

/// GoTrue（/auth/v1）+ PostgREST（/rest/v1/askbible_profiles）请求；全部 async，失败给 RN 同款文案
enum SupabaseAuthClient {
    private static func request(_ path: String, method: String, token: String? = nil, body: [String: Any]? = nil,
                                extraHeaders: [String: String] = [:], timeout: TimeInterval = 15) async throws -> (status: Int, json: Any?) {
        var req = URLRequest(url: URL(string: SupabaseAuthConfig.url + path)!)
        req.httpMethod = method
        req.timeoutInterval = timeout
        req.setValue(SupabaseAuthConfig.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Bearer \(token ?? SupabaseAuthConfig.anonKey)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        for (k, v) in extraHeaders { req.setValue(v, forHTTPHeaderField: k) }
        let (data, resp) = try await URLSession.shared.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        let json = data.isEmpty ? nil : try? JSONSerialization.jsonObject(with: data)
        return (status, json)
    }

    private static func errorMessage(_ json: Any?, status: Int) -> String {
        guard let o = json as? [String: Any] else { return "HTTP \(status)" }
        for k in ["error_description", "msg", "message", "error"] {
            if let s = o[k] as? String, !s.isEmpty { return s }
        }
        return "HTTP \(status)"
    }

    /// 把 GoTrue 的 session JSON 变成本机会话（顺手保证 askbible_profiles 有一行）
    private static func session(from o: [String: Any], fallbackName: String?, locale: String?) async -> MemberSession? {
        guard let token = o["access_token"] as? String, let u = o["user"] as? [String: Any],
              let id = u["id"] as? String else { return nil }
        let email = (u["email"] as? String) ?? ""
        let meta = (u["user_metadata"] as? [String: Any]) ?? [:]
        let expiresAt = MemberAuthRules.expiresAtISO(expiresAtSeconds: (o["expires_at"] as? NSNumber)?.doubleValue)
        let created = (u["created_at"] as? String)?.trimmingCharacters(in: .whitespaces)
        let profile = await ensureProfile(token: token, userId: id,
                                          displayName: MemberAuthRules.displayName(email: email, id: id, metadata: meta, fallback: fallbackName),
                                          locale: locale)
        let name = profile?.displayName ?? MemberAuthRules.displayName(email: email, id: id, metadata: meta, fallback: fallbackName)
        return MemberSession(sessionToken: token, expiresAt: expiresAt,
                             user: MemberUser(id: id, email: email, name: name, locale: profile?.locale, createdAt: (created?.isEmpty ?? true) ? nil : created))
    }

    static func signIn(email: String, password: String, locale: String?) async -> MemberAuthResult {
        do {
            let (status, json) = try await request("/auth/v1/token?grant_type=password", method: "POST",
                                                   body: ["email": email.trimmingCharacters(in: .whitespaces), "password": password])
            if status >= 200, status < 300, let o = json as? [String: Any], let s = await session(from: o, fallbackName: nil, locale: locale) {
                return .ok(s)
            }
            let m = MemberAuthRules.mapAuthError(errorMessage(json, status: status))
            return .failed(error: m.error, code: m.code)
        } catch {
            return .failed(error: "network", code: "network")
        }
    }

    static func signUp(email: String, password: String, name: String, locale: String?) async -> MemberAuthResult {
        var data: [String: Any] = [:]
        let n = name.trimmingCharacters(in: .whitespaces)
        if !n.isEmpty { data["name"] = n; data["display_name"] = n }
        if let l = locale?.trimmingCharacters(in: .whitespaces), !l.isEmpty { data["locale"] = l }
        do {
            let (status, json) = try await request("/auth/v1/signup", method: "POST",
                                                   body: ["email": email.trimmingCharacters(in: .whitespaces), "password": password, "data": data])
            guard status >= 200, status < 300, let o = json as? [String: Any] else {
                let m = MemberAuthRules.mapAuthError(errorMessage(json, status: status))
                return .failed(error: m.error, code: m.code)
            }
            if o["access_token"] != nil, let s = await session(from: o, fallbackName: n, locale: locale) { return .ok(s) }
            // 没给 session 只给了 user：要先点邮件里的验证链接
            if o["id"] != nil || o["user"] != nil { return .failed(error: "请查收验证邮件后再登录。", code: "email_confirmation_required") }
            return .failed(error: "注册失败", code: "register_failed")
        } catch {
            return .failed(error: "network", code: "network")
        }
    }

    struct Profile { let displayName: String?; let locale: String? }

    static func fetchProfile(token: String, userId: String) async -> Profile? {
        guard let (status, json) = try? await request("/rest/v1/askbible_profiles?select=display_name,locale&user_id=eq.\(userId)", method: "GET", token: token),
              status == 200, let rows = json as? [[String: Any]], let row = rows.first else { return nil }
        let dn = (row["display_name"] as? String)?.trimmingCharacters(in: .whitespaces)
        let lc = (row["locale"] as? String)?.trimmingCharacters(in: .whitespaces)
        return Profile(displayName: (dn?.isEmpty ?? true) ? nil : dn, locale: (lc?.isEmpty ?? true) ? nil : lc)
    }

    /// RN ensureOwnProfile：已有显示名且 locale 不变就不写；否则 upsert（on_conflict=user_id）
    static func ensureProfile(token: String, userId: String, displayName: String, locale: String?) async -> Profile? {
        let existing = await fetchProfile(token: token, userId: userId)
        let loc = (locale ?? "").trimmingCharacters(in: .whitespaces).prefix(24)
        if let e = existing, e.displayName != nil, loc.isEmpty || String(loc) == (e.locale ?? "") { return e }
        var row: [String: Any] = ["user_id": userId, "display_name": existing?.displayName ?? displayName,
                                  "updated_at": ISO8601DateFormatter.millis.string(from: Date())]
        if !loc.isEmpty { row["locale"] = String(loc) }
        _ = try? await request("/rest/v1/askbible_profiles?on_conflict=user_id", method: "POST", token: token, body: row,
                               extraHeaders: ["Prefer": "resolution=merge-duplicates,return=minimal"])
        return await fetchProfile(token: token, userId: userId) ?? existing
    }

    /// 改称呼：写 askbible_profiles.display_name（RN updateLocalDisplayName 之后同步）
    static func updateDisplayName(token: String, userId: String, name: String) async -> Bool {
        let row: [String: Any] = ["user_id": userId, "display_name": name, "updated_at": ISO8601DateFormatter.millis.string(from: Date())]
        guard let (status, _) = try? await request("/rest/v1/askbible_profiles?on_conflict=user_id", method: "POST", token: token, body: row,
                                                    extraHeaders: ["Prefer": "resolution=merge-duplicates,return=minimal"]) else { return false }
        return status >= 200 && status < 300
    }

    /// RN pullMemberProfileFromSupabase：token 还有效就返回最新用户；401/403 返回 nil（会话作废）；网络问题抛错
    static func verify(token: String) async throws -> MemberUser? {
        let (status, json) = try await request("/auth/v1/user", method: "GET", token: token)
        if status == 401 || status == 403 { return nil }
        guard status == 200, let u = json as? [String: Any], let id = u["id"] as? String, let email = u["email"] as? String, !email.isEmpty else {
            throw URLError(.badServerResponse)
        }
        let meta = (u["user_metadata"] as? [String: Any]) ?? [:]
        let profile = await fetchProfile(token: token, userId: id)
        let created = (u["created_at"] as? String)?.trimmingCharacters(in: .whitespaces)
        return MemberUser(id: id, email: email, name: profile?.displayName ?? MemberAuthRules.displayName(email: email, id: id, metadata: meta, fallback: nil),
                          locale: profile?.locale, createdAt: (created?.isEmpty ?? true) ? nil : created)
    }

    /// RN supabase.auth.signInWithIdToken：Apple / Google 原生凭证 → 会话（grant_type=id_token；nonce 传原文，GoTrue 自己算 hash 比对）
    static func signInWithIdToken(provider: String, idToken: String, nonce: String?, fallbackName: String?, locale: String?) async -> MemberAuthResult {
        var body: [String: Any] = ["provider": provider, "id_token": idToken]
        if let nonce, !nonce.isEmpty { body["nonce"] = nonce }
        do {
            // GoTrue 验 Apple / Google id_token 要去拿对方的公钥，实测一次 18 秒以上；15 秒就当断网会误报「网络连接失败」（Josh 真 iPhone 2026-09-09）
            let (status, json) = try await request("/auth/v1/token?grant_type=id_token", method: "POST", body: body, timeout: 90)
            if status >= 200, status < 300, let o = json as? [String: Any], let s = await session(from: o, fallbackName: fallbackName, locale: locale) {
                return .ok(s)
            }
            let msg = errorMessage(json, status: status)
            if MemberOAuthRules.isNetworkMessage(msg) { return .failed(error: "network", code: "network") }
            return .failed(error: msg, code: MemberOAuthRules.idTokenFailureCode(provider: provider, message: msg))
        } catch {
            return .failed(error: "network", code: "network")
        }
    }

    /// RN exchangeCodeForSession：浏览器 OAuth 回调里的 code + 本机 verifier → 会话（grant_type=pkce）
    static func exchangeCode(_ code: String, verifier: String, locale: String?) async -> MemberAuthResult {
        do {
            let (status, json) = try await request("/auth/v1/token?grant_type=pkce", method: "POST", body: ["auth_code": code, "code_verifier": verifier], timeout: 90)
            if status >= 200, status < 300, let o = json as? [String: Any], let s = await session(from: o, fallbackName: nil, locale: locale) {
                return .ok(s)
            }
            let msg = errorMessage(json, status: status)
            if MemberOAuthRules.isNetworkMessage(msg) { return .failed(error: "network", code: "network") }
            return .failed(error: msg, code: "google_failed")
        } catch {
            return .failed(error: "network", code: "network")
        }
    }

    /// RN setSession（回调直接带 access_token / refresh_token 的 implicit 分支）：拿 token 取用户后组会话
    static func sessionFromTokens(accessToken: String, locale: String?) async -> MemberAuthResult {
        do {
            let (status, json) = try await request("/auth/v1/user", method: "GET", token: accessToken)
            if status == 200, let u = json as? [String: Any],
               let s = await session(from: ["access_token": accessToken, "user": u], fallbackName: nil, locale: locale) { return .ok(s) }
            return .failed(error: errorMessage(json, status: status), code: "google_failed")
        } catch {
            return .failed(error: "network", code: "network")
        }
    }

    static func signOut(token: String) async {
        _ = try? await request("/auth/v1/logout", method: "POST", token: token)
    }
}
