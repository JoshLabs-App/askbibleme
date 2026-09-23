package me.askbible.native_.update

import android.app.Activity
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import me.askbible.native_.BuildConfig

/**
 * 商店版的更新提醒：Google Play 官方的 In-App Update。
 *
 * **为什么不能复用 AppUpdater**：Play 政策禁止商店版 App 自己下载 APK 安装，
 * 也禁止引导用户去站外下载同一个 App——两条都是下架级别的。
 * Play 允许的做法就是这个 API：包仍然由 Play 下载安装，
 * 但弹窗、进度、「点一下更新」的体验和自助更新是一样的，用户不用去商店页面翻。
 *
 * 用 FLEXIBLE 流程：后台下载，下完提示重启装上，不打断正在读经的用户。
 */
object PlayUpdateGate {

    /** 在 Activity.onCreate 里调一次；web / sideload 变体是空操作。 */
    fun start(activity: Activity, requestCode: Int = 4801) {
        if (BuildConfig.SELF_UPDATE) return // 站外分发版走 AppUpdater，两套不能同时开
        val manager = AppUpdateManagerFactory.create(activity)

        val listener = InstallStateUpdatedListener { state ->
            if (state.installStatus() == InstallStatus.DOWNLOADED) {
                // 下完了才提示；completeUpdate 会重启 App 装上
                manager.completeUpdate()
            }
        }
        manager.registerListener(listener)

        manager.appUpdateInfo
            .addOnSuccessListener { info ->
                val available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                if (available && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                    runCatching {
                        manager.startUpdateFlowForResult(info, AppUpdateType.FLEXIBLE, activity, requestCode)
                    }
                } else {
                    manager.unregisterListener(listener)
                }
            }
            .addOnFailureListener { manager.unregisterListener(listener) }
    }
}
