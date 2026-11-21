package me.askbible.native_.data

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import kotlin.concurrent.thread

/**
 * 本地离线包托管与 SHA-256 静默原子热更新（DECISIONS D-44 / D-46，与 iOS `PackStore.swift` 对称）。
 *
 * 原则：
 * 1. 核心译本与内置 UI 胶囊（`web-pack.json`）内置在 APK `assets/`，飞行模式 0ms 秒开；
 * 2. 联网后台拉取 `v2/catalog.json`，仅在本地已存在包与线上 `sha256` 不一致时下载至临时 `.part` 文件；
 * 3. SQLite 包校验 100 字节页头 + 长度 + SHA-256；UI 胶囊校验长度 + SHA-256 + JSON 结构（含 `index.html` 与 `app.js`）+ 看门狗黑名单；
 * 4. 任何网络异常、残损文件或黑名单包绝不污染本地可用资产。
 */
object PackStore {
    private const val PREFS = "packstore"
    private const val KEY_LAST_CHECK = "last_check_ms"
    private const val KEY_SHA_PREFIX = "sha256."
    const val WEB_PACK_ID = "ui.web-pack"
    const val KEY_BAD_WEBPACK_SHA256 = "askbible.packstore.bad-webpack-sha256"
    private const val CHECK_INTERVAL_MS = 6L * 3600L * 1000L

    private val webPackLock = Any()
    @Volatile
    private var cachedWebPack: WebPackSnapshot? = null

    data class RefreshOutcome(
        val catalogReachable: Boolean,
        val updatedCount: Int,
    )

    data class WebPackSnapshot(
        val version: String,
        val isHotPack: Boolean,
        val sha256: String,
        val files: Map<String, ByteArray>,
    )

    fun hotWebPackFile(context: Context): File =
        File(File(context.filesDir, "web-pack"), "web-pack.json")

    private fun sha256Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return digest.joinToString("") { "%02x".format(it) }
    }

    fun isBadWebPackSha256(context: Context, sha256: String): Boolean {
        val norm = sha256.trim().lowercase()
        if (norm.isEmpty()) return false
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = sp.getString(KEY_BAD_WEBPACK_SHA256, "") ?: ""
        return raw.split(',').any { it.trim().lowercase() == norm }
    }

    fun markBadWebPackSha256(context: Context, sha256: String) {
        val norm = sha256.trim().lowercase()
        if (norm.isEmpty()) return
        val sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val list = (sp.getString(KEY_BAD_WEBPACK_SHA256, "") ?: "")
            .split(',')
            .map { it.trim().lowercase() }
            .filter { it.isNotEmpty() && it != norm }
            .toMutableList()
        list.add(norm)
        val trimmed = if (list.size > 20) list.takeLast(20) else list
        sp.edit().putString(KEY_BAD_WEBPACK_SHA256, trimmed.joinToString(",")).apply()
    }

    private fun parseWebPackSnapshot(bytes: ByteArray, isHotPack: Boolean, sha256: String): WebPackSnapshot? {
        return runCatching {
            val root = JSONObject(String(bytes, Charsets.UTF_8))
            val filesObj = root.optJSONObject("files") ?: return null
            val html = filesObj.optString("index.html", "")
            val js = filesObj.optString("app.js", "")
            if (html.isEmpty() || js.isEmpty()) return null
            val map = HashMap<String, ByteArray>(filesObj.length())
            val keys = filesObj.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                map[key] = filesObj.optString(key, "").toByteArray(Charsets.UTF_8)
            }
            val ver = root.optString("version", "").ifBlank { sha256.take(12) }
            WebPackSnapshot(version = ver, isHotPack = isHotPack, sha256 = sha256, files = map)
        }.getOrNull()
    }

    /**
     * 读取离线 UI 胶囊：优先热更槽 `filesDir/web-pack/web-pack.json`，若损坏或命中看门狗黑名单则清除并回退 `assets/web-pack.json`。
     * 内存缓存保证 0ms 零拷贝直出。
     */
    fun loadWebPackFiles(context: Context): WebPackSnapshot? {
        cachedWebPack?.let { return it }
        synchronized(webPackLock) {
            cachedWebPack?.let { return it }
            val appCtx = context.applicationContext
            val hotFile = hotWebPackFile(appCtx)
            if (hotFile.exists()) {
                val bytes = runCatching { hotFile.readBytes() }.getOrNull()
                if (bytes != null) {
                    val sha = sha256Hex(bytes)
                    if (!isBadWebPackSha256(appCtx, sha)) {
                        val snap = parseWebPackSnapshot(bytes, isHotPack = true, sha256 = sha)
                        if (snap != null) {
                            cachedWebPack = snap
                            return snap
                        }
                    }
                }
                hotFile.delete()
            }

            val builtinBytes = runCatching { appCtx.assets.open("web-pack.json").use { it.readBytes() } }.getOrNull()
            if (builtinBytes != null) {
                val sha = sha256Hex(builtinBytes)
                val snap = parseWebPackSnapshot(builtinBytes, isHotPack = false, sha256 = sha)
                if (snap != null) {
                    cachedWebPack = snap
                    return snap
                }
            }
            return null
        }
    }

    /**
     * 看门狗超时回滚：将当前热更胶囊 SHA-256 写入故障黑名单，删除本地热更包并清内存缓存，瞬间退回内置包。
     */
    fun rollbackHotWebPack(context: Context) {
        synchronized(webPackLock) {
            val appCtx = context.applicationContext
            val hotFile = hotWebPackFile(appCtx)
            val badSha = cachedWebPack?.takeIf { it.isHotPack }?.sha256
                ?: if (hotFile.exists()) SQLiteDownload.sha256Hex(hotFile) else null
            if (!badSha.isNullOrBlank()) {
                markBadWebPackSha256(appCtx, badSha)
            }
            hotFile.delete()
            appCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_SHA_PREFIX + WEB_PACK_ID)
                .apply()
            cachedWebPack = null
        }
    }

    private fun installWebPackAtomically(
        context: Context,
        url: String,
        expectedSha256: String,
        expectedSizeBytes: Long,
    ) {
        val dest = hotWebPackFile(context)
        val parent = dest.absoluteFile.parentFile ?: throw IOException("Missing web-pack directory")
        if (!parent.isDirectory && !parent.mkdirs()) throw IOException("Cannot create web-pack directory")
        val temporary = File.createTempFile(dest.name + ".", ".part", parent)
        var connection: HttpURLConnection? = null
        try {
            val conn = URL(url).openConnection() as HttpURLConnection
            connection = conn
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            if (conn.responseCode != HttpURLConnection.HTTP_OK) throw IOException("HTTP ${conn.responseCode}")
            val bytes = conn.inputStream.use { it.readBytes() }
            if (expectedSizeBytes > 0L && bytes.size.toLong() != expectedSizeBytes) {
                throw IOException("WebPack size mismatch: ${bytes.size}/$expectedSizeBytes")
            }
            val actualSha = sha256Hex(bytes)
            if (actualSha != expectedSha256.trim().lowercase()) {
                throw IOException("WebPack SHA-256 mismatch")
            }
            if (isBadWebPackSha256(context, actualSha)) {
                throw IOException("WebPack blacklisted")
            }
            if (parseWebPackSnapshot(bytes, isHotPack = true, sha256 = actualSha) == null) {
                throw IOException("Invalid web-pack capsule")
            }
            temporary.writeBytes(bytes)
            Files.move(
                temporary.toPath(),
                dest.toPath(),
                StandardCopyOption.ATOMIC_MOVE,
                StandardCopyOption.REPLACE_EXISTING,
            )
            synchronized(webPackLock) { cachedWebPack = null }
        } finally {
            connection?.disconnect()
            temporary.delete()
        }
    }

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
            if (pack.id == WEB_PACK_ID || pack.kind == "web-pack") {
                val targetSha = pack.sha256.trim().lowercase()
                if (targetSha.isEmpty() || isBadWebPackSha256(context, targetSha)) continue
                val localSha = loadWebPackFiles(context)?.sha256
                if (localSha == targetSha) continue

                val urls = PackCatalogRules.candidateDownloadUrls(
                    path = pack.path,
                    mediaBase = Endpoints.mediaBase,
                    siteBase = Endpoints.siteBase,
                )
                for (url in urls) {
                    val installed = runCatching {
                        installWebPackAtomically(
                            context = context,
                            url = url,
                            expectedSha256 = targetSha,
                            expectedSizeBytes = pack.sizeBytes,
                        )
                        sp.edit().putString(KEY_SHA_PREFIX + WEB_PACK_ID, targetSha).apply()
                        true
                    }.getOrDefault(false)
                    if (installed) {
                        updatedCount += 1
                        break
                    }
                }
                continue
            }

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
