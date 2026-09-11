package me.askbible.native_.data

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * 会员登录状态（RN useMemberAuthProvider + useMemberAuthBootstrap）：本机会话 + 启动时后台校验。
 * 登录 / 注册成功即写会话；退出清会话（服务端 logout 尽力而为）。与 iOS MemberAuthStore 同构。
 */
class MemberAuthStore(context: Context) {
    private companion object {
        const val KEY_VERIFIER = "oauth-pkce-verifier"
        const val KEY_LOCALE = "oauth-locale"
    }

    private val sp = context.applicationContext.getSharedPreferences("member-auth", Context.MODE_PRIVATE)
    var user by mutableStateOf<MemberUser?>(null); private set
    private var session: MemberSession? = null
    /** 当前会话 token（读经同步用；没登录为 null） */
    val sessionToken: String? get() = session?.sessionToken

    init {
        // 过期但带 refresh_token 的也先算登着（启动后 verifyRemote 会先续期）；RN 是一过期就登出
        val s = sp.getString(MemberAuthRules.SESSION_KEY, null)?.let { MemberAuthRules.parseSession(it, System.currentTimeMillis(), allowExpired = true) }
        if (s != null) { session = s; user = s.user } else sp.edit().remove(MemberAuthRules.SESSION_KEY).apply()
    }

    /** 拿一个还能用的 access token：快到期（2 分钟内）就先用 refresh_token 续；续期被拒（已作废）→ 登出；断网 → 先用旧的 */
    suspend fun ensureFreshToken(): String? {
        val s = session ?: return null
        if (MemberAuthRules.secondsUntilExpiry(s) >= 120) return s.sessionToken
        val rt = s.refreshToken ?: return if (MemberAuthRules.secondsUntilExpiry(s) <= 0) { persist(null); null } else s.sessionToken
        return when (val r = withContext(Dispatchers.IO) { SupabaseAuthClient.refresh(rt, s.user.locale) }) {
            is MemberAuthResult.Ok -> { val next = r.session.copy(user = r.session.user.copy(createdAt = r.session.user.createdAt ?: s.user.createdAt)); persist(next); next.sessionToken }
            is MemberAuthResult.Failed -> if (r.code == "network") (if (MemberAuthRules.secondsUntilExpiry(s) > 0) s.sessionToken else null) else { persist(null); null }
        }
    }

    private fun persist(s: MemberSession?) {
        session = s
        user = s?.user
        if (s != null) sp.edit().putString(MemberAuthRules.SESSION_KEY, s.toJson()).apply()
        else sp.edit().remove(MemberAuthRules.SESSION_KEY).apply()
    }

    /** 启动后校验会话：token 作废就清掉；网络不通保留本机会话（RN 同） */
    suspend fun verifyRemote() {
        if (session == null) return
        val token = ensureFreshToken() ?: return
        val s = session ?: return
        val remote = try { withContext(Dispatchers.IO) { SupabaseAuthClient.verify(token) } } catch (_: Exception) { return }
        if (remote != null) persist(MemberSession(token, s.expiresAt, remote.copy(createdAt = remote.createdAt ?: s.user.createdAt), s.refreshToken))
        else {
            // access token 被服务端作废但 refresh_token 还在：续一次
            val rt = s.refreshToken
            val refreshed = if (rt != null) withContext(Dispatchers.IO) { SupabaseAuthClient.refresh(rt, s.user.locale) } else null
            if (refreshed is MemberAuthResult.Ok) persist(refreshed.session) else persist(null)
        }
    }

    /** 成功返回 null，失败返回错误文案（"network" 由页面换成中文） */
    suspend fun signIn(email: String, password: String, locale: String): String? =
        when (val r = withContext(Dispatchers.IO) { SupabaseAuthClient.signIn(email, password, locale) }) {
            is MemberAuthResult.Ok -> { persist(r.session); null }
            is MemberAuthResult.Failed -> r.error
        }

    suspend fun register(email: String, password: String, name: String, locale: String): String? =
        when (val r = withContext(Dispatchers.IO) { SupabaseAuthClient.signUp(email, password, name, locale) }) {
            is MemberAuthResult.Ok -> { persist(r.session); null }
            is MemberAuthResult.Failed -> r.error
        }

    // ---- Google：Supabase 浏览器 OAuth（RN signInWithGoogleMobile 的 Supabase browser OAuth 分支）----

    /** 第三方登录结果：成功 / 用户取消（不提示）/ 失败（文案） */
    sealed class SocialOutcome {
        object Done : SocialOutcome()
        object Cancelled : SocialOutcome()
        data class Failed(val message: String) : SocialOutcome()
    }

    /** 浏览器 OAuth 进行中（按钮转圈） */
    var oauthPending by mutableStateOf(false); private set
    /** 最近一次浏览器 OAuth 的结果；登录页消费后 clearOAuthResult() */
    var oauthResult by mutableStateOf<SocialOutcome?>(null); private set
    private var callbackHandled = false
    private val scope = CoroutineScope(Dispatchers.Main)

    /** 开 Custom Tab 到 Supabase /authorize（PKCE）；verifier 落盘，进程被杀后回调回来也能换 */
    fun startGoogleSignIn(context: Context, locale: String) {
        if (oauthPending) return
        val verifier = MemberOAuthRules.randomVerifier()
        sp.edit().putString(KEY_VERIFIER, verifier).putString(KEY_LOCALE, locale).apply()
        oauthPending = true; oauthResult = null; callbackHandled = false
        val url = MemberOAuthRules.authorizeUrl("google", MemberOAuthRules.APP_REDIRECT, MemberOAuthRules.pkceChallenge(verifier))
        try {
            CustomTabsIntent.Builder().setShowTitle(false).build().launchUrl(context, Uri.parse(url))
        } catch (_: Exception) {
            oauthPending = false
            oauthResult = SocialOutcome.Failed(MemberOAuthRules.resolveError("google", "google_failed", "no browser") ?: MemberOAuthRules.GOOGLE_FAILED_TEXT)
            sp.edit().remove(KEY_VERIFIER).remove(KEY_LOCALE).apply()
        }
    }

    /**
     * askbible://auth/callback?code=… 回来：code + verifier 换会话（RN completeGoogleOAuthFromCallbackUrl）。
     * 在 store 自己的 scope 里跑，不挂在 Compose 的 LaunchedEffect 上——回调总线一清空 effect 就被取消，会把换会话卡在半路。
     */
    fun handleOAuthCallback(url: String) {
        if (!MemberOAuthRules.isCallbackUrl(url)) return
        callbackHandled = true
        scope.launch { exchangeCallback(url) }
    }

    private suspend fun exchangeCallback(url: String) {
        val verifier = sp.getString(KEY_VERIFIER, null)
        val locale = sp.getString(KEY_LOCALE, null)
        sp.edit().remove(KEY_VERIFIER).remove(KEY_LOCALE).apply()
        oauthPending = true
        val p = MemberOAuthRules.parseCallback(url)
        val errorCode = p.errorCode
        val code = p.code
        val access = p.accessToken
        val outcome: SocialOutcome = when {
            errorCode != null -> SocialOutcome.Failed(MemberOAuthRules.resolveError("google", errorCode, errorCode) ?: MemberOAuthRules.GOOGLE_FAILED_TEXT)
            code != null && verifier != null -> finishSocial(withContext(Dispatchers.IO) { SupabaseAuthClient.exchangeCode(code, verifier, locale) }, "google")
            access != null && p.refreshToken != null -> finishSocial(withContext(Dispatchers.IO) { SupabaseAuthClient.sessionFromTokens(access, locale) }, "google")
            else -> finishSocial(MemberAuthResult.Failed("missing_code", "google_failed"), "google")
        }
        oauthPending = false
        oauthResult = outcome
    }

    /** 回到前台却一直没回调（用户关了浏览器）：1.5 秒后仍没有就算取消 */
    fun onResumedFromBrowser() {
        if (!oauthPending || callbackHandled) return
        scope.launch {
            delay(1500)
            if (oauthPending && !callbackHandled) { oauthPending = false; oauthResult = SocialOutcome.Cancelled }
        }
    }

    fun clearOAuthResult() { oauthResult = null }

    private fun finishSocial(r: MemberAuthResult, provider: String): SocialOutcome = when (r) {
        is MemberAuthResult.Ok -> { persist(r.session); SocialOutcome.Done }
        is MemberAuthResult.Failed -> SocialOutcome.Failed(
            MemberOAuthRules.resolveError(provider, r.code, r.error) ?: if (provider == "apple") MemberOAuthRules.APPLE_FAILED_TEXT else MemberOAuthRules.GOOGLE_FAILED_TEXT,
        )
    }

    suspend fun signOut() {
        val token = session?.sessionToken
        persist(null)
        if (token != null) withContext(Dispatchers.IO) { SupabaseAuthClient.signOut(token) }
    }

    /**
     * 删除账户（RN deleteAccount → DELETE /api/mobile/auth/account）：服务端删掉会员，本机再登出。
     * 返回 null 表示成功，否则是错误码。
     */
    suspend fun deleteAccount(): String? = withContext(Dispatchers.IO) {
        val token = ensureFreshToken() ?: return@withContext "unauthorized"
        try {
            val url = java.net.URL("https://askbible.me/api/mobile/auth/account")
            val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                requestMethod = "DELETE"
                connectTimeout = 20_000
                readTimeout = 20_000
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Accept", "application/json")
            }
            val status = conn.responseCode
            val body = (if (status in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            val json = runCatching { org.json.JSONObject(body) }.getOrNull()
            if (status == 200 && json?.optBoolean("ok", true) != false) {
                persist(null)
                null
            } else {
                json?.optString("code")?.takeIf { it.isNotEmpty() }
                    ?: json?.optString("error")?.takeIf { it.isNotEmpty() }
                    ?: "network"
            }
        } catch (_: Throwable) {
            "network"
        }
    }

    /** 改称呼：先改本机（马上生效），再写服务端 profile */
    suspend fun updateDisplayName(raw: String): Boolean {
        val name = MemberAuthRules.normalizeDisplayName(raw)
        val s = session ?: return false
        if (!MemberAuthRules.isValidDisplayName(name)) return false
        persist(MemberSession(s.sessionToken, s.expiresAt, s.user.copy(name = name), s.refreshToken))
        withContext(Dispatchers.IO) { SupabaseAuthClient.updateDisplayName(s.sessionToken, s.user.id, name) }
        return true
    }
}
