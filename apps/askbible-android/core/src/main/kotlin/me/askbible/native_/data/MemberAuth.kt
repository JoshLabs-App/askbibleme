package me.askbible.native_.data

import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * 会员登录与读经同步客户端（DECISIONS D-44：去 Supabase → Cloudflare Worker `askbible-sync` + D1）。
 * 支持：6 位邮箱验证码登录、原生 ID Token 直验、会话滑动续期、修改昵称、原子注销账户、服务端单点权威合并读经同步。
 * 与 iOS `AskBibleSyncClient` 同构。
 */
data class MemberUser(
    val id: String,
    val email: String,
    val name: String,
    val locale: String? = null,
    val createdAt: String? = null,
    val isAdmin: Boolean? = null,
)

data class MemberSession(
    val sessionToken: String,
    val expiresAt: String,
    val user: MemberUser,
    val refreshToken: String? = null,
) {
    fun toJson(): String = JSONObject()
        .put("sessionToken", sessionToken)
        .put("expiresAt", expiresAt)
        .put(
            "user",
            JSONObject()
                .put("id", user.id)
                .put("email", user.email)
                .put("name", user.name)
                .put("locale", user.locale ?: JSONObject.NULL)
                .put("createdAt", user.createdAt ?: JSONObject.NULL)
                .also { u -> user.isAdmin?.let { u.put("isAdmin", it) } }
        )
        .also { o -> refreshToken?.let { o.put("refreshToken", it) } }
        .toString()
}

object MemberAuthRules {
    const val SESSION_KEY = "askbible.mobile.member-session.v1"
    const val DISPLAY_NAME_MAX_LEN = 24

    fun mapAuthError(message: String): Pair<String, String> {
        val m = message.trim().ifEmpty { "auth_failed" }
        fun has(p: String) = Regex(p, RegexOption.IGNORE_CASE).containsMatchIn(m)
        if (has("invalid_email")) return "请输入有效的邮箱地址。" to "invalid_email"
        if (has("invalid_otp")) return "验证码不正确，请核对后重试。" to "invalid_otp"
        if (has("otp_expired")) return "验证码已过期，请重新获取。" to "otp_expired"
        if (has("otp_too_many_attempts")) return "尝试次数过多，请重新获取验证码。" to "otp_too_many_attempts"
        if (has("network request failed|failed to fetch|network error|timed out|failed to connect")) return "network" to "network"
        return m to "auth_failed"
    }

    fun parseSession(raw: String, nowMs: Long = System.currentTimeMillis()): MemberSession? {
        val o = try { JSONObject(raw) } catch (_: Exception) { return null }
        val token = o.optString("sessionToken").trim()
        // 旧版 v1 JWT 含 `.` 分段，升到 v2 时静默丢弃旧 token（保留本机读经进度，重新登录即无缝合并同 UUID 账户）
        if (token.isEmpty() || token.contains('.')) return null
        val expiresAt = o.optString("expiresAt")
        val u = o.optJSONObject("user") ?: return null
        val id = u.optString("id")
        val email = u.optString("email")
        if (expiresAt.isEmpty() || id.isEmpty() || !u.has("email")) return null
        val exp = parseIso(expiresAt) ?: return null
        if (exp <= nowMs) return null
        val name = if (u.has("name") && !u.isNull("name")) u.getString("name") else email
        val created = if (u.isNull("createdAt")) null else u.optString("createdAt").trim().ifEmpty { null }
        val locale = if (u.isNull("locale")) null else u.optString("locale")
        val isAdmin = if (u.has("isAdmin") && !u.isNull("isAdmin")) u.optBoolean("isAdmin") else null
        return MemberSession(token, expiresAt, MemberUser(id, email, name, locale, created, isAdmin))
    }

    fun secondsUntilExpiry(s: MemberSession, nowMs: Long = System.currentTimeMillis()): Double =
        ((parseIso(s.expiresAt) ?: nowMs) - nowMs) / 1000.0

    fun parseIso(s: String): Long? = try { OffsetDateTime.parse(s).toInstant().toEpochMilli() } catch (_: Exception) { null }

    fun normalizeDisplayName(raw: String): String = raw.trim().replace(Regex("\\s+"), " ")

    fun shortAccountName(raw: String): String {
        val n = normalizeDisplayName(raw)
        val base = n.substringBefore('@')
        return if (base.length > 14) base.take(13) + "\u2026" else base
    }

    fun isValidDisplayName(raw: String): Boolean {
        val n = normalizeDisplayName(raw)
        return n.isNotEmpty() && n.length <= DISPLAY_NAME_MAX_LEN
    }

    fun greeting(user: MemberUser?): String {
        user ?: return "请登录，解锁更多"
        val n = normalizeDisplayName(user.name)
        return "你好，${n.ifEmpty { "用户" }}"
    }

    val ISO_MILLIS: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)
    fun isoNow(): String = ISO_MILLIS.format(Instant.now())

    fun expiresAtIso(expiresAtSeconds: Double? = null, nowMs: Long = System.currentTimeMillis()): String {
        val ms = if (expiresAtSeconds != null) (expiresAtSeconds * 1000).toLong() else nowMs + 365L * 86_400_000L
        return ISO_MILLIS.format(Instant.ofEpochMilli(ms))
    }
}

sealed class MemberAuthResult {
    data class Ok(val session: MemberSession) : MemberAuthResult()
    data class Failed(val error: String, val code: String) : MemberAuthResult()
}

sealed class OtpSendResult {
    data class Ok(val expiresInSec: Int) : OtpSendResult()
    data class Failed(val error: String, val code: String) : OtpSendResult()
}

object AskBibleSyncClient {
    data class VerifiedSession(val user: MemberUser, val expiresAt: String)
    sealed class VerifyOutcome {
        data class Ok(val session: VerifiedSession) : VerifyOutcome()
        object Unauthorized : VerifyOutcome()
        object TransientFailure : VerifyOutcome()
    }

    data class SyncDocument(val revision: String, val updatedAt: String, val blobs: JSONObject)
    sealed class SyncFetch {
        data class Ok(val doc: SyncDocument?) : SyncFetch()
        object Unauthorized : SyncFetch()
        data class Failed(val message: String) : SyncFetch()
        object Network : SyncFetch()
    }

    @Volatile var deviceId: String = UUID.randomUUID().toString()

    private class Response(val status: Int, val body: String)

    private fun request(path: String, method: String, token: String? = null, body: JSONObject? = null, timeoutMs: Int = 20_000): Response {
        val conn = URL(Endpoints.apiBase + path).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 15_000
        conn.readTimeout = timeoutMs
        conn.setRequestProperty("Accept", "application/json")
        conn.setRequestProperty("X-Platform", "android")
        conn.setRequestProperty("X-Device-Id", deviceId)
        if (!token.isNullOrEmpty()) conn.setRequestProperty("Authorization", "Bearer $token")
        if (body != null) {
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
        }
        val status = conn.responseCode
        val stream = if (status >= 400) conn.errorStream else conn.inputStream
        val text = stream?.bufferedReader()?.use(BufferedReader::readText) ?: ""
        conn.disconnect()
        return Response(status, text)
    }

    private fun json(body: String): JSONObject? = try { if (body.isBlank()) null else JSONObject(body) } catch (_: Exception) { null }

    private fun errorMessage(o: JSONObject?, status: Int): String {
        o ?: return "HTTP $status"
        for (k in listOf("error", "message", "msg")) o.optString(k).takeIf { it.isNotEmpty() }?.let { return it }
        return "HTTP $status"
    }

    private fun errorCode(o: JSONObject?, fallback: String): String =
        o?.optString("code")?.takeIf { it.isNotEmpty() } ?: fallback

    private fun parseUser(u: JSONObject): MemberUser? {
        val id = u.optString("id").ifEmpty { return null }
        val email = u.optString("email")
        val name = u.optString("name").trim().ifEmpty { email }
        val locale = if (u.isNull("locale")) null else u.optString("locale").ifEmpty { null }
        val created = if (u.isNull("createdAt")) null else u.optString("createdAt").trim().ifEmpty { null }
        val isAdmin = if (u.has("isAdmin") && !u.isNull("isAdmin")) u.optBoolean("isAdmin") else null
        return MemberUser(id, email, name, locale, created, isAdmin)
    }

    private fun parseSessionResponse(o: JSONObject): MemberSession? {
        val token = o.optString("sessionToken").trim().ifEmpty { return null }
        val u = o.optJSONObject("user") ?: return null
        val user = parseUser(u) ?: return null
        val expiresAt = o.optString("expiresAt").ifEmpty { MemberAuthRules.expiresAtIso() }
        return MemberSession(token, expiresAt, user)
    }

    /** 1. 发送 6 位邮箱验证码 */
    fun sendOtp(email: String, locale: String?): OtpSendResult = try {
        val clean = email.trim().lowercase()
        if (!clean.contains("@") || !clean.contains(".")) {
            OtpSendResult.Failed("请输入有效的邮箱地址。", "invalid_email")
        } else {
            val body = JSONObject().put("email", clean)
            if (!locale.isNullOrBlank()) body.put("locale", locale)
            val r = request("/v1/auth/otp/send", "POST", body = body)
            val o = json(r.body)
            if (r.status in 200..299 && o?.optBoolean("ok", true) != false) {
                OtpSendResult.Ok(o?.optInt("expiresInSec", 600) ?: 600)
            } else {
                OtpSendResult.Failed(errorMessage(o, r.status), errorCode(o, "otp_send_failed"))
            }
        }
    } catch (_: Exception) { OtpSendResult.Failed("network", "network") }

    /** 2. 校验 6 位验证码并建立会话 */
    fun verifyOtp(email: String, code: String, name: String?, locale: String?): MemberAuthResult = try {
        val clean = email.trim().lowercase()
        val digits = code.filter { it.isDigit() }
        if (digits.length != 6) {
            MemberAuthResult.Failed("请输入 6 位数字验证码。", "invalid_otp")
        } else {
            val body = JSONObject()
                .put("email", clean)
                .put("code", digits)
                .put("deviceId", deviceId)
                .put("platform", "android")
            name?.trim()?.takeIf { it.isNotEmpty() }?.let { body.put("displayName", it) }
            locale?.trim()?.takeIf { it.isNotEmpty() }?.let { body.put("locale", it) }
            val r = request("/v1/auth/otp/verify", "POST", body = body)
            val o = json(r.body)
            val s = if (r.status in 200..299 && o != null) parseSessionResponse(o) else null
            if (s != null) MemberAuthResult.Ok(s)
            else MemberAuthResult.Failed(errorMessage(o, r.status), errorCode(o, "invalid_otp"))
        }
    } catch (_: Exception) { MemberAuthResult.Failed("network", "network") }

    /** 3. 原生 Apple / Google ID Token 直验 */
    fun signInWithOAuthIdToken(provider: String, idToken: String, nonce: String?, fallbackName: String?, locale: String?): MemberAuthResult = try {
        val body = JSONObject()
            .put("idToken", idToken)
            .put("deviceId", deviceId)
            .put("platform", "android")
        if (!nonce.isNullOrEmpty()) body.put("nonce", nonce)
        if (!fallbackName.isNullOrBlank()) body.put("displayName", fallbackName.trim())
        if (!locale.isNullOrBlank()) body.put("locale", locale.trim())
        val path = if (provider == "apple") "/v1/auth/oauth/apple" else "/v1/auth/oauth/google"
        val r = request(path, "POST", body = body, timeoutMs = 30_000)
        val o = json(r.body)
        val s = if (r.status in 200..299 && o != null) parseSessionResponse(o) else null
        when {
            s != null -> MemberAuthResult.Ok(s)
            r.status == 429 || r.status >= 500 -> MemberAuthResult.Failed("network", "network")
            else -> {
                val msg = errorMessage(o, r.status)
                if (MemberOAuthRules.isNetworkMessage(msg)) MemberAuthResult.Failed("network", "network")
                else MemberAuthResult.Failed(msg, MemberOAuthRules.idTokenFailureCode(provider, msg))
            }
        }
    } catch (_: Exception) { MemberAuthResult.Failed("network", "network") }

    /** 4. 校验并滑动续期会话：401/403 返回 Unauthorized；429/5xx 或断网返回 TransientFailure（保留本机会话） */
    fun verify(token: String): VerifyOutcome = try {
        val r = request("/v1/auth/session", "GET", token)
        when {
            r.status == 401 || r.status == 403 -> VerifyOutcome.Unauthorized
            r.status == 200 -> {
                val o = json(r.body)
                val user = o?.optJSONObject("user")?.let { parseUser(it) }
                if (user != null) {
                    val expiresAt = o.optString("expiresAt").ifEmpty { MemberAuthRules.expiresAtIso() }
                    VerifyOutcome.Ok(VerifiedSession(user, expiresAt))
                } else VerifyOutcome.TransientFailure
            }
            else -> VerifyOutcome.TransientFailure
        }
    } catch (_: Exception) { VerifyOutcome.TransientFailure }

    /** 5. 修改昵称 */
    fun updateDisplayName(token: String, name: String, locale: String? = null): Boolean = try {
        val body = JSONObject().put("name", name)
        if (!locale.isNullOrBlank()) body.put("locale", locale)
        request("/v1/auth/profile", "PATCH", token, body).status in 200..299
    } catch (_: Exception) { false }

    /** 6. 退出当前设备会话 */
    fun signOut(token: String) {
        try { request("/v1/auth/logout", "POST", token) } catch (_: Exception) {}
    }

    /** 7. 原子删除账户（云端 D1 同步文档 + 会话 + 用户一并清除） */
    fun deleteAccount(token: String): String? = try {
        val r = request("/v1/auth/account", "DELETE", token, timeoutMs = 20_000)
        val o = json(r.body)
        if (r.status == 200 && o?.optBoolean("ok", true) != false) null
        else o?.optString("code")?.takeIf { it.isNotEmpty() }
            ?: o?.optString("error")?.takeIf { it.isNotEmpty() }
            ?: "network"
    } catch (_: Exception) { "network" }

    // ---- 会员读经同步（Worker 单点权威合并） ----

    private fun parseSyncDoc(raw: Any?): SyncDocument? {
        val d = raw as? JSONObject ?: return null
        return SyncDocument(
            d.optString("revision", "0"),
            d.optString("updatedAt", ""),
            d.optJSONObject("blobs") ?: JSONObject()
        )
    }

    fun fetchSyncDocument(token: String): SyncFetch = try {
        val r = request("/v1/sync/reading", "GET", token, timeoutMs = 30_000)
        val o = json(r.body)
        when {
            r.status == 401 || r.status == 403 -> SyncFetch.Unauthorized
            r.status != 200 || o?.optBoolean("ok", true) == false -> SyncFetch.Failed(errorMessage(o, r.status))
            o == null || o.isNull("doc") -> SyncFetch.Ok(null)
            else -> SyncFetch.Ok(parseSyncDoc(o.opt("doc")))
        }
    } catch (_: Exception) { SyncFetch.Network }

    fun pushSyncDocument(token: String, blobs: JSONObject, replace: Boolean = false): SyncFetch = try {
        val body = JSONObject().put("blobs", blobs)
        if (replace) body.put("replace", true)
        val r = request("/v1/sync/reading", "POST", token, body, timeoutMs = 30_000)
        val o = json(r.body)
        when {
            r.status == 401 || r.status == 403 -> SyncFetch.Unauthorized
            r.status !in 200..299 || o?.optBoolean("ok", true) == false -> SyncFetch.Failed(errorMessage(o, r.status))
            else -> SyncFetch.Ok(parseSyncDoc(o?.opt("doc")))
        }
    } catch (_: Exception) { SyncFetch.Network }
}
