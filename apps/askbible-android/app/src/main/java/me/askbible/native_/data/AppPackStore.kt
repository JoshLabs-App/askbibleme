package me.askbible.native_.data

import android.content.Context
import android.os.Build
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.lang.ref.WeakReference
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * D-47 文件级 `pack-manifest.json` 增量热更引擎：
 * 1. 支持 `active.json`（`bundleId` / `installedOnBuiltinId` / `activatedAt`），重装新版原生包时自动淘汰旧沙盒包；
 * 2. 启动 / 回前台 / 每 30 分钟后台静默拉取 `pack-manifest.json`，比对本地已有文件 `size + sha256` 实现 0 流量复用；
 * 3. 仅下载变化文件进 `staging` 校验通过后暂存待切换，通过 `commitPendingSwap()` 原子切换，严禁弹任何更新提示弹窗。
 */
object AppPackStore {
    private const val PREFS = "app_pack_store"
    private const val KEY_LAST_CHECK_MS = "last_check_ms"
    private const val KEY_LAST_ERROR = "last_error"
    private const val KEY_BAD_BUNDLES = "bad_bundle_ids"
    const val CHECK_INTERVAL_MS = 30L * 60L * 1000L
    private const val BUILTIN_ASSET_DIR = "app-pack"

    private val lock = Any()
    @Volatile
    private var cachedSnapshot: AppPackSnapshot? = null
    @Volatile
    private var scheduler: ScheduledExecutorService? = null

    private val readyListeners = CopyOnWriteArrayList<WeakReference<(String) -> Unit>>()

    data class AppPackSnapshot(
        val manifest: AppPackManifestRules.PackManifest,
        val isHotPack: Boolean,
        val bundleDir: File?,
        val activeRecord: AppPackManifestRules.ActivePackRecord?,
    )

    data class OpenedPackFile(
        val stream: InputStream,
        val isHotPack: Boolean,
    )

    data class RefreshResult(
        val reachable: Boolean,
        val bundleId: String?,
        val downloadedFiles: Int,
        val reusedFiles: Int,
        val readyToSwap: Boolean,
    )

    fun rootDir(context: Context): File = File(context.applicationContext.filesDir, "app-pack")
    fun activeJsonFile(context: Context): File = File(rootDir(context), "active.json")
    fun bundlesDir(context: Context): File = File(rootDir(context), "bundles")
    fun stagingDir(context: Context): File = File(rootDir(context), "staging")
    fun pendingJsonFile(context: Context): File = File(stagingDir(context), "pending.json")

    fun addReadyToSwapListener(listener: (String) -> Unit) {
        readyListeners.removeAll { it.get() == null || it.get() === listener }
        readyListeners.add(WeakReference(listener))
    }

    private fun notifyReadyToSwap(bundleId: String) {
        for (ref in readyListeners) {
            val cb = ref.get()
            if (cb != null) {
                runCatching { cb(bundleId) }
            }
        }
    }

    /**
     * 生成当前原生壳构建标识：包含 `longVersionCode`、`lastUpdateTime` 与内置包 `bundleId`。
     * 只要重装新版原生 APK，该标识必然变化，从而自动淘汰旧沙盒包。
     */
    fun currentBuiltinId(context: Context): String {
        val appCtx = context.applicationContext
        val (versionCode, lastUpdate) = runCatching {
            val info = appCtx.packageManager.getPackageInfo(appCtx.packageName, 0)
            val code = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
            code to info.lastUpdateTime
        }.getOrDefault(0L to 0L)
        val builtinBundleId = loadBuiltinManifest(appCtx)?.bundleId ?: "none"
        return "$versionCode:$lastUpdate:$builtinBundleId"
    }

    /**
     * 检查 `active.json` 的 `installedOnBuiltinId` 是否与当前原生壳匹配；不匹配则淘汰整个沙盒 `app-pack` 目录。
     */
    fun ensureBuiltinFreshness(context: Context): Boolean {
        val appCtx = context.applicationContext
        synchronized(lock) {
            val activeFile = activeJsonFile(appCtx)
            if (!activeFile.exists()) return false
            val active = runCatching {
                AppPackManifestRules.parseActiveJson(activeFile.readText(Charsets.UTF_8))
            }.getOrNull()
            val currentBuiltin = currentBuiltinId(appCtx)
            if (active == null || AppPackManifestRules.shouldPurgeSandboxForNewBuiltin(active, currentBuiltin)) {
                deleteRecursively(rootDir(appCtx))
                cachedSnapshot = null
                return true
            }
            return false
        }
    }

    fun isBadBundleId(context: Context, bundleId: String): Boolean {
        val norm = bundleId.trim()
        if (norm.isEmpty()) return false
        val raw = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_BAD_BUNDLES, "") ?: ""
        return raw.split(',').any { it.trim() == norm }
    }

    fun markBadBundleId(context: Context, bundleId: String) {
        val norm = bundleId.trim()
        if (norm.isEmpty()) return
        val sp = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val list = (sp.getString(KEY_BAD_BUNDLES, "") ?: "")
            .split(',')
            .map { it.trim() }
            .filter { it.isNotEmpty() && it != norm }
            .toMutableList()
        list.add(norm)
        val trimmed = if (list.size > 20) list.takeLast(20) else list
        sp.edit().putString(KEY_BAD_BUNDLES, trimmed.joinToString(",")).apply()
    }

    private fun loadBuiltinManifest(context: Context): AppPackManifestRules.PackManifest? {
        val body = runCatching {
            context.assets.open("$BUILTIN_ASSET_DIR/pack-manifest.json").bufferedReader().use { it.readText() }
        }.getOrNull() ?: return null
        return AppPackManifestRules.parseManifestJson(body)
    }

    fun activeSnapshot(context: Context): AppPackSnapshot? {
        val appCtx = context.applicationContext
        ensureBuiltinFreshness(appCtx)
        cachedSnapshot?.let { return it }
        synchronized(lock) {
            cachedSnapshot?.let { return it }
            val activeFile = activeJsonFile(appCtx)
            if (activeFile.exists()) {
                val active = runCatching {
                    AppPackManifestRules.parseActiveJson(activeFile.readText(Charsets.UTF_8))
                }.getOrNull()
                if (active != null && !isBadBundleId(appCtx, active.bundleId)) {
                    val bundleDir = File(bundlesDir(appCtx), active.bundleId)
                    val manifestFile = File(bundleDir, "pack-manifest.json")
                    val manifest = runCatching {
                        AppPackManifestRules.parseManifestJson(manifestFile.readText(Charsets.UTF_8))
                    }.getOrNull()
                    if (manifest != null && manifest.bundleId == active.bundleId &&
                        File(bundleDir, manifest.entry).isFile
                    ) {
                        val snap = AppPackSnapshot(
                            manifest = manifest,
                            isHotPack = true,
                            bundleDir = bundleDir,
                            activeRecord = active,
                        )
                        cachedSnapshot = snap
                        return snap
                    }
                }
                // 活跃热更槽受损或被拉黑：清理并回退内置包
                deleteRecursively(activeFile)
            }

            val builtin = loadBuiltinManifest(appCtx)
            if (builtin != null) {
                val snap = AppPackSnapshot(
                    manifest = builtin,
                    isHotPack = false,
                    bundleDir = null,
                    activeRecord = null,
                )
                cachedSnapshot = snap
                return snap
            }
            return null
        }
    }

    fun openFile(context: Context, relativePath: String): OpenedPackFile? {
        val clean = AppPackManifestRules.normalizeRelativePath(relativePath) ?: return null
        val appCtx = context.applicationContext
        val snap = activeSnapshot(appCtx)
        if (snap != null && snap.isHotPack && snap.bundleDir != null) {
            val file = File(snap.bundleDir, clean)
            if (file.isFile) {
                return OpenedPackFile(file.inputStream(), isHotPack = true)
            }
        }
        return runCatching {
            OpenedPackFile(appCtx.assets.open("$BUILTIN_ASSET_DIR/$clean"), isHotPack = false)
        }.getOrNull()
    }

    fun pendingBundleId(context: Context): String? {
        val file = pendingJsonFile(context.applicationContext)
        if (!file.isFile) return null
        val pending = runCatching {
            AppPackManifestRules.parsePendingJson(file.readText(Charsets.UTF_8))
        }.getOrNull() ?: return null
        val stagedDir = File(stagingDir(context.applicationContext), pending.bundleId)
        val manifestFile = File(stagedDir, "pack-manifest.json")
        return if (manifestFile.isFile) pending.bundleId else null
    }

    fun startPeriodicPolling(context: Context) {
        val appCtx = context.applicationContext
        synchronized(lock) {
            if (scheduler != null) return
            val exec = Executors.newSingleThreadScheduledExecutor { r ->
                Thread(r, "app-pack-poller").apply { isDaemon = true }
            }
            exec.scheduleWithFixedDelay(
                { runCatching { refreshSync(appCtx, force = false) } },
                CHECK_INTERVAL_MS,
                CHECK_INTERVAL_MS,
                TimeUnit.MILLISECONDS,
            )
            scheduler = exec
        }
    }

    fun stopPeriodicPolling() {
        synchronized(lock) {
            scheduler?.shutdownNow()
            scheduler = null
        }
    }

    fun refreshInBackground(context: Context, force: Boolean = false) {
        val appCtx = context.applicationContext
        thread(name = "app-pack-refresh", isDaemon = true) {
            runCatching { refreshSync(appCtx, force) }
        }
    }

    /**
     * 后台静默拉取 `pack-manifest.json`，仅下载变更文件进 `staging` 并做 `size + sha256` 校验。
     * 校验全部通过后写 `staging/pending.json` 并回调 `pack.readyToSwap`，绝不弹任何更新提示。
     */
    fun refreshSync(context: Context, force: Boolean = false): RefreshResult {
        val appCtx = context.applicationContext
        ensureBuiltinFreshness(appCtx)

        val sp = appCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        if (!force && now - sp.getLong(KEY_LAST_CHECK_MS, 0L) < CHECK_INTERVAL_MS) {
            val pending = pendingBundleId(appCtx)
            return RefreshResult(
                reachable = true,
                bundleId = activeSnapshot(appCtx)?.manifest?.bundleId,
                downloadedFiles = 0,
                reusedFiles = 0,
                readyToSwap = pending != null,
            )
        }

        val manifest = fetchManifest() ?: run {
            sp.edit().putString(KEY_LAST_ERROR, "manifest_unreachable").apply()
            return RefreshResult(
                reachable = false,
                bundleId = null,
                downloadedFiles = 0,
                reusedFiles = 0,
                readyToSwap = pendingBundleId(appCtx) != null,
            )
        }
        sp.edit().putLong(KEY_LAST_CHECK_MS, now).remove(KEY_LAST_ERROR).apply()

        if (isBadBundleId(appCtx, manifest.bundleId)) {
            return RefreshResult(
                reachable = true,
                bundleId = manifest.bundleId,
                downloadedFiles = 0,
                reusedFiles = 0,
                readyToSwap = false,
            )
        }

        val currentSnap = activeSnapshot(appCtx)
        if (currentSnap?.manifest?.bundleId == manifest.bundleId) {
            return RefreshResult(
                reachable = true,
                bundleId = manifest.bundleId,
                downloadedFiles = 0,
                reusedFiles = manifest.files.size,
                readyToSwap = false,
            )
        }

        if (pendingBundleId(appCtx) == manifest.bundleId) {
            notifyReadyToSwap(manifest.bundleId)
            return RefreshResult(
                reachable = true,
                bundleId = manifest.bundleId,
                downloadedFiles = 0,
                reusedFiles = manifest.files.size,
                readyToSwap = true,
            )
        }

        val stagedBundleDir = File(stagingDir(appCtx), manifest.bundleId)
        if (!stagedBundleDir.isDirectory && !stagedBundleDir.mkdirs()) {
            return RefreshResult(reachable = true, bundleId = manifest.bundleId, downloadedFiles = 0, reusedFiles = 0, readyToSwap = false)
        }

        var reusedCount = 0
        var downloadedCount = 0
        val activeDir = currentSnap?.bundleDir

        val plan = AppPackManifestRules.planIncrementalFiles(manifest) { relPath, entry ->
            val stagedFile = File(stagedBundleDir, relPath)
            verifyFile(stagedFile, entry)
        }

        reusedCount += plan.reusablePaths.size

        for (relPath in plan.downloadPaths) {
            val entry = manifest.files[relPath] ?: continue
            val destFile = File(stagedBundleDir, relPath)
            destFile.parentFile?.mkdirs()

            // 1. 先尝试从当前活跃沙盒包 0 流量复用（size + sha256 命中即本地拷贝）
            val activeCandidate = activeDir?.let { File(it, relPath) }
            if (activeCandidate != null && verifyFile(activeCandidate, entry)) {
                val copied = runCatching {
                    copyAtomically(activeCandidate, destFile)
                    verifyFile(destFile, entry)
                }.getOrDefault(false)
                if (copied) {
                    reusedCount += 1
                    continue
                }
            }

            // 2. 再尝试从内置 APK assets/app-pack 0 流量复用
            val builtinBytes = runCatching {
                appCtx.assets.open("$BUILTIN_ASSET_DIR/$relPath").use { it.readBytes() }
            }.getOrNull()
            if (builtinBytes != null &&
                builtinBytes.size.toLong() == entry.size &&
                sha256Hex(builtinBytes) == entry.sha256
            ) {
                val copied = runCatching {
                    writeBytesAtomically(builtinBytes, destFile)
                    true
                }.getOrDefault(false)
                if (copied) {
                    reusedCount += 1
                    continue
                }
            }

            // 3. 仅下载变化的单文件
            val urls = AppPackManifestRules.candidateAssetUrls(
                relativePath = relPath,
                mediaBase = Endpoints.mediaBase,
                siteBase = Endpoints.siteBase,
            )
            var fileReady = false
            for (url in urls) {
                val ok = runCatching {
                    downloadAndVerifyFile(url, destFile, entry)
                    true
                }.getOrDefault(false)
                if (ok) {
                    fileReady = true
                    downloadedCount += 1
                    break
                }
            }
            if (!fileReady) {
                sp.edit().putString(KEY_LAST_ERROR, "file_failed:$relPath").apply()
                return RefreshResult(
                    reachable = true,
                    bundleId = manifest.bundleId,
                    downloadedFiles = downloadedCount,
                    reusedFiles = reusedCount,
                    readyToSwap = false,
                )
            }
        }

        // 所有文件均已入 staging 并通过校验，落盘清单与待切换标志
        val stagedManifestFile = File(stagedBundleDir, "pack-manifest.json")
        val pendingFile = pendingJsonFile(appCtx)
        val ok = runCatching {
            writeBytesAtomically(
                AppPackManifestRules.serializeManifestJson(manifest).toByteArray(Charsets.UTF_8),
                stagedManifestFile,
            )
            writeBytesAtomically(
                AppPackManifestRules.serializePendingJson(
                    AppPackManifestRules.PendingPackRecord(
                        bundleId = manifest.bundleId,
                        stagedAt = MemberAuthRules.isoNow(),
                    ),
                ).toByteArray(Charsets.UTF_8),
                pendingFile,
            )
            true
        }.getOrDefault(false)

        if (ok) {
            notifyReadyToSwap(manifest.bundleId)
        }
        return RefreshResult(
            reachable = true,
            bundleId = manifest.bundleId,
            downloadedFiles = downloadedCount,
            reusedFiles = reusedCount,
            readyToSwap = ok,
        )
    }

    /**
     * 原子切换已暂存的 `staging` 包为活跃版本：写入 `active.json`（含 `bundleId` / `installedOnBuiltinId` / `activatedAt`），
     * 清理旧包与缓存。严禁弹任何更新提示。
     */
    fun commitPendingSwap(context: Context): String? {
        val appCtx = context.applicationContext
        synchronized(lock) {
            ensureBuiltinFreshness(appCtx)
            val pendingFile = pendingJsonFile(appCtx)
            if (!pendingFile.isFile) return null
            val pending = runCatching {
                AppPackManifestRules.parsePendingJson(pendingFile.readText(Charsets.UTF_8))
            }.getOrNull() ?: run {
                pendingFile.delete()
                return null
            }

            val stagedDir = File(stagingDir(appCtx), pending.bundleId)
            val stagedManifestFile = File(stagedDir, "pack-manifest.json")
            val manifest = runCatching {
                AppPackManifestRules.parseManifestJson(stagedManifestFile.readText(Charsets.UTF_8))
            }.getOrNull()
            if (manifest == null || manifest.bundleId != pending.bundleId) {
                deleteRecursively(stagedDir)
                pendingFile.delete()
                return null
            }

            for ((relPath, entry) in manifest.files) {
                val f = File(stagedDir, relPath)
                if (!f.isFile || f.length() != entry.size) {
                    return null
                }
            }

            val bundles = bundlesDir(appCtx)
            if (!bundles.isDirectory && !bundles.mkdirs()) return null
            val targetDir = File(bundles, manifest.bundleId)
            if (targetDir.exists()) deleteRecursively(targetDir)

            val moved = runCatching {
                Files.move(
                    stagedDir.toPath(),
                    targetDir.toPath(),
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING,
                )
                true
            }.getOrElse {
                runCatching {
                    stagedDir.renameTo(targetDir)
                }.getOrDefault(false)
            }
            if (!moved || !File(targetDir, manifest.entry).isFile) return null

            val activeRecord = AppPackManifestRules.ActivePackRecord(
                bundleId = manifest.bundleId,
                installedOnBuiltinId = currentBuiltinId(appCtx),
                activatedAt = MemberAuthRules.isoNow(),
            )
            writeBytesAtomically(
                AppPackManifestRules.serializeActiveJson(activeRecord).toByteArray(Charsets.UTF_8),
                activeJsonFile(appCtx),
            )
            pendingFile.delete()

            // 清理已淘汰的旧沙盒包与过期 staging 目录
            bundles.listFiles()?.forEach { child ->
                if (child.name != manifest.bundleId) deleteRecursively(child)
            }
            stagingDir(appCtx).listFiles()?.forEach { child ->
                if (child.name != "pending.json") deleteRecursively(child)
            }

            cachedSnapshot = AppPackSnapshot(
                manifest = manifest,
                isHotPack = true,
                bundleDir = targetDir,
                activeRecord = activeRecord,
            )
            return manifest.bundleId
        }
    }

    /** 看门狗回滚：将故障热更 `bundleId` 拉黑，删掉 `active.json` 与对应目录，回退到内置包 */
    fun rollbackHotAppPack(context: Context) {
        val appCtx = context.applicationContext
        synchronized(lock) {
            val activeSnap = cachedSnapshot?.takeIf { it.isHotPack }
            val activeFile = activeJsonFile(appCtx)
            val record = activeSnap?.activeRecord ?: runCatching {
                if (activeFile.isFile) AppPackManifestRules.parseActiveJson(activeFile.readText(Charsets.UTF_8)) else null
            }.getOrNull()
            record?.bundleId?.let { badId ->
                markBadBundleId(appCtx, badId)
                deleteRecursively(File(bundlesDir(appCtx), badId))
            }
            activeFile.delete()
            cachedSnapshot = null
        }
    }

    fun statusJson(context: Context): JSONObject {
        val appCtx = context.applicationContext
        val snap = activeSnapshot(appCtx)
        val pendingId = pendingBundleId(appCtx)
        val sp = appCtx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return JSONObject().apply {
            put("bundleId", snap?.manifest?.bundleId ?: JSONObject.NULL)
            put("activeBundleId", snap?.manifest?.bundleId ?: JSONObject.NULL)
            put("builtinId", currentBuiltinId(appCtx))
            put("installedOnBuiltinId", snap?.activeRecord?.installedOnBuiltinId ?: JSONObject.NULL)
            put("activatedAt", snap?.activeRecord?.activatedAt ?: JSONObject.NULL)
            put("pendingBundleId", pendingId ?: JSONObject.NULL)
            put("hasPendingSwap", pendingId != null)
            put("isHotPack", snap?.isHotPack == true)
            put("lastCheckedAt", sp.getLong(KEY_LAST_CHECK_MS, 0L))
            put("lastError", sp.getString(KEY_LAST_ERROR, null) ?: JSONObject.NULL)
        }
    }

    private fun fetchManifest(): AppPackManifestRules.PackManifest? {
        val candidates = AppPackManifestRules.candidateManifestUrls(
            mediaBase = Endpoints.mediaBase,
            siteBase = Endpoints.siteBase,
        )
        for (raw in candidates) {
            val parsed = runCatching {
                val conn = (URL(raw).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 12_000
                    readTimeout = 12_000
                    useCaches = false
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("Cache-Control", "no-store, no-cache")
                }
                val body = try {
                    if (conn.responseCode != HttpURLConnection.HTTP_OK) return@runCatching null
                    conn.inputStream.bufferedReader().use { it.readText() }
                } finally {
                    conn.disconnect()
                }
                AppPackManifestRules.parseManifestJson(body)
            }.getOrNull()
            if (parsed != null) return parsed
        }
        return null
    }

    private fun downloadAndVerifyFile(
        url: String,
        destination: File,
        expected: AppPackManifestRules.ManifestFileEntry,
    ) {
        val parent = destination.absoluteFile.parentFile ?: throw IOException("Missing staging parent")
        if (!parent.isDirectory && !parent.mkdirs()) throw IOException("Cannot create staging dir")
        val tmp = File.createTempFile("part-", ".tmp", parent)
        var conn: HttpURLConnection? = null
        try {
            val c = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15_000
                readTimeout = 30_000
                useCaches = false
                setRequestProperty("Cache-Control", "no-cache")
            }
            conn = c
            if (c.responseCode != HttpURLConnection.HTTP_OK) throw IOException("HTTP ${c.responseCode}")
            val bytes = c.inputStream.use { it.readBytes() }
            if (bytes.size.toLong() != expected.size) {
                throw IOException("Size mismatch: ${bytes.size}/${expected.size}")
            }
            val actualSha = sha256Hex(bytes)
            if (actualSha != expected.sha256) {
                throw IOException("SHA-256 mismatch")
            }
            tmp.writeBytes(bytes)
            Files.move(
                tmp.toPath(),
                destination.toPath(),
                StandardCopyOption.ATOMIC_MOVE,
                StandardCopyOption.REPLACE_EXISTING,
            )
        } finally {
            conn?.disconnect()
            tmp.delete()
        }
    }

    private fun copyAtomically(src: File, dst: File) {
        val parent = dst.absoluteFile.parentFile ?: throw IOException("Missing parent")
        if (!parent.isDirectory && !parent.mkdirs()) throw IOException("Cannot create parent")
        val tmp = File.createTempFile("copy-", ".tmp", parent)
        try {
            src.inputStream().use { input -> tmp.outputStream().use { output -> input.copyTo(output, 1 shl 16) } }
            Files.move(tmp.toPath(), dst.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally {
            tmp.delete()
        }
    }

    private fun writeBytesAtomically(bytes: ByteArray, dst: File) {
        val parent = dst.absoluteFile.parentFile ?: throw IOException("Missing parent")
        if (!parent.isDirectory && !parent.mkdirs()) throw IOException("Cannot create parent")
        val tmp = File.createTempFile("write-", ".tmp", parent)
        try {
            tmp.writeBytes(bytes)
            Files.move(tmp.toPath(), dst.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally {
            tmp.delete()
        }
    }

    private fun verifyFile(file: File, expected: AppPackManifestRules.ManifestFileEntry): Boolean {
        if (!file.isFile || file.length() != expected.size) return false
        return SQLiteDownload.sha256Hex(file) == expected.sha256
    }

    private fun sha256Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return digest.joinToString("") { "%02x".format(it) }
    }

    private fun deleteRecursively(target: File) {
        if (!target.exists()) return
        if (target.isDirectory) {
            target.listFiles()?.forEach { deleteRecursively(it) }
        }
        target.delete()
    }
}
