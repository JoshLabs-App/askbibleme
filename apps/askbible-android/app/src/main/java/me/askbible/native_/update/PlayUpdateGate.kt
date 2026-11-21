package me.askbible.native_.update

import android.app.Activity
import android.content.Context
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import kotlinx.coroutines.suspendCancellableCoroutine
import me.askbible.native_.BuildConfig
import kotlin.coroutines.resume

/**
 * 商店版的更新提醒：Google Play 官方的 In-App Update。
 *
 * **为什么不能复用 AppUpdater**：Play 政策禁止商店版 App 自己下载 APK 安装，
 * 也禁止引导用户去站外下载同一个 App——两条都是下架级别的。
 * Play 允许的做法就是这个 API：包仍然由 Play 下载安装，
 * 但弹窗、进度、「点一下更新」的体验和自助更新是一样的，用户不用去商店页面翻。
 *
 * 用 FLEXIBLE 流程：后台下载，下完自动装上，不打断正在读经的用户。
 */
object PlayUpdateGate {

    enum class ManualOutcome {
        STARTED_FLOW,
        COMPLETED_DOWNLOADED,
        UP_TO_DATE,
        UNAVAILABLE,
    }

    private const val PREFS = "play_in_app_update"
    private const val KEY_LAST_AUTO_CHECK = "last_auto_check_ms"
    private const val AUTO_CHECK_INTERVAL_MS = 6L * 3600L * 1000L

    private var activeManager: AppUpdateManager? = null
    private var activeListener: InstallStateUpdatedListener? = null

    private fun releaseListener() {
        val m = activeManager
        val l = activeListener
        activeManager = null
        activeListener = null
        if (m != null && l != null) {
            runCatching { m.unregisterListener(l) }
        }
    }

    private fun attachDownloadListener(manager: AppUpdateManager) {
        releaseListener()
        lateinit var listener: InstallStateUpdatedListener
        listener = InstallStateUpdatedListener { state ->
            when (state.installStatus()) {
                InstallStatus.DOWNLOADED -> {
                    releaseListener()
                    runCatching { manager.completeUpdate() }
                }
                InstallStatus.INSTALLED,
                InstallStatus.FAILED,
                InstallStatus.CANCELED -> releaseListener()
                else -> {}
            }
        }
        activeManager = manager
        activeListener = listener
        manager.registerListener(listener)
    }

    /** 启动或回前台时调用：若后台已下完新包立即完成安装，否则按 6 小时节流静默拉起 FLEXIBLE 更新。 */
    fun start(activity: Activity, force: Boolean = false, requestCode: Int = 4801) {
        if (BuildConfig.SELF_UPDATE) return // 站外分发版走 AppUpdater，两套不能同时开
        val sp = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val manager = AppUpdateManagerFactory.create(activity)

        manager.appUpdateInfo
            .addOnSuccessListener { info ->
                if (info.installStatus() == InstallStatus.DOWNLOADED) {
                    releaseListener()
                    runCatching { manager.completeUpdate() }
                    return@addOnSuccessListener
                }
                if (!force && now - sp.getLong(KEY_LAST_AUTO_CHECK, 0L) < AUTO_CHECK_INTERVAL_MS) {
                    return@addOnSuccessListener
                }
                sp.edit().putLong(KEY_LAST_AUTO_CHECK, now).apply()
                val available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                if (available && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                    attachDownloadListener(manager)
                    val started = runCatching {
                        manager.startUpdateFlowForResult(info, AppUpdateType.FLEXIBLE, activity, requestCode)
                    }.getOrDefault(false)
                    if (!started) releaseListener()
                }
            }
    }

    /** 用户在侧栏点击「检查更新」：不受 6 小时节流约束，直接向 Google Play 查询并拉起更新。 */
    suspend fun checkManual(activity: Activity, requestCode: Int = 4801): ManualOutcome {
        if (BuildConfig.SELF_UPDATE) return ManualOutcome.UNAVAILABLE
        val manager = AppUpdateManagerFactory.create(activity)
        return suspendCancellableCoroutine { cont ->
            manager.appUpdateInfo
                .addOnSuccessListener { info ->
                    val sp = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    sp.edit().putLong(KEY_LAST_AUTO_CHECK, System.currentTimeMillis()).apply()

                    if (info.installStatus() == InstallStatus.DOWNLOADED) {
                        releaseListener()
                        runCatching { manager.completeUpdate() }
                        if (cont.isActive) cont.resume(ManualOutcome.COMPLETED_DOWNLOADED)
                        return@addOnSuccessListener
                    }
                    val availability = info.updateAvailability()
                    if (availability == UpdateAvailability.UPDATE_AVAILABLE && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                        attachDownloadListener(manager)
                        val started = runCatching {
                            manager.startUpdateFlowForResult(info, AppUpdateType.FLEXIBLE, activity, requestCode)
                        }.getOrDefault(false)
                        if (!started) releaseListener()
                        if (cont.isActive) {
                            cont.resume(if (started) ManualOutcome.STARTED_FLOW else ManualOutcome.UNAVAILABLE)
                        }
                    } else if (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                        if (cont.isActive) cont.resume(ManualOutcome.STARTED_FLOW)
                    } else {
                        if (cont.isActive) cont.resume(ManualOutcome.UP_TO_DATE)
                    }
                }
                .addOnFailureListener {
                    if (cont.isActive) cont.resume(ManualOutcome.UNAVAILABLE)
                }
        }
    }
}
