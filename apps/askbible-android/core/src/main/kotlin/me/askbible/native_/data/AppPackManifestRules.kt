package me.askbible.native_.data

import org.json.JSONObject

/**
 * D-47 统一静态内核 `pack-manifest.json` 增量热更规则与 `NativeBridge` 契约常量（纯 JVM，供 `:core:test` 与 `:app` 共用）。
 */
object AppPackManifestRules {
    const val SCHEMA_VERSION = 1

    data class ManifestFileEntry(
        val size: Long,
        val sha256: String,
    )

    data class PackManifest(
        val schemaVersion: Int,
        val bundleId: String,
        val builtAt: String,
        val entry: String,
        val files: Map<String, ManifestFileEntry>,
    )

    data class ActivePackRecord(
        val bundleId: String,
        val installedOnBuiltinId: String,
        val activatedAt: String,
    )

    data class PendingPackRecord(
        val bundleId: String,
        val stagedAt: String,
    )

    data class IncrementalPlan(
        val reusablePaths: List<String>,
        val downloadPaths: List<String>,
    )

    private val SHA256_RE = Regex("^[0-9a-f]{64}$")

    fun normalizeRelativePath(raw: String): String? {
        val trimmed = raw.trim().replace('\\', '/').trimStart('/')
        if (trimmed.isEmpty()) return null
        val segments = trimmed.split('/')
        if (segments.any { it.isEmpty() || it == "." || it == ".." || it.contains('\u0000') }) {
            return null
        }
        return segments.joinToString("/")
    }

    fun parseManifestJson(body: String): PackManifest? = runCatching {
        val root = JSONObject(body)
        val schemaVersion = root.optInt("schemaVersion", SCHEMA_VERSION)
        val bundleId = root.optString("bundleId", "").trim()
        if (bundleId.isEmpty()) return@runCatching null
        val builtAt = root.optString("builtAt", "").trim()
        val rawEntry = root.optString("entry", "index.html")
        val entry = normalizeRelativePath(rawEntry) ?: return@runCatching null
        val filesObj = root.optJSONObject("files") ?: return@runCatching null
        if (filesObj.length() == 0) return@runCatching null

        val files = LinkedHashMap<String, ManifestFileEntry>(filesObj.length())
        val keys = filesObj.keys()
        while (keys.hasNext()) {
            val rawKey = keys.next()
            val path = normalizeRelativePath(rawKey) ?: return@runCatching null
            val item = filesObj.optJSONObject(rawKey) ?: return@runCatching null
            val size = item.optLong("size", -1L)
            val sha = item.optString("sha256", "").trim().lowercase()
            if (size < 0L || !SHA256_RE.matches(sha)) return@runCatching null
            files[path] = ManifestFileEntry(size = size, sha256 = sha)
        }
        if (!files.containsKey(entry)) return@runCatching null

        PackManifest(
            schemaVersion = schemaVersion,
            bundleId = bundleId,
            builtAt = builtAt,
            entry = entry,
            files = files,
        )
    }.getOrNull()

    fun serializeManifestJson(manifest: PackManifest): String {
        val filesObj = JSONObject()
        for ((path, entry) in manifest.files) {
            filesObj.put(
                path,
                JSONObject()
                    .put("size", entry.size)
                    .put("sha256", entry.sha256),
            )
        }
        return JSONObject()
            .put("schemaVersion", manifest.schemaVersion)
            .put("bundleId", manifest.bundleId)
            .put("builtAt", manifest.builtAt)
            .put("entry", manifest.entry)
            .put("files", filesObj)
            .toString()
    }

    fun parseActiveJson(body: String): ActivePackRecord? = runCatching {
        val root = JSONObject(body)
        val bundleId = root.optString("bundleId", "").trim()
        val builtinId = root.optString("installedOnBuiltinId", "").trim()
        val activatedAt = root.optString("activatedAt", "").trim()
        if (bundleId.isEmpty() || builtinId.isEmpty()) return@runCatching null
        ActivePackRecord(
            bundleId = bundleId,
            installedOnBuiltinId = builtinId,
            activatedAt = activatedAt,
        )
    }.getOrNull()

    fun serializeActiveJson(record: ActivePackRecord): String =
        JSONObject()
            .put("bundleId", record.bundleId)
            .put("installedOnBuiltinId", record.installedOnBuiltinId)
            .put("activatedAt", record.activatedAt)
            .toString()

    fun parsePendingJson(body: String): PendingPackRecord? = runCatching {
        val root = JSONObject(body)
        val bundleId = root.optString("bundleId", "").trim()
        val stagedAt = root.optString("stagedAt", "").trim()
        if (bundleId.isEmpty()) return@runCatching null
        PendingPackRecord(bundleId = bundleId, stagedAt = stagedAt)
    }.getOrNull()

    fun serializePendingJson(record: PendingPackRecord): String =
        JSONObject()
            .put("bundleId", record.bundleId)
            .put("stagedAt", record.stagedAt)
            .toString()

    /**
     * 重装新版原生壳时，若 `installedOnBuiltinId != currentBuiltinId`，自动淘汰旧沙盒包改用新版内置包。
     */
    fun shouldPurgeSandboxForNewBuiltin(active: ActivePackRecord?, currentBuiltinId: String): Boolean {
        if (active == null) return false
        val cleanBuiltin = currentBuiltinId.trim()
        if (cleanBuiltin.isEmpty()) return false
        return active.installedOnBuiltinId != cleanBuiltin
    }

    /**
     * 比对目标清单与本地已有文件（`size + sha256`）：命中的直接 0 流量复用，仅列出需要下载的变更文件。
     */
    fun planIncrementalFiles(
        manifest: PackManifest,
        hasVerifiedFile: (path: String, entry: ManifestFileEntry) -> Boolean,
    ): IncrementalPlan {
        val reusable = ArrayList<String>(manifest.files.size)
        val download = ArrayList<String>()
        for ((path, entry) in manifest.files) {
            if (hasVerifiedFile(path, entry)) {
                reusable.add(path)
            } else {
                download.add(path)
            }
        }
        return IncrementalPlan(reusablePaths = reusable, downloadPaths = download)
    }

    fun candidateManifestUrls(mediaBase: String, siteBase: String): List<String> =
        listOf(
            mediaBase.trimEnd('/') + "/v3/app-pack/pack-manifest.json",
            siteBase.trimEnd('/') + "/v3/app-pack/pack-manifest.json",
        ).distinct()

    fun candidateAssetUrls(relativePath: String, mediaBase: String, siteBase: String): List<String> {
        val clean = normalizeRelativePath(relativePath) ?: return emptyList()
        return listOf(
            mediaBase.trimEnd('/') + "/v3/app-pack/$clean",
            siteBase.trimEnd('/') + "/v3/app-pack/$clean",
        ).distinct()
    }
}

/**
 * D-47 锁死的 5 组 `AskBibleBridge` 协议与本地路由契约常量（供契约校验与单测核对）。
 */
object NativeBridgeContract {
    const val ORIGIN = "https://pack.askbible.local/"
    const val CACHE_CONTROL = "no-store, no-cache"

    val LOCAL_DB_ROUTES = setOf(
        "/local-db/chapter",
        "/local-db/search",
        "/local-db/translations",
    )

    val BRIDGE_METHODS = setOf(
        "audio.intent",
        "shell.setTab",
        "shell.setTheme",
        "shell.haptic",
        "pack.status",
        "pack.checkNow",
        "pack.downloadTranslation",
        "pack.commitSwap",
        "auth.signIn",
        "auth.getSession",
        "auth.signOut",
        "sys.setReminder",
        "sys.syncWidget",
        "sys.shareImage",
    )

    val BRIDGE_EVENTS = setOf(
        "audio.state",
        "shell.tabSelected",
        "shell.backPressed",
        "pack.readyToSwap",
    )
}
