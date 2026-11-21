package me.askbible.native_.data

import org.json.JSONObject

/**
 * 离线包目录 `v2/catalog.json` 解析与本地文件名映射规则（纯 JVM，供 `:core:test` 与 `:app` `PackStore` 共用）。
 */
object PackCatalogRules {
    data class PackDescriptor(
        val id: String,
        val kind: String,
        val path: String,
        val sha256: String,
        val sizeBytes: Long,
    )

    fun parseCatalogJson(body: String): List<PackDescriptor>? {
        return runCatching {
            val root = JSONObject(body)
            val arr = root.optJSONArray("packs") ?: return null
            (0 until arr.length()).mapNotNull { idx ->
                val o = arr.optJSONObject(idx) ?: return@mapNotNull null
                val id = o.optString("id").trim()
                val path = o.optString("path").trim()
                val sha = o.optString("sha256").trim().lowercase()
                if (id.isEmpty() || path.isEmpty() || sha.isEmpty()) null
                else PackDescriptor(
                    id = id,
                    kind = o.optString("kind").trim(),
                    path = path,
                    sha256 = sha,
                    sizeBytes = o.optLong("sizeBytes", 0L),
                )
            }.takeIf { it.isNotEmpty() }
        }.getOrNull()
    }

    /**
     * `v2/catalog.json` 使用语义 ID（`bible.cuv-simp`、`companion.xrefs`），
     * 映射到本地 SQLite 文件基名（`cuv-simp`、`scripture-xrefs`、`info-edition`）。
     */
    fun localPackKey(pack: PackDescriptor): String {
        if (pack.id == "companion.xrefs") return "scripture-xrefs"
        if (pack.id.startsWith("bible.")) return pack.id.removePrefix("bible.")
        val fileName = pack.path.substringAfterLast('/')
        if (fileName.endsWith(".sqlite") && fileName.length > ".sqlite".length) {
            return fileName.removeSuffix(".sqlite")
        }
        return pack.id
    }

    fun candidateDownloadUrls(path: String, mediaBase: String, siteBase: String): List<String> {
        val rel = if (path.startsWith("/")) path else "/$path"
        return listOf(mediaBase + rel, siteBase + rel).distinct()
    }
}
