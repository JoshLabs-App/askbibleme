import CryptoKit
import Foundation

/// 第三方登录纯规则（check:member-auth 对拍）——照抄 RN：
/// googleOAuthBrowser / googleOAuthSession（Supabase PKCE 浏览器 OAuth，回到 askbible://auth/callback）、
/// appleSignIn（SHA-256 nonce、姓名拼接）、appleSignInExchange（Supabase 错误 → code）、resolveMemberOAuthError（错误 → 文案）。
enum MemberOAuthRules {
    /// RN GOOGLE_OAUTH_APP_REDIRECT_URI：App 内发起的登录默认回到 App
    static let appRedirect = "askbible://auth/callback"
    static let callbackScheme = "askbible"

    static let networkText = "网络连接失败，请稍后再试。"
    static let registerClosedText = "注册功能暂时关闭"
    static let googleFailedText = "Google 登录失败，请重试。"
    static let googleNotConfiguredText = "Google 登录暂时不可用，请稍后再试。"
    static let appleFailedText = "Apple 登录失败，请重试。"
    static let appleNotConfiguredText = "Apple 登录尚未配置。请在 Supabase 的 Apple 提供商中登记 Bundle ID：me.askbible.native。"

    // MARK: PKCE / nonce

    /// supabase-js generatePKCEVerifier：56 个 [a-zA-Z0-9]
    static func randomVerifier() -> String {
        let chars = Array("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        return String((0..<56).map { _ in chars[Int.random(in: 0..<chars.count)] })
    }

    /// code_challenge = base64url(sha256(verifier))，无 padding
    static func pkceChallenge(_ verifier: String) -> String {
        let digest = SHA256.hash(data: Data(verifier.utf8))
        return Data(digest).base64EncodedString()
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }

    /// RN expo-crypto digestStringAsync(SHA256)：小写 hex；Apple / Google 要的是 hash，Supabase 校验时要原文
    static func sha256Hex(_ s: String) -> String {
        SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// RN Crypto.randomUUID()
    static func randomNonce() -> String { UUID().uuidString.lowercased() }

    // MARK: URL

    /// JS encodeURIComponent：只留 A-Z a-z 0-9 - _ . ! ~ * ' ( )
    static func encodeURIComponent(_ s: String) -> String {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")
        return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s
    }

    /// supabase-js 把 code_challenge 先 encodeURIComponent 再塞 URLSearchParams（又编码一次）；base64url 的 challenge 两次都是原样
    private static func formEncodeEncoded(_ s: String) -> String {
        var out = ""
        for ch in s {
            switch ch {
            case "%": out += "%25"
            case "!": out += "%21"
            case "~": out += "%7E"
            case "'": out += "%27"
            case "(": out += "%28"
            case ")": out += "%29"
            default: out.append(ch)
            }
        }
        return out
    }

    /// supabase-js _getUrlForProvider（flowType pkce）：/auth/v1/authorize?provider=…&redirect_to=…&code_challenge=…&code_challenge_method=s256
    static func authorizeURL(provider: String, redirectTo: String, challenge: String, base: String = SupabaseAuthConfig.url) -> String {
        "\(base)/auth/v1/authorize?provider=\(encodeURIComponent(provider))&redirect_to=\(encodeURIComponent(redirectTo))"
            + "&code_challenge=\(formEncodeEncoded(encodeURIComponent(challenge)))&code_challenge_method=s256"
    }

    /// RN isGoogleOAuthCallbackUrl
    static func isCallbackURL(_ url: String) -> Bool {
        if url.hasPrefix(appRedirect) { return true }
        guard let c = URLComponents(string: url), c.scheme != nil else { return false }
        return c.path == "/auth/callback" || c.path == "/auth/mobile-callback"
    }

    struct CallbackParams: Equatable {
        var code: String?
        var errorCode: String?
        var accessToken: String?
        var refreshToken: String?
    }

    /// RN parseQueryParams：先 query 再 fragment（后者覆盖）；error_code 优先于 error；code 去空白
    static func parseCallback(_ url: String) -> CallbackParams {
        var params: [String: String] = [:]
        func read(_ segment: Substring) {
            for part in segment.split(separator: "&", omittingEmptySubsequences: true) {
                let kv = part.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
                let key = String(kv[0]).removingPercentEncoding ?? String(kv[0])
                let value = kv.count > 1 ? (String(kv[1]).removingPercentEncoding ?? String(kv[1])) : ""
                if !key.isEmpty { params[key] = value }
            }
        }
        let q = url.firstIndex(of: "?")
        let h = url.firstIndex(of: "#")
        if let q {
            let end = h.map { $0 > q ? $0 : url.endIndex } ?? url.endIndex
            read(url[url.index(after: q)..<end])
        }
        if let h { read(url[url.index(after: h)...]) }
        func nonEmpty(_ k: String) -> String? { let v = params[k] ?? ""; return v.isEmpty ? nil : v }
        let code = params["code"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        return CallbackParams(code: (code?.isEmpty ?? true) ? nil : code,
                              errorCode: nonEmpty("error_code") ?? nonEmpty("error"),
                              accessToken: params["access_token"]?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty,
                              refreshToken: params["refresh_token"]?.trimmingCharacters(in: .whitespacesAndNewlines).nonEmpty)
    }

    // MARK: 错误映射

    /// RN resolveMemberOAuthError / appleSignInExchange 用的网络错误判断
    static func isNetworkMessage(_ msg: String) -> Bool {
        msg.range(of: "network request failed|failed to fetch|network error|timed out|internet connection|offline|failed to connect",
                  options: [.regularExpression, .caseInsensitive]) != nil
    }

    /// RN appleSignInExchange / googleOAuthSession：Supabase signInWithIdToken 的错误 → code
    static func idTokenFailureCode(provider: String, message: String) -> String {
        let m = message.trimmingCharacters(in: .whitespacesAndNewlines)
        if provider == "apple" {
            return m.range(of: "not configured|client_id|client id|bundle|audience", options: [.regularExpression, .caseInsensitive]) != nil
                ? "apple_not_configured" : "apple_auth_failed"
        }
        if m.range(of: "nonce", options: .caseInsensitive) != nil,
           m.range(of: "both exist|mismatch|id_token", options: [.regularExpression, .caseInsensitive]) != nil { return "google_nonce_mismatch" }
        return "google_auth_failed"
    }

    /// RN resolveMemberOAuthError：原生 / Supabase 的失败 → 给用户看的文案（取消返回 nil）
    static func resolveError(provider: String, code: String?, error: String?, cancelled: Bool = false) -> String? {
        if cancelled { return nil }
        if error == "network" || code == "network" { return networkText }
        let c = (code ?? error ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let message = (error ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        func matches(_ p: String) -> Bool { message.range(of: p, options: [.regularExpression, .caseInsensitive]) != nil }
        if provider == "google" {
            if c == "google_not_configured" || c == "google_android_setup" { return googleNotConfiguredText }
            if c == "google_play_services" { return googleFailedText }
            if c == "auth_disabled" { return !message.isEmpty && !message.hasPrefix("google_") ? message : registerClosedText }
            if c == "google_auth_failed", !message.isEmpty, !message.hasPrefix("google_") { return message }
            if isNetworkMessage(message) { return networkText }
            if matches("redirect|invalid.*url|not allowed") { return googleNotConfiguredText }
            if message.contains("Google") || message.contains("谷歌") { return message }
            if !message.isEmpty, message != "google_failed", !message.hasPrefix("google_") { return message }
            return googleFailedText
        }
        if c == "apple_not_configured" { return appleNotConfiguredText }
        if matches("audience|client_id|client id|bundle") { return appleNotConfiguredText }
        if c == "auth_disabled" { return !message.isEmpty && !message.hasPrefix("apple_") ? message : registerClosedText }
        if c == "apple_auth_failed", !message.isEmpty, !message.hasPrefix("apple_") { return message }
        if message.contains("Apple") || message.contains("苹果") || c.hasPrefix("apple_") {
            if !message.isEmpty, !message.hasPrefix("apple_") { return message }
            return appleFailedText
        }
        return appleFailedText
    }

    /// RN formatAppleFullName：名 + 姓，空则 nil（Apple 只在第一次授权时给名字）
    static func appleFullName(given: String?, family: String?) -> String? {
        let joined = [given, family].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ").trimmingCharacters(in: .whitespaces)
        return joined.isEmpty ? nil : joined
    }
}

private extension String {
    var nonEmpty: String? { isEmpty ? nil : self }
}
