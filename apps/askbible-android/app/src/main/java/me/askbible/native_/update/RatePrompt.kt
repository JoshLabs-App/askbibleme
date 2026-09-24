package me.askbible.native_.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import com.google.android.play.core.review.ReviewManagerFactory

/**
 * 好评邀请（Josh 2026-09-23「增加一个去给我们在商店里好评反馈的弹出框」）。
 *
 * **两条路，按包从哪来选**：
 * - 商店版走 **Play 官方的应用内评价**（`ReviewManagerFactory`）——不跳出 App，
 *   弹窗由 Play 自己画。Play 有自己的配额，不保证每次都真的弹，这是设计如此，别加重试。
 * - 站外版（下载页装的）**没有 Play 的入口可用**，只能跳到 Play 商店页让用户手写评价。
 *
 * **时机和 iOS 同一套**（`RatePrompt.swift`）：读过 ≥ 5 章、装机 ≥ 3 天、每个版本只问一次。
 * 一进来就问像推销，问早了用户也没话可说。
 */
object RatePrompt {

    private const val PREFS = "app_rate"
    private const val KEY_FIRST_RUN = "first_run_at"
    private const val KEY_ASKED_VERSION = "asked_version"

    private const val MIN_CHAPTERS = 5
    private const val MIN_DAYS_MS = 3L * 24 * 60 * 60 * 1000

    /** App 启动时调一次，记下「首次运行」的时间 */
    fun noteLaunch(context: Context) {
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (sp.getLong(KEY_FIRST_RUN, 0L) == 0L) {
            sp.edit().putLong(KEY_FIRST_RUN, System.currentTimeMillis()).apply()
        }
    }

    /** 读完一章之后调；条件不满足就什么都不做 */
    fun maybeAsk(context: Context, chaptersRead: Int) {
        if (chaptersRead < MIN_CHAPTERS) return
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val firstRun = sp.getLong(KEY_FIRST_RUN, 0L)
        if (firstRun == 0L || System.currentTimeMillis() - firstRun < MIN_DAYS_MS) return

        val version = BuildConfigVersionName(context)
        if (sp.getString(KEY_ASKED_VERSION, null) == version) return
        sp.edit().putString(KEY_ASKED_VERSION, version).apply()

        if (BuildConfigSelfUpdate()) {
            // 站外版：没有 Play 的应用内评价，只能送去商店页
            openStoreListing(context)
            return
        }
        val activity = context.findActivity() ?: return
        val manager = ReviewManagerFactory.create(context)
        manager.requestReviewFlow().addOnCompleteListener { task ->
            if (task.isSuccessful) runCatching { manager.launchReviewFlow(activity, task.result) }
        }
    }

    /** 「去评分」的手动入口：优先开 Play App，没有就开网页 */
    fun openStoreListing(context: Context) {
        val pkg = context.packageName.removeSuffix(".native")
        val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val web = Intent(Intent.ACTION_VIEW,
                         Uri.parse("https://play.google.com/store/apps/details?id=$pkg"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(market) }.onFailure {
            runCatching { context.startActivity(web) }
        }
    }
}

@Composable
fun RateLaunchNote() {
    val context = androidx.compose.ui.platform.LocalContext.current
    LaunchedEffect(Unit) { RatePrompt.noteLaunch(context) }
}

private fun BuildConfigVersionName(context: Context): String =
    runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "0"
    }.getOrDefault("0")

private fun BuildConfigSelfUpdate(): Boolean = me.askbible.native_.BuildConfig.SELF_UPDATE

private fun Context.findActivity(): android.app.Activity? {
    var c: Context? = this
    while (c is android.content.ContextWrapper) {
        if (c is android.app.Activity) return c
        c = c.baseContext
    }
    return null
}
