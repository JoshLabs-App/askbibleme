package me.askbible.native_.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import me.askbible.native_.BuildConfig
import me.askbible.native_.data.Parchment
import me.askbible.native_.ui.toColor
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * 商店版 → 站外版的迁移提示（Josh 2026-09-23 要求）。
 *
 * ⚠️ 两件事必须记住，别在后面的线程里当成普通功能改：
 *
 * 1. **这违反 Google Play 政策**（引导用户去站外获取同一个 App，Deceptive Behavior），
 *    开着被抽查到是下架级别的。所以**默认关**，开关在远端
 *    `https://askbible-media.joshlabs.app/migrate.json`，随时能关掉、不用发版。
 * 2. **迁移过去的用户会丢本地数据**。Play 上的包被 Play App Signing 重签过，
 *    和我们自己 upload key 签的站外包**签名不同**，装不上去（INSTALL_FAILED_UPDATE_INCOMPATIBLE），
 *    用户必须先卸载 —— 登录状态和设置都会清掉。这是 Android 的签名机制，绕不过去。
 *    所以弹窗文案里如实写明「需要先卸载、会退出登录」，不要美化。
 *
 * migrate.json 形如：{"enabled": true, "url": "https://…/download.html", "note": "…"}
 */
object MigrateGate {

    private const val CONFIG_URL = "https://askbible-media.joshlabs.app/migrate.json"
    private const val PREFS = "app_migrate"
    private const val KEY_DISMISSED = "dismissed"

    data class Config(val url: String, val note: String)

    private suspend fun fetch(context: Context): Config? = withContext(Dispatchers.IO) {
        // 站外版自己就是目的地，不提示；只有商店版才走这里
        if (BuildConfig.SELF_UPDATE) return@withContext null
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (prefs.getBoolean(KEY_DISMISSED, false)) return@withContext null
        try {
            val conn = (URL(CONFIG_URL).openConnection() as HttpURLConnection).apply {
                connectTimeout = 8000
                readTimeout = 8000
                setRequestProperty("Cache-Control", "no-cache")
            }
            try {
                if (conn.responseCode != 200) return@withContext null
                val o = JSONObject(conn.inputStream.bufferedReader().readText())
                if (!o.optBoolean("enabled", false)) return@withContext null
                val url = o.optString("url")
                if (url.isBlank()) null else Config(url, o.optString("note"))
            } finally {
                conn.disconnect()
            }
        } catch (_: Exception) {
            null
        }
    }

    @Composable
    fun Host(theme: Parchment = Parchment.light) {
        val context = LocalContext.current
        var cfg by remember { mutableStateOf<Config?>(null) }
        LaunchedEffect(Unit) { cfg = fetch(context) }

        val c = cfg ?: return
        AlertDialog(
            onDismissRequest = { cfg = null },
            containerColor = theme.surfaceSolid.toColor(),
            titleContentColor = theme.ink.toColor(),
            textContentColor = theme.inkSoft.toColor(),
            title = { Text("换到可直接更新的版本") },
            text = {
                Text(
                    if (c.note.isNotBlank()) c.note
                    else "我们自己的版本以后会在 App 里提示更新，点一下就装好。\n\n" +
                        "注意：两个版本签名不同，需要先卸载当前这个再装，" +
                        "本地的登录状态和设置会清掉，装好后重新登录一次即可。"
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    context.startActivity(
                        Intent(Intent.ACTION_VIEW, Uri.parse(c.url))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    )
                    cfg = null
                }) { Text("去下载页", color = theme.accentOt.toColor()) }
            },
            dismissButton = {
                TextButton(onClick = {
                    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit().putBoolean(KEY_DISMISSED, true).apply()
                    cfg = null
                }) { Text("不用了", color = theme.muted.toColor()) }
            },
        )
    }
}
