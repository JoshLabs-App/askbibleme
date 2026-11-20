import CryptoKit
import Foundation

/// 原生 Apple / Google ID Token 登录纯规则（DECISIONS D-44：去浏览器 OAuth 跳转，保留 SHA-256 nonce、姓名拼接与错误文案映射）。
enum MemberOAuthRules {
    static let networkText = "网络连接失败，请稍后再试。"
    static let registerClosedText = "注册功能暂时关闭"
    static let googleFailedText = "Google 登录失败，请重试。"
    static let googleNotConfiguredText = "Google 登录暂时不可用，请稍后再试。"
    static let appleFailedText = "Apple 登录失败，请重试。"
    static let appleNotConfiguredText = "Apple 登录暂时不可用，请稍后再试。"

    /// SHA-256 小写 hex：Apple 授权请求传 hash，服务端校验 JWT nonce claim
    static func sha256Hex(_ s: String) -> String {
        SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    static func randomNonce() -> String { UUID().uuidString.lowercased() }

    static func isNetworkMessage(_ msg: String) -> Bool {
        msg.range(of: "network request failed|failed to fetch|network error|timed out|internet connection|offline|failed to connect",
                  options: [.regularExpression, .caseInsensitive]) != nil
    }

    static func idTokenFailureCode(provider: String, message: String) -> String {
        let m = message.trimmingCharacters(in: .whitespacesAndNewlines)
        if provider == "apple" {
            return m.range(of: "not configured|client_id|client id|bundle|audience", options: [.regularExpression, .caseInsensitive]) != nil
                ? "apple_not_configured" : "apple_auth_failed"
        }
        if m.range(of: "nonce", options: .caseInsensitive) != nil { return "google_nonce_mismatch" }
        return "google_auth_failed"
    }

    static func resolveError(provider: String, code: String?, error: String?, cancelled: Bool = false) -> String? {
        if cancelled { return nil }
        if error == "network" || code == "network" { return networkText }
        let c = (code ?? error ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let message = (error ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        func matches(_ p: String) -> Bool { message.range(of: p, options: [.regularExpression, .caseInsensitive]) != nil }
        if provider == "google" {
            if c == "google_not_configured" || c == "google_android_setup" { return googleNotConfiguredText }
            if c == "auth_disabled" { return !message.isEmpty && !message.hasPrefix("google_") ? message : registerClosedText }
            if isNetworkMessage(message) { return networkText }
            if !message.isEmpty, message != "google_failed", !message.hasPrefix("google_") { return message }
            return googleFailedText
        }
        if c == "apple_not_configured" || matches("audience|client_id|client id|bundle") { return appleNotConfiguredText }
        if c == "auth_disabled" { return !message.isEmpty && !message.hasPrefix("apple_") ? message : registerClosedText }
        if c == "apple_auth_failed", !message.isEmpty, !message.hasPrefix("apple_") { return message }
        if !message.isEmpty, !message.hasPrefix("apple_") { return message }
        return appleFailedText
    }

    /// Apple 只在首次授权时返回姓名
    static func appleFullName(given: String?, family: String?) -> String? {
        let joined = [given, family].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " ").trimmingCharacters(in: .whitespaces)
        return joined.isEmpty ? nil : joined
    }
}
