package me.askbible.native_.data

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * 本地离线包托管与 SHA-256 静默原子热更新（DECISIONS D-44，与 iOS `PackStore.swift` 对称）。
 *
 * 原则：
 * 1. 核心译本内置在 APK `assets/`，飞行模式 0ms 秒开；
 * 2. 联网后台拉取 `v2/catalog.json`，仅在本地已存在包与线上 `sha256` 不一致时下载至临时 `.part` 文件；
 * 3. 由 [SQLiteDownload.install] 严格校验 SQLite 100 字节页头完整性 + 文件长度 + SHA-256，通过后 `ATOMIC_MOVE` 覆盖；
 * 4. 任何网络异常或残损文件绝不污染本地可用圣经库。
 */
object PackStore {
    private const val PREFS = "packstore"
    private const val KEY_LAST_CHECK = "last_check_ms"
    private const val KEY_SHA_PREFIX = "sha256."
    private const val CHECK_INTERVAL_MS = 6L * 3600L * 1000L

    data class PackDescriptor(
        val id: String,
        val kind: String,
        val path: String,
        val sha256: String,
        val sizeBytes: Long,
    )

    private fun fetchCatalog(): List<PackDescriptor>? {
        val candidates = listOf(
            Endpoints.siteBase + "/v2/catalog.json",
            Endpoints.mediaBase + "/v2/catalog.json",
        )
        for (raw in candidates) {
            val list = runCatching {
                val conn = (URL(raw).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 12_000
                    readTimeout = 12_000
                    useCaches = false
                    setRequestProperty("Accept", "application/json")
                }
                val body = try {
                    if (conn.responseCode != 200) return@runCatching null
                    conn.inputStream.bufferedReader().use { it.readText() }
                } finally { conn.disconnect() }
                val arr = JSONObject(body).optJSONArray("packs") ?: return@runCatching null
                (0 until arr.length()).mapNotNull { idx ->
                    val o = arr.optJSONObject(idx) ?: return@mapNotNull null
                    val id = o.optString("id").trim()
                    val path = o.optString("path").trim()
                    val sha = o.optString("sha256").trim().lowercase()
                    if (id.isEmpty() || path.isEmpty() || sha.isEmpty()) null
                    else PackDescriptor(id, o.optString("kind"), path, sha, o.optLong("sizeBytes", 0L))
                }.takeIf { it.isNotEmpty() }
            }.getOrNull()
            if (list != null) return list
        }
        return null
    }

    private fun activeLocalFile(context: Context, packId: String): File? {
        if (packId == "info-edition") {
            val f = File(context.filesDir, "info-edition.sqlite")
            return if (f.exists() && SQLiteDownload.isComplete(f)) f else null
        }
        val downloaded = TranslationDownloader.localFile(context, packId)
        if (downloaded.exists() && SQLiteDownload.isComplete(downloaded)) return downloaded
        return ScriptureDatabase.ensureOnDisk(context, "$packId.sqlite")
    }

    fun refreshInstalledPacksInBackground(context: Context, force: Boolean = false) {
        val appContext = context.applicationContext
        thread(name = "packstore-refresh", isDaemon = true) {
            runCatching { refreshInstalledPacksSync(appContext, force) }
        }
    }

    fun refreshInstalledPacksSync(context: Context, force: Boolean = false) {
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (!force && now - sp.getLong(KEY_LAST_CHECK, 0L) < CHECK_INTERVAL_MS) return
        val packs = fetchCatalog() ?: return
        sp.edit().putLong(KEY_LAST_CHECK, now).apply()

        for (pack in packs) {
            if (!pack.path.endsWith(".sqlite")) continue
            val currentFile = activeLocalFile(context, pack.id) ?: continue
            val shaKey = KEY_SHA_PREFIX + pack.id
            val cachedSha = sp.getString(shaKey, null)
            val localSha = cachedSha ?: SQLiteDownload.sha256Hex(currentFile)
            if (localSha != null && cachedSha == null) {
                sp.edit().putString(shaKey, localSha).apply()
            }
            if (localSha == null || localSha == pack.sha256) continue

            val rel = if (pack.path.startsWith("/")) pack.path else "/${pack.path}"
            val url = Endpoints.siteBase + rel
            val dest = if (pack.id == "info-edition") {
                File(context.filesDir, "info-edition.sqlite")
            } else {
                TranslationDownloader.localFile(context, pack.id)
            }
            runCatching {
                SQLiteDownload.install(
                    url = url,
                    destination = dest,
                    expectedSha256 = pack.sha256,
                    expectedSizeBytes = pack.sizeBytes.takeIf { it > 0L },
                )
                sp.edit().putString(shaKey, pack.sha256).apply()
            }
        }
    }
}
