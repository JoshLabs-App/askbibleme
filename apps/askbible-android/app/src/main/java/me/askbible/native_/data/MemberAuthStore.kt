package me.askbible.native_.data

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * 会员登录状态（DECISIONS D-44：`askbible-sync` 1 年滑动会话 + 6 位邮箱验证码登录）。
 * 保留完整的 `MemberSessionState`（`revision` / `accountRevision`）隔离，与 iOS `MemberAuthStore.swift` 同构。
 */
class MemberAuthStore(context: Context) {
    private companion object {
        const val KEY_DEVICE_ID = "sync-device-id-v1"
    }

    private val sp = context.applicationContext.getSharedPreferences("member-auth", Context.MODE_PRIVATE)
    var user by mutableStateOf<MemberUser?>(null); private set
    private val sessionState = MemberSessionState()
    private val session: MemberSession? get() = sessionState.session
    private val refreshMutex = Mutex()
    val accountRevision: Long get() = sessionState.accountRevision

    var isAdmin by mutableStateOf(false); private set
    private fun adminKey(userId: String) = "is-admin.$userId"
    val sessionToken: String? get() = session?.sessionToken

    init {
        val devId = sp.getString(KEY_DEVICE_ID, null) ?: UUID.randomUUID().toString().also {
            sp.edit().putString(KEY_DEVICE_ID, it).apply()
        }
        AskBibleSyncClient.deviceId = devId

        val s = sp.getString(MemberAuthRules.SESSION_KEY, null)?.let { MemberAuthRules.parseSession(it) }
        if (s != null) {
            sessionState.replace(s)
            user = s.user
            isAdmin = s.user.isAdmin ?: sp.getBoolean(adminKey(s.user.id), false)
        } else {
            sp.edit().remove(MemberAuthRules.SESSION_KEY).apply()
        }
    }

    suspend fun refreshAdminFlag() {
        verifyRemote()
    }

    /** 拿一个有效 token：距过期不足 24 小时时滑动续期一次；429/5xx/断网保留当前有效会话 */
    suspend fun ensureFreshToken(): String? = refreshMutex.withLock {
        val s = session ?: return@withLock null
        if (MemberAuthRules.secondsUntilExpiry(s) <= 0) {
            persist(null)
            return@withLock null
        }
        if (MemberAuthRules.secondsUntilExpiry(s) >= 86_400) return@withLock s.sessionToken
        verifyCurrentLocked(s)
    }

    private suspend fun verifyCurrentLocked(s: MemberSession): String? {
        val token = s.sessionToken
        val revision = sessionState.revision
        val outcome = try {
            withContext(Dispatchers.IO) { AskBibleSyncClient.verify(token) }
        } catch (e: CancellationException) {
            throw e
        }
        if (sessionState.revision != revision) return session?.sessionToken
        return when (outcome) {
            is AskBibleSyncClient.VerifyOutcome.Ok -> {
                var remoteUser = outcome.session.user
                val current = session ?: return null
                if (remoteUser.id != current.user.id) return null
                if (current.user.name != s.user.name) remoteUser = remoteUser.copy(name = current.user.name)
                if (current.user.locale != s.user.locale) remoteUser = remoteUser.copy(locale = current.user.locale)
                remoteUser = remoteUser.copy(createdAt = remoteUser.createdAt ?: current.user.createdAt)
                val next = MemberSession(token, outcome.session.expiresAt, remoteUser)
                persistIfCurrent(revision, next)
                next.sessionToken
            }
            AskBibleSyncClient.VerifyOutcome.Unauthorized -> {
                persistIfCurrent(revision, null)
                null
            }
            AskBibleSyncClient.VerifyOutcome.TransientFailure -> {
                val current = session ?: return null
                if (MemberAuthRules.secondsUntilExpiry(current) > 0) current.sessionToken else null
            }
        }
    }

    private fun persist(s: MemberSession?) {
        sessionState.replace(s)
        publishSession()
    }

    private fun persistIfCurrent(revision: Long, s: MemberSession?): Boolean {
        if (!sessionState.replaceIfCurrent(revision, s)) return false
        publishSession()
        return true
    }

    private fun publishSession() {
        val s = session
        user = s?.user
        if (s != null) {
            val admin = s.user.isAdmin ?: sp.getBoolean(adminKey(s.user.id), false)
            isAdmin = admin
            sp.edit()
                .putBoolean(adminKey(s.user.id), admin)
                .putString(MemberAuthRules.SESSION_KEY, s.toJson())
                .apply()
        } else {
            isAdmin = false
            sp.edit().remove(MemberAuthRules.SESSION_KEY).apply()
        }
    }

    /** 启动后校验会话：401/403 清掉本机会话；断网或 5xx 保留本机会话 */
    suspend fun verifyRemote() {
        refreshMutex.withLock {
            val s = session ?: return@withLock
            verifyCurrentLocked(s)
        }
    }

    /** 发送 6 位邮箱验证码（成功返回 null，失败返回错误文案） */
    suspend fun sendOtp(email: String, locale: String): String? =
        when (val r = withContext(Dispatchers.IO) { AskBibleSyncClient.sendOtp(email, locale) }) {
            is OtpSendResult.Ok -> null
            is OtpSendResult.Failed -> r.error
        }

    /** 校验 6 位邮箱验证码并建立会话（成功返回 null，失败返回错误文案） */
    suspend fun verifyOtp(email: String, code: String, name: String? = null, locale: String): String? {
        val revision = sessionState.revision
        return when (val r = withContext(Dispatchers.IO) { AskBibleSyncClient.verifyOtp(email, code, name, locale) }) {
            is MemberAuthResult.Ok -> { persistIfCurrent(revision, r.session); null }
            is MemberAuthResult.Failed -> r.error
        }
    }

    suspend fun signOut() {
        val token = session?.sessionToken
        persist(null)
        if (token != null) withContext(Dispatchers.IO) { AskBibleSyncClient.signOut(token) }
    }

    /** 原子删除账户（`DELETE /v1/auth/account`）：确认成功后才清本机态 */
    suspend fun deleteAccount(): String? {
        val account = accountRevision
        val s = session ?: return "unauthorized"
        if (MemberAuthRules.secondsUntilExpiry(s) <= 0) return "unauthorized"
        val error = withContext(Dispatchers.IO) { AskBibleSyncClient.deleteAccount(s.sessionToken) }
        if (error == null && accountRevision == account) persist(null)
        return error
    }

    /** 改称呼：先改本机（马上生效），再写服务端 profile */
    suspend fun updateDisplayName(raw: String): Boolean {
        val name = MemberAuthRules.normalizeDisplayName(raw)
        if (!MemberAuthRules.isValidDisplayName(name)) return false
        val account = accountRevision
        val s = refreshMutex.withLock {
            if (accountRevision != account) return false
            val current = session ?: return false
            persist(current.copy(user = current.user.copy(name = name)))
            current
        }
        withContext(Dispatchers.IO) { AskBibleSyncClient.updateDisplayName(s.sessionToken, name, s.user.locale) }
        return true
    }
}
