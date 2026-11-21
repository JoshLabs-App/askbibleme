package me.askbible.native_.data

import android.content.Context
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * 本地离线包托管与 SHA-256 静默原子热更新（DECISIONS D-44 / D-46，与 iOS `PackStore.swift` 对称）。
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

    data class RefreshOutcome(
        val catalogReachable: Boolean,
        val updatedCount: Int,
    )

    private fun fetchCatalog(): List<PackCatalogRules.PackDescriptor>? {
        val candidates = listOf(
            Endpoints.siteBase + "/v2/catalog.json",
            Endpoints.mediaBase + "/v2/catalog.json",
        ).distinct()
        for (raw in candidates) {
            val list = runCatching {
                val conn = (URL(raw).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 12_000
                    readTimeout = 12_000
                    useCaches = false
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("Cache-Control", "no-cache")
                }
                val body = try {
                    if (conn.responseCode != 200) return@runCatching null
                    conn.inputStream.bufferedReader().use { it.readText() }
                } finally {
                    conn.disconnect()
                }
                PackCatalogRules.parseCatalogJson(body)
            }.getOrNull()
            if (list != null) return list
        }
        return null
    }

    private fun activeLocalFile(context: Context, localKey: String): File? {
        if (localKey == "info-edition") {
            val f = File(context.filesDir, "info-edition.sqlite")
            return if (f.exists() && SQLiteDownload.isComplete(f)) f else null
        }
        val downloaded = TranslationDownloader.localFile(context, localKey)
        if (downloaded.exists() && SQLiteDownload.isComplete(downloaded)) return downloaded
        return ScriptureDatabase.ensureOnDisk(context, "$localKey.sqlite")
    }

    fun refreshInstalledPacksInBackground(context: Context, force: Boolean = false) {
        val appContext = context.applicationContext
        thread(name = "packstore-refresh", isDaemon = true) {
            runCatching { refreshInstalledPacksSync(appContext, force) }
        }
    }

    fun refreshInstalledPacksSync(context: Context, force: Boolean = false): RefreshOutcome {
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (!force && now - sp.getLong(KEY_LAST_CHECK, 0L) < CHECK_INTERVAL_MS) {
            return RefreshOutcome(catalogReachable = true, updatedCount = 0)
        }
        val packs = fetchCatalog() ?: return RefreshOutcome(catalogReachable = false, updatedCount = 0)
        sp.edit().putLong(KEY_LAST_CHECK, now).apply()

        var updatedCount = 0
        for (pack in packs) {
            if (!pack.path.endsWith(".sqlite")) continue
            val localKey = PackCatalogRules.localPackKey(pack)
            val currentFile = activeLocalFile(context, localKey) ?: continue
            val shaKey = KEY_SHA_PREFIX + localKey
            val cachedSha = if (force) null else sp.getString(shaKey, null)
            val localSha = cachedSha ?: SQLiteDownload.sha256Hex(currentFile)
            if (localSha != null && cachedSha == null) {
                sp.edit().putString(shaKey, localSha).apply()
            }
            if (localSha == null || localSha == pack.sha256) continue

            val dest = if (localKey == "info-edition") {
                File(context.filesDir, "info-edition.sqlite")
            } else {
                TranslationDownloader.localFile(context, localKey)
            }
            val urls = PackCatalogRules.candidateDownloadUrls(
                path = pack.path,
                mediaBase = Endpoints.mediaBase,
                siteBase = Endpoints.siteBase,
            )
            for (url in urls) {
                val installed = runCatching {
                    SQLiteDownload.install(
                        url = url,
                        destination = dest,
                        expectedSha256 = pack.sha256,
                        expectedSizeBytes = pack.sizeBytes.takeIf { it > 0L },
                    )
                    sp.edit().putString(shaKey, pack.sha256).apply()
                    true
                }.getOrDefault(false)
                if (installed) {
                    updatedCount += 1
                    break
                }
            }
        }
        return RefreshOutcome(catalogReachable = true, updatedCount = updatedCount)
    }
}
