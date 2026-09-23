package me.askbible.native_.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import me.askbible.native_.BuildConfig
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 站外分发（从下载页装的包）的自助更新。
 *
 * 只在 `web` 变体里生效（BuildConfig.SELF_UPDATE）——Play 版严禁自带下载安装逻辑，
 * 商店渠道的更新由 Play 自己推。真源是 deploy_android.py 每次发版写的
 * `https://askbible-media.joshlabs.app/version.json`。
 */
object AppUpdater {

    const val VERSION_URL = "https://askbible-media.joshlabs.app/version.json"

    data class Info(
        val version: String,
        val versionCode: Int,
        val apkUrl: String,
        val notes: String,
    )

    private const val PREFS = "app_update"
    private const val KEY_SKIPPED = "skipped_code"
    private const val KEY_LAST_CHECK = "last_check_at"
    /** 用户点过「以后再说」的版本，6 小时内不再打扰 */
    private const val QUIET_MS = 6 * 60 * 60 * 1000L

    /** 返回比当前包新、且用户没在静默期里压掉的版本；没有就 null。 */
    suspend fun check(context: Context, force: Boolean = false): Info? = withContext(Dispatchers.IO) {
        if (!BuildConfig.SELF_UPDATE) return@withContext null
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (!force && now - prefs.getLong(KEY_LAST_CHECK, 0L) < QUIET_MS) return@withContext null

        val info = fetch() ?: return@withContext null
        prefs.edit().putLong(KEY_LAST_CHECK, now).apply()
        if (info.versionCode <= BuildConfig.VERSION_CODE) return@withContext null
        if (!force && prefs.getInt(KEY_SKIPPED, 0) >= info.versionCode) return@withContext null
        info
    }

    fun skip(context: Context, info: Info) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putInt(KEY_SKIPPED, info.versionCode).apply()
    }

    private fun fetch(): Info? = try {
        val conn = (URL(VERSION_URL).openConnection() as HttpURLConnection).apply {
            connectTimeout = 8000
            readTimeout = 8000
            setRequestProperty("Cache-Control", "no-cache")
        }
        conn.use {
            if (it.responseCode != 200) null
            else {
                val o = JSONObject(it.inputStream.bufferedReader().readText())
                val url = o.optString("apkUrl")
                if (url.isBlank()) null else Info(
                    version = o.optString("version"),
                    versionCode = o.optInt("versionCode"),
                    apkUrl = url,
                    notes = o.optString("notes"),
                )
            }
        }
    } catch (_: Exception) {
        null
    }

    private inline fun <T> HttpURLConnection.use(block: (HttpURLConnection) -> T): T =
        try { block(this) } finally { disconnect() }

    /** Android 8+ 装未知来源包要逐 App 授权；没授权先把用户送去开关页。 */
    fun needsInstallPermission(context: Context): Boolean =
        !context.packageManager.canRequestPackageInstalls()

    fun openInstallPermission(context: Context) {
        context.startActivity(
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    /**
     * 下载 APK 并拉起系统安装器。[onProgress] 回 0f..1f，失败回 null。
     * 用系统 DownloadManager：断网续传、通知栏进度都是它自带的，不自己造。
     */
    suspend fun downloadAndInstall(
        context: Context,
        info: Info,
        onProgress: (Float) -> Unit,
    ): Boolean = withContext(Dispatchers.IO) {
        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val name = "AskBible-${info.version}.apk"
        // 每次重下，避免拿到上次下坏的半截包
        File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), name).delete()

        val id = dm.enqueue(
            DownloadManager.Request(Uri.parse(info.apkUrl))
                .setTitle("AskBible ${info.version}")
                .setDescription("正在下载更新…")
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, name)
        )

        while (true) {
            val q = DownloadManager.Query().setFilterById(id)
            val c = dm.query(q) ?: return@withContext false
            c.use {
                if (!it.moveToFirst()) return@withContext false
                val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                val got = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
                val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                when (status) {
                    DownloadManager.STATUS_SUCCESSFUL -> {
                        onProgress(1f)
                        val file = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), name)
                        install(context, file)
                        return@withContext true
                    }
                    DownloadManager.STATUS_FAILED -> return@withContext false
                    else -> if (total > 0) onProgress((got.toFloat() / total).coerceIn(0f, 1f))
                }
            }
            delay(400)
        }
        @Suppress("UNREACHABLE_CODE")
        return@withContext false
    }

    private fun install(context: Context, apk: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.updates", apk)
        context.startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }
}
