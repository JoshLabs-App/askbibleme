package me.askbible.native_.data

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/**
 * 会员登录（RN src/auth：memberSession / supabaseMemberAuth / memberAuthSessionCommit）。
 * RN 用 supabase-js 直连 Supabase（不经 askbible.me）；这里用同一套 GoTrue / PostgREST 接口手写请求。
 * 本机会话 JSON 与 RN 同形（sessionToken / expiresAt / user），键也一样。与 iOS MemberAuth.swift 同构。
 */
data class MemberUser(val id: String, val email: String, val name: String, val locale: String? = null, val createdAt: String? = null)

data class MemberSession(val sessionToken: String, val expiresAt: String, val user: MemberUser) {
    fun toJson(): String = JSONObject()
        .put("sessionToken", sessionToken).put("expiresAt", expiresAt)
        .put("user", JSONObject().put("id", user.id).put("email", user.email).put("name", user.name)
            .put("locale", user.locale ?: JSONObject.NULL).put("createdAt", user.createdAt ?: JSONObject.NULL))
        .toString()
}

/** 纯规则（check:member-auth 对拍）：错误文案映射、显示名回退、会话解析、称呼校验 */
object MemberAuthRules {
    const val SESSION_KEY = "askbible.mobile.member-session.v1"
    const val DISPLAY_NAME_MAX_LEN = 24

    /** RN mapAuthErrorMessage：GoTrue 的英文错误 → 中文提示 + code */
    fun mapAuthError(message: String): Pair<String, String> {
        val m = message.trim().ifEmpty { "auth_failed" }
        fun has(p: String) = Regex(p, RegexOption.IGNORE_CASE).containsMatchIn(m)
        if (has("invalid login credentials|invalid_credentials")) return "邮箱或密码不正确。" to "invalid_credentials"
        if (has("email not confirmed")) return "请先完成邮箱验证后再登录。" to "email_not_confirmed"
        if (has("user already registered|already been registered")) return "该邮箱已注册。" to "email_taken"
        if (has("network request failed|failed to fetch|network error|timed out|failed to connect")) return "network" to "network"
        return m to "auth_failed"
    }

    /** RN displayNameFromUser：优先传入的名字，再看 user_metadata 的 full_name / name / display_name，最后邮箱、id */
    fun displayName(email: String, id: String, metadata: Map<String, Any?>, fallback: String?): String {
        fallback?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
        for (k in listOf("full_name", "name", "display_name")) {
            (metadata[k] as? String)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
        }
        return email.ifEmpty { id }
    }

    /** RN readMemberSession：字段齐全且未过期才算有会话 */
    fun parseSession(raw: String, nowMs: Long = System.currentTimeMillis()): MemberSession? {
        val o = try { JSONObject(raw) } catch (_: Exception) { return null }
        val token = o.optString("sessionToken").trim()
        val expiresAt = o.optString("expiresAt")
        val u = o.optJSONObject("user") ?: return null
        val id = u.optString("id"); val email = u.optString("email")
        if (token.isEmpty() || expiresAt.isEmpty() || id.isEmpty() || !u.has("email")) return null
        val exp = parseIso(expiresAt) ?: return null
        if (exp <= nowMs) return null
        val name = if (u.has("name") && !u.isNull("name")) u.getString("name") else email
        val created = if (u.isNull("createdAt")) null else u.optString("createdAt").trim().ifEmpty { null }
        val locale = if (u.isNull("locale")) null else u.optString("locale")
        return MemberSession(token, expiresAt, MemberUser(id, email, name, locale, created))
    }

    /** JS Date.toISOString() 带毫秒；有的接口不带 */
    fun parseIso(s: String): Long? = try { OffsetDateTime.parse(s).toInstant().toEpochMilli() } catch (_: Exception) { null }

    /** RN normalizeExploreDisplayName / isValidExploreDisplayName */
    fun normalizeDisplayName(raw: String): String = raw.trim().replace(Regex("\\s+"), " ")
    fun isValidDisplayName(raw: String): Boolean { val n = normalizeDisplayName(raw); return n.isNotEmpty() && n.length <= DISPLAY_NAME_MAX_LEN }

    /** 探索页抬头：登录了「你好，名字」，没登录「请登录，解锁更多」 */
    fun greeting(user: MemberUser?): String {
        user ?: return "请登录，解锁更多"
        val n = normalizeDisplayName(user.name)
        return "你好，${n.ifEmpty { "用户" }}"
    }

    /** JS Date.toISOString() 同款：永远带毫秒（ISO_INSTANT 在毫秒为 0 时会省掉） */
    val ISO_MILLIS: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)
    fun isoNow(): String = ISO_MILLIS.format(Instant.now())

    /** GoTrue 的 expires_at（unix 秒）→ ISO；缺了按一小时 */
    fun expiresAtIso(expiresAtSeconds: Double?, nowMs: Long = System.currentTimeMillis()): String {
        val ms = if (expiresAtSeconds != null) (expiresAtSeconds * 1000).toLong() else nowMs + 3_600_000
        return ISO_MILLIS.format(Instant.ofEpochMilli(ms))
    }
}

/** Supabase 直连（与 RN app.config extra.supabaseUrl / anon key 同一套；anon key 是公开的发布密钥，RN 包里也带着） */
object SupabaseAuthConfig {
    const val URL = "https://tgobadhdylarhssudplc.supabase.co"
    const val ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb2JhZGhkeWxhcmhzc3VkcGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMTMwMDAsImV4cCI6MjA5Njc4OTAwMH0.5EqC5hJFmydZaVBmpXJk1ddJNGX_fY2hN83k5IzAO3I"
}

sealed class MemberAuthResult {
    data class Ok(val session: MemberSession) : MemberAuthResult()
    data class Failed(val error: String, val code: String) : MemberAuthResult()
}

/** GoTrue（/auth/v1）+ PostgREST（/rest/v1/askbible_profiles）请求；阻塞式，调用方放 IO 线程；失败给 RN 同款文案 */
object SupabaseAuthClient {
    private class Response(val status: Int, val body: String)

    private fun request(path: String, method: String, token: String? = null, body: JSONObject? = null, extra: Map<String, String> = emptyMap(), timeoutMs: Int = 15_000): Response {
        val conn = URL(SupabaseAuthConfig.URL + path).openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.connectTimeout = 15_000; conn.readTimeout = timeoutMs
        conn.setRequestProperty("apikey", SupabaseAuthConfig.ANON_KEY)
        conn.setRequestProperty("Accept", "application/json")
        conn.setRequestProperty("Authorization", "Bearer ${token ?: SupabaseAuthConfig.ANON_KEY}")
        for ((k, v) in extra) conn.setRequestProperty(k, v)
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
        for (k in listOf("error_description", "msg", "message", "error")) o.optString(k).takeIf { it.isNotEmpty() }?.let { return it }
        return "HTTP $status"
    }

    private fun metadata(u: JSONObject): Map<String, Any?> {
        val m = u.optJSONObject("user_metadata") ?: return emptyMap()
        return m.keys().asSequence().associateWith { m.opt(it) }
    }

    /** 把 GoTrue 的 session JSON 变成本机会话（顺手保证 askbible_profiles 有一行） */
    private fun session(o: JSONObject, fallbackName: String?, locale: String?): MemberSession? {
        val token = o.optString("access_token").ifEmpty { return null }
        val u = o.optJSONObject("user") ?: return null
        val id = u.optString("id").ifEmpty { return null }
        val email = u.optString("email")
        val expiresAt = MemberAuthRules.expiresAtIso(if (o.has("expires_at")) o.optDouble("expires_at") else null)
        val created = u.optString("created_at").trim().ifEmpty { null }
        val fallback = MemberAuthRules.displayName(email, id, metadata(u), fallbackName)
        val profile = ensureProfile(token, id, fallback, locale)
        return MemberSession(token, expiresAt, MemberUser(id, email, profile?.displayName ?: fallback, profile?.locale, created))
    }

    fun signIn(email: String, password: String, locale: String?): MemberAuthResult = try {
        val r = request("/auth/v1/token?grant_type=password", "POST", body = JSONObject().put("email", email.trim()).put("password", password))
        val o = json(r.body)
        val s = if (r.status in 200..299 && o != null) session(o, null, locale) else null
        if (s != null) MemberAuthResult.Ok(s) else MemberAuthRules.mapAuthError(errorMessage(o, r.status)).let { MemberAuthResult.Failed(it.first, it.second) }
    } catch (_: Exception) { MemberAuthResult.Failed("network", "network") }

    fun signUp(email: String, password: String, name: String, locale: String?): MemberAuthResult = try {
        val data = JSONObject()
        val n = name.trim()
        if (n.isNotEmpty()) { data.put("name", n); data.put("display_name", n) }
        locale?.trim()?.takeIf { it.isNotEmpty() }?.let { data.put("locale", it) }
        val r = request("/auth/v1/signup", "POST", body = JSONObject().put("email", email.trim()).put("password", password).put("data", data))
        val o = json(r.body)
        when {
            r.status !in 200..299 || o == null -> MemberAuthRules.mapAuthError(errorMessage(o, r.status)).let { MemberAuthResult.Failed(it.first, it.second) }
            o.has("access_token") -> session(o, n, locale)?.let { MemberAuthResult.Ok(it) } ?: MemberAuthResult.Failed("注册失败", "register_failed")
            // 没给 session 只给了 user：要先点邮件里的验证链接
            o.has("id") || o.has("user") -> MemberAuthResult.Failed("请查收验证邮件后再登录。", "email_confirmation_required")
            else -> MemberAuthResult.Failed("注册失败", "register_failed")
        }
    } catch (_: Exception) { MemberAuthResult.Failed("network", "network") }

    data class Profile(val displayName: String?, val locale: String?)

    fun fetchProfile(token: String, userId: String): Profile? = try {
        val r = request("/rest/v1/askbible_profiles?select=display_name,locale&user_id=eq.$userId", "GET", token)
        if (r.status != 200) null else {
            val rows = JSONArray(r.body)
            if (rows.length() == 0) null else {
                val row = rows.getJSONObject(0)
                Profile(row.optString("display_name").trim().ifEmpty { null }, row.optString("locale").trim().ifEmpty { null })
            }
        }
    } catch (_: Exception) { null }

    /** RN ensureOwnProfile：已有显示名且 locale 不变就不写；否则 upsert（on_conflict=user_id） */
    fun ensureProfile(token: String, userId: String, displayName: String, locale: String?): Profile? {
        val existing = fetchProfile(token, userId)
        val loc = (locale ?: "").trim().take(24)
        if (existing?.displayName != null && (loc.isEmpty() || loc == (existing.locale ?: ""))) return existing
        val row = JSONObject().put("user_id", userId).put("display_name", existing?.displayName ?: displayName)
            .put("updated_at", MemberAuthRules.isoNow())
        if (loc.isNotEmpty()) row.put("locale", loc)
        try { request("/rest/v1/askbible_profiles?on_conflict=user_id", "POST", token, row, mapOf("Prefer" to "resolution=merge-duplicates,return=minimal")) } catch (_: Exception) {}
        return fetchProfile(token, userId) ?: existing
    }

    /** 改称呼：写 askbible_profiles.display_name */
    fun updateDisplayName(token: String, userId: String, name: String): Boolean = try {
        val row = JSONObject().put("user_id", userId).put("display_name", name).put("updated_at", MemberAuthRules.isoNow())
        request("/rest/v1/askbible_profiles?on_conflict=user_id", "POST", token, row, mapOf("Prefer" to "resolution=merge-duplicates,return=minimal")).status in 200..299
    } catch (_: Exception) { false }

    /** RN pullMemberProfileFromSupabase：token 还有效就返回最新用户；401/403 返回 null（会话作废）；网络问题抛错 */
    fun verify(token: String): MemberUser? {
        val r = request("/auth/v1/user", "GET", token)
        if (r.status == 401 || r.status == 403) return null
        val u = json(r.body)
        val id = u?.optString("id").orEmpty(); val email = u?.optString("email").orEmpty()
        if (r.status != 200 || u == null || id.isEmpty() || email.isEmpty()) throw IllegalStateException("HTTP ${r.status}")
        val profile = fetchProfile(token, id)
        val created = u.optString("created_at").trim().ifEmpty { null }
        return MemberUser(id, email, profile?.displayName ?: MemberAuthRules.displayName(email, id, metadata(u), null), profile?.locale, created)
    }

    /** RN supabase.auth.signInWithIdToken：Apple / Google 原生凭证 → 会话（grant_type=id_token；nonce 传原文） */
    fun signInWithIdToken(provider: String, idToken: String, nonce: String?, fallbackName: String?, locale: String?): MemberAuthResult = try {
        val body = JSONObject().put("provider", provider).put("id_token", idToken)
        if (!nonce.isNullOrEmpty()) body.put("nonce", nonce)
        // GoTrue 验 id_token 要去拿对方公钥，实测 18 秒以上；15 秒就当断网会误报（与 iOS 同）
        val r = request("/auth/v1/token?grant_type=id_token", "POST", body = body, timeoutMs = 90_000)
        val o = json(r.body)
        val s = if (r.status in 200..299 && o != null) session(o, fallbackName, locale) else null
        if (s != null) MemberAuthResult.Ok(s) else {
            val msg = errorMessage(o, r.status)
            if (MemberOAuthRules.isNetworkMessage(msg)) MemberAuthResult.Failed("network", "network")
            else MemberAuthResult.Failed(msg, MemberOAuthRules.idTokenFailureCode(provider, msg))
        }
    } catch (_: Exception) { MemberAuthResult.Failed("network", "network") }

    /** RN exchangeCodeForSession：浏览器 OAuth 回调里的 code + 本机 verifier → 会话（grant_type=pkce） */
    fun exchangeCode(code: String, verifier: String, locale: String?): MemberAuthResult = try {
        val r = request("/auth/v1/token?grant_type=pkce", "POST", body = JSONObject().put("auth_code", code).put("code_verifier", verifier), timeoutMs = 90_000)
        val o = json(r.body)
        val s = if (r.status in 200..299 && o != null) session(o, null, locale) else null
        if (s != null) MemberAuthResult.Ok(s) else {
            val msg = errorMessage(o, r.status)
            if (MemberOAuthRules.isNetworkMessage(msg)) MemberAuthResult.Failed("network", "network") else MemberAuthResult.Failed(msg, "google_failed")
        }
    } catch (_: Exception) { MemberAuthResult.Failed("network", "network") }

    /** RN setSession（回调直接带 access_token 的 implicit 分支）：拿 token 取用户后组会话 */
    fun sessionFromTokens(accessToken: String, locale: String?): MemberAuthResult = try {
        val r = request("/auth/v1/user", "GET", accessToken)
        val u = json(r.body)
        val s = if (r.status == 200 && u != null) session(JSONObject().put("access_token", accessToken).put("user", u), null, locale) else null
        if (s != null) MemberAuthResult.Ok(s) else MemberAuthResult.Failed(errorMessage(u, r.status), "google_failed")
    } catch (_: Exception) { MemberAuthResult.Failed("network", "network") }

    fun signOut(token: String) { try { request("/auth/v1/logout", "POST", token) } catch (_: Exception) {} }
}
