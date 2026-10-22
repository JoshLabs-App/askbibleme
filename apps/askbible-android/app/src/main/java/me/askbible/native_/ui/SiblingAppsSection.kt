package me.askbible.native_.ui

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.Parchment
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 「更多 App」：同系列的圣经软件（DECISIONS D-42），列在探索页收藏下面，和 iOS `SiblingAppsSection` 一致。
 * 清单是几个 App 共用的一份 JSON：线上 askbible-media/sibling-apps/apps.json（真源 data/sibling-apps/apps.json），
 * App 内 assets 带一份兜底。先用上次拉到的，没有用兜底；改清单不用发版。显示时去掉自己（askbible）。
 */
data class SiblingApp(
    val id: String,
    val icon: String?,
    val name: Map<String, String>,
    val tagline: Map<String, String>,
    val googlePlay: String?,
    val android: String?,
    val web: String?,
) {
    /** 安卓上点这一行去哪：上了 Play 去 Play；没上的去网页版 / 官网，不直接给 APK 下载页（Play 政策） */
    val androidTarget: String? get() = googlePlay ?: web ?: android
}

class SiblingAppsCatalog(val page: Map<String, Map<String, String>>, val apps: List<SiblingApp>) {
    fun text(key: String, locale: AppLocale) = pick(page[key], locale)

    companion object {
        const val SELF_ID = "askbible"
        private const val REMOTE = "https://askbible-media.joshlabs.app/sibling-apps/apps.json"

        fun pick(m: Map<String, String>?, locale: AppLocale): String =
            m?.get(locale.tag) ?: m?.get("zh-CN") ?: m?.get("en") ?: m?.values?.firstOrNull() ?: ""

        private fun cacheFile(ctx: Context) = File(ctx.cacheDir, "sibling-apps.json")

        fun parse(text: String): SiblingAppsCatalog? = runCatching {
            val o = JSONObject(text)
            fun map(j: JSONObject?): Map<String, String> =
                j?.keys()?.asSequence()?.associateWith { j.getString(it) } ?: emptyMap()
            val page = o.optJSONObject("page")
            val pageMap = page?.keys()?.asSequence()?.associateWith { map(page.optJSONObject(it)) } ?: emptyMap()
            val arr = o.getJSONArray("apps")
            val apps = (0 until arr.length()).map { i ->
                val a = arr.getJSONObject(i)
                fun s(k: String) = a.optString(k).takeIf { it.isNotBlank() }
                SiblingApp(a.getString("id"), s("icon"), map(a.optJSONObject("name")), map(a.optJSONObject("tagline")),
                           s("googlePlay"), s("android"), s("web"))
            }
            SiblingAppsCatalog(pageMap, apps)
        }.getOrNull()

        fun local(ctx: Context): SiblingAppsCatalog? {
            cacheFile(ctx).takeIf { it.exists() }?.readText()?.let { parse(it) }?.let { return it }
            return runCatching { ctx.assets.open("sibling-apps.json").bufferedReader().use { it.readText() } }
                .getOrNull()?.let { parse(it) }
        }

        suspend fun fetchRemote(ctx: Context): SiblingAppsCatalog? = withContext(Dispatchers.IO) {
            runCatching {
                val c = URL(REMOTE).openConnection() as HttpURLConnection
                c.connectTimeout = 8000; c.readTimeout = 8000; c.useCaches = false
                try {
                    if (c.responseCode != 200) return@runCatching null
                    val text = c.inputStream.bufferedReader().use { it.readText() }
                    parse(text)?.also { cacheFile(ctx).writeText(text) }
                } finally { c.disconnect() }
            }.getOrNull()
        }
    }
}

@Composable
fun SiblingAppsSection(locale: AppLocale, theme: Parchment) {
    val ctx = LocalContext.current
    var catalog by remember { mutableStateOf(SiblingAppsCatalog.local(ctx)) }
    LaunchedEffect(Unit) { SiblingAppsCatalog.fetchRemote(ctx)?.let { catalog = it } }
    val c = catalog ?: return
    val apps = c.apps.filter { it.id != SiblingAppsCatalog.SELF_ID && it.androidTarget != null }
    if (apps.isEmpty()) return

    Column(Modifier.fillMaxWidth().padding(horizontal = 26.dp)) {
        Spacer(Modifier.height(28.dp))
        Text(c.text("title", locale), color = theme.faint.toColor(), fontSize = 15.sp)
        Spacer(Modifier.height(6.dp))
        for (app in apps) {
            Row(Modifier.fillMaxWidth()
                    .clickableNoRipple { app.androidTarget?.let { openLink(ctx, it) } }
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically) {
                SiblingIcon(app, theme)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(SiblingAppsCatalog.pick(app.name, locale), color = theme.ink.toColor(),
                         fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    Text(SiblingAppsCatalog.pick(app.tagline, locale), color = theme.muted.toColor(),
                         fontSize = 13.sp, lineHeight = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Spacer(Modifier.width(8.dp))
                Text("›", color = theme.faint.toColor().copy(alpha = 0.58f), fontSize = 24.sp, lineHeight = 24.sp)
            }
        }
    }
}

@Composable
private fun SiblingIcon(app: SiblingApp, theme: Parchment) {
    val ctx = LocalContext.current
    val shape = RoundedCornerShape(10.dp)
    // 先用 assets 里带的图标；新加的 App 没带图标就按清单里的地址下载
    val bmp by produceState<Bitmap?>(null, app.id) {
        value = withContext(Dispatchers.IO) {
            runCatching { ctx.assets.open("sibling-apps/${app.id}.png").use { BitmapFactory.decodeStream(it) } }.getOrNull()
                ?: app.icon?.let { u -> runCatching { URL(u).openStream().use { BitmapFactory.decodeStream(it) } }.getOrNull() }
        }
    }
    Box(Modifier.size(44.dp).clip(shape).background(theme.border.toColor().copy(alpha = 0.3f))
            .border(0.5.dp, theme.border.toColor(), shape)) {
        bmp?.let { Image(it.asImageBitmap(), null, Modifier.size(44.dp), contentScale = ContentScale.Crop) }
    }
}

private fun openLink(ctx: Context, url: String) {
    runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}
