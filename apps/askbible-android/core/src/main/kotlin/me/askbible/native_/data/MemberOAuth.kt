package me.askbible.native_.data

import java.net.URI
import java.net.URLDecoder
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * 第三方登录纯规则（check:member-auth 对拍）——照抄 RN：
 * googleOAuthBrowser / googleOAuthSession（Supabase PKCE 浏览器 OAuth，回到 askbible://auth/callback）、
 * appleSignIn（SHA-256 nonce、姓名拼接）、appleSignInExchange（Supabase 错误 → code）、resolveMemberOAuthError（错误 → 文案）。
 * 与 iOS Model/MemberOAuth.swift 同构。
 */
object MemberOAuthRules {
    /** RN GOOGLE_OAUTH_APP_REDIRECT_URI：App 内发起的登录默认回到 App */
    const val APP_REDIRECT = "askbible://auth/callback"
    const val CALLBACK_SCHEME = "askbible"

    const val NETWORK_TEXT = "网络连接失败，请稍后再试。"
    const val REGISTER_CLOSED_TEXT = "注册功能暂时关闭"
    const val GOOGLE_FAILED_TEXT = "Google 登录失败，请重试。"
    const val GOOGLE_NOT_CONFIGURED_TEXT = "Google 登录暂时不可用，请稍后再试。"
    const val APPLE_FAILED_TEXT = "Apple 登录失败，请重试。"
    const val APPLE_NOT_CONFIGURED_TEXT = "Apple 登录尚未配置。请在 Supabase 的 Apple 提供商中登记 Bundle ID：me.askbible.native。"

    private const val VERIFIER_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

    // ---- PKCE / nonce ----

    /** supabase-js generatePKCEVerifier：56 个 [a-zA-Z0-9] */
    fun randomVerifier(): String {
        val rnd = SecureRandom()
        return buildString(56) { repeat(56) { append(VERIFIER_CHARS[rnd.nextInt(VERIFIER_CHARS.length)]) } }
    }

    private fun sha256(s: String): ByteArray = MessageDigest.getInstance("SHA-256").digest(s.toByteArray(Charsets.UTF_8))

    /** code_challenge = base64url(sha256(verifier))，无 padding */
    fun pkceChallenge(verifier: String): String = Base64.getUrlEncoder().withoutPadding().encodeToString(sha256(verifier))

    /** RN expo-crypto digestStringAsync(SHA256)：小写 hex */
    fun sha256Hex(s: String): String = sha256(s).joinToString("") { "%02x".format(it) }

    /** RN Crypto.randomUUID() */
    fun randomNonce(): String = java.util.UUID.randomUUID().toString().lowercase()

    // ---- URL ----

    private const val URI_SAFE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()"

    /** JS encodeURIComponent：只留 A-Z a-z 0-9 - _ . ! ~ * ' ( ) */
    fun encodeURIComponent(s: String): String {
        val sb = StringBuilder()
        for (b in s.toByteArray(Charsets.UTF_8)) {
            val c = b.toInt() and 0xFF
            if (c < 0x80 && URI_SAFE.indexOf(c.toChar()) >= 0) sb.append(c.toChar()) else sb.append('%').append("%02X".format(c))
        }
        return sb.toString()
    }

    /** JS decodeURIComponent（'+' 不当空格） */
    private fun decodeURIComponent(s: String): String = try { URLDecoder.decode(s.replace("+", "%2B"), "UTF-8") } catch (_: Exception) { s }

    /** supabase-js 把 code_challenge 先 encodeURIComponent 再塞 URLSearchParams（又编码一次）；base64url 的 challenge 两次都是原样 */
    private fun formEncodeEncoded(s: String): String = buildString {
        for (ch in s) when (ch) {
            '%' -> append("%25"); '!' -> append("%21"); '~' -> append("%7E"); '\'' -> append("%27"); '(' -> append("%28"); ')' -> append("%29")
            else -> append(ch)
        }
    }

    /** supabase-js _getUrlForProvider（flowType pkce） */
    fun authorizeUrl(provider: String, redirectTo: String, challenge: String, base: String = SupabaseAuthConfig.URL): String =
        "$base/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirectTo)}" +
            "&code_challenge=${formEncodeEncoded(encodeURIComponent(challenge))}&code_challenge_method=s256"

    /** RN isGoogleOAuthCallbackUrl */
    fun isCallbackUrl(url: String): Boolean {
        if (url.startsWith(APP_REDIRECT)) return true
        return try {
            val u = URI(url)
            u.scheme != null && (u.rawPath == "/auth/callback" || u.rawPath == "/auth/mobile-callback")
        } catch (_: Exception) { false }
    }

    data class CallbackParams(val code: String?, val errorCode: String?, val accessToken: String?, val refreshToken: String?)

    /** RN parseQueryParams：先 query 再 fragment（后者覆盖）；error_code 优先于 error；code 去空白 */
    fun parseCallback(url: String): CallbackParams {
        val params = HashMap<String, String>()
        fun read(segment: String) {
            for (part in segment.split("&")) {
                if (part.isEmpty()) continue
                val eq = part.indexOf('=')
                val key = decodeURIComponent(if (eq >= 0) part.substring(0, eq) else part)
                val value = if (eq >= 0) decodeURIComponent(part.substring(eq + 1)) else ""
                if (key.isNotEmpty()) params[key] = value
            }
        }
        val q = url.indexOf('?')
        val h = url.indexOf('#')
        if (q >= 0) read(url.substring(q + 1, if (h > q) h else url.length))
        if (h >= 0) read(url.substring(h + 1))
        fun nonEmpty(k: String): String? = params[k]?.takeIf { it.isNotEmpty() }
        return CallbackParams(
            code = params["code"]?.trim()?.takeIf { it.isNotEmpty() },
            errorCode = nonEmpty("error_code") ?: nonEmpty("error"),
            accessToken = params["access_token"]?.trim()?.takeIf { it.isNotEmpty() },
            refreshToken = params["refresh_token"]?.trim()?.takeIf { it.isNotEmpty() },
        )
    }

    // ---- 错误映射 ----

    private fun String.has(pattern: String) = Regex(pattern, RegexOption.IGNORE_CASE).containsMatchIn(this)

    /** RN resolveMemberOAuthError / appleSignInExchange 用的网络错误判断 */
    fun isNetworkMessage(msg: String): Boolean =
        msg.has("network request failed|failed to fetch|network error|timed out|internet connection|offline|failed to connect")

    /** RN appleSignInExchange / googleOAuthSession：Supabase signInWithIdToken 的错误 → code */
    fun idTokenFailureCode(provider: String, message: String): String {
        val m = message.trim()
        if (provider == "apple") return if (m.has("not configured|client_id|client id|bundle|audience")) "apple_not_configured" else "apple_auth_failed"
        if (m.has("nonce") && m.has("both exist|mismatch|id_token")) return "google_nonce_mismatch"
        return "google_auth_failed"
    }

    /** RN resolveMemberOAuthError：原生 / Supabase 的失败 → 给用户看的文案（取消返回 null） */
    fun resolveError(provider: String, code: String?, error: String?, cancelled: Boolean = false): String? {
        if (cancelled) return null
        if (error == "network" || code == "network") return NETWORK_TEXT
        val c = (code ?: error ?: "").trim()
        val message = (error ?: "").trim()
        if (provider == "google") {
            if (c == "google_not_configured" || c == "google_android_setup") return GOOGLE_NOT_CONFIGURED_TEXT
            if (c == "google_play_services") return GOOGLE_FAILED_TEXT
            if (c == "auth_disabled") return if (message.isNotEmpty() && !message.startsWith("google_")) message else REGISTER_CLOSED_TEXT
            if (c == "google_auth_failed" && message.isNotEmpty() && !message.startsWith("google_")) return message
            if (isNetworkMessage(message)) return NETWORK_TEXT
            if (message.has("redirect|invalid.*url|not allowed")) return GOOGLE_NOT_CONFIGURED_TEXT
            if (message.contains("Google") || message.contains("谷歌")) return message
            if (message.isNotEmpty() && message != "google_failed" && !message.startsWith("google_")) return message
            return GOOGLE_FAILED_TEXT
        }
        if (c == "apple_not_configured") return APPLE_NOT_CONFIGURED_TEXT
        if (message.has("audience|client_id|client id|bundle")) return APPLE_NOT_CONFIGURED_TEXT
        if (c == "auth_disabled") return if (message.isNotEmpty() && !message.startsWith("apple_")) message else REGISTER_CLOSED_TEXT
        if (c == "apple_auth_failed" && message.isNotEmpty() && !message.startsWith("apple_")) return message
        if (message.contains("Apple") || message.contains("苹果") || c.startsWith("apple_")) {
            return if (message.isNotEmpty() && !message.startsWith("apple_")) message else APPLE_FAILED_TEXT
        }
        return APPLE_FAILED_TEXT
    }

    /** RN formatAppleFullName：名 + 姓，空则 null */
    fun appleFullName(given: String?, family: String?): String? =
        listOfNotNull(given, family).filter { it.isNotEmpty() }.joinToString(" ").trim().ifEmpty { null }
}
