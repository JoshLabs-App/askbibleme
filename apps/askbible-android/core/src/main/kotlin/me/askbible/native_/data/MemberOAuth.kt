package me.askbible.native_.data

import java.security.MessageDigest
import java.util.UUID

/** 原生 ID Token 登录纯规则（DECISIONS D-44：去除浏览器 OAuth PKCE 跳转，保留 SHA-256 nonce 与错误文案映射）。 */
object MemberOAuthRules {
    const val NETWORK_TEXT = "网络连接失败，请稍后再试。"
    const val REGISTER_CLOSED_TEXT = "注册功能暂时关闭"
    const val GOOGLE_FAILED_TEXT = "Google 登录失败，请重试。"
    const val GOOGLE_NOT_CONFIGURED_TEXT = "Google 登录暂时不可用，请稍后再试。"
    const val APPLE_FAILED_TEXT = "Apple 登录失败，请重试。"
    const val APPLE_NOT_CONFIGURED_TEXT = "Apple 登录暂时不可用，请稍后再试。"

    fun sha256Hex(s: String): String =
        MessageDigest.getInstance("SHA-256").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

    fun randomNonce(): String = UUID.randomUUID().toString()

    fun isNetworkMessage(msg: String): Boolean =
        Regex("network request failed|failed to fetch|network error|timed out|internet connection|offline|failed to connect", RegexOption.IGNORE_CASE).containsMatchIn(msg)

    fun idTokenFailureCode(provider: String, message: String): String {
        val m = message.trim()
        if (provider == "apple") {
            return if (Regex("not configured|client_id|client id|bundle|audience", RegexOption.IGNORE_CASE).containsMatchIn(m))
                "apple_not_configured" else "apple_auth_failed"
        }
        if (m.contains("nonce", ignoreCase = true)) return "google_nonce_mismatch"
        return "google_auth_failed"
    }

    fun resolveError(provider: String, code: String?, error: String?, cancelled: Boolean = false): String? {
        if (cancelled) return null
        if (error == "network" || code == "network") return NETWORK_TEXT
        val c = (code ?: error ?: "").trim()
        val message = (error ?: "").trim()
        if (provider == "google") {
            if (c == "google_not_configured" || c == "google_android_setup") return GOOGLE_NOT_CONFIGURED_TEXT
            if (c == "auth_disabled") return if (message.isNotEmpty() && !message.startsWith("google_")) message else REGISTER_CLOSED_TEXT
            if (isNetworkMessage(message)) return NETWORK_TEXT
            if (message.isNotEmpty() && message != "google_failed" && !message.startsWith("google_")) return message
            return GOOGLE_FAILED_TEXT
        }
        if (c == "apple_not_configured" || Regex("audience|client_id|client id|bundle", RegexOption.IGNORE_CASE).containsMatchIn(message)) {
            return APPLE_NOT_CONFIGURED_TEXT
        }
        if (c == "auth_disabled") return if (message.isNotEmpty() && !message.startsWith("apple_")) message else REGISTER_CLOSED_TEXT
        if (message.isNotEmpty() && !message.startsWith("apple_")) return message
        return APPLE_FAILED_TEXT
    }
}
