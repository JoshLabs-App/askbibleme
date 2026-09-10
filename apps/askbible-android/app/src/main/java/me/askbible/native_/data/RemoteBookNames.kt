package me.askbible.native_.data

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * 在线译本自己的书卷名（该版本的语言）：网站 `/api/mobile/bible/youversion/books?versionId=`。
 *
 * 内置译本的书卷名在 BibleCatalog 里（中英两份），够用；但西班牙语等版本读出来的是西语正文，
 * 目录页 / 章标题还写着中文或英文书卷名就对不上（Josh 2026-09-10）。
 * 每个版本一份，落盘 cacheDir/book-names/<版本号>.tsv，取到就一直用。与 iOS 的 RemoteBookNames 对等。
 */
object RemoteBookNames {
    const val ENDPOINT = "https://askbible.me/api/mobile/bible/youversion/books"

    private val lock = Any()
    private val memory = HashMap<String, Map<String, String>>()
    /** 取到新的一份就 +1，界面据此重画 */
    @Volatile var revision = 0; private set

    /** 这个译本要不要用远端书卷名：只有目录接口带进来的那些（内置 20 本有自己的中英名） */
    fun usesRemoteNames(t: ScriptureTranslation): Boolean = t.id.startsWith("yv-") && t.remoteId.isNotEmpty()

    /** 该译本下这一卷的名字；没有就返回 null（调用方退回 BibleCatalog 的中英名） */
    fun name(context: Context, t: ScriptureTranslation, bookId: String): String? {
        if (!usesRemoteNames(t)) return null
        val book = bookId.trim().uppercase()
        synchronized(lock) { memory[t.remoteId] }?.let { return it[book] }
        val disk = readDisk(context, t.remoteId)
        if (disk.isEmpty()) return null
        synchronized(lock) { memory[t.remoteId] = disk; revision += 1 }
        return disk[book]
    }

    /** 切到这个译本时叫一次：盘里有就只读盘，没有才走网。在 IO 线程调 */
    fun ensure(context: Context, t: ScriptureTranslation): Boolean {
        if (!usesRemoteNames(t)) return false
        synchronized(lock) { if (memory.containsKey(t.remoteId)) return false }
        val disk = readDisk(context, t.remoteId)
        if (disk.isNotEmpty()) {
            synchronized(lock) { memory[t.remoteId] = disk; revision += 1 }
            return true
        }
        val text = try {
            val conn = URL("$ENDPOINT?versionId=${t.remoteId}").openConnection() as HttpURLConnection
            conn.connectTimeout = 30_000; conn.readTimeout = 30_000
            conn.setRequestProperty("Accept", "application/json")
            try {
                if (conn.responseCode != 200) return false
                conn.inputStream.bufferedReader().use { it.readText() }
            } finally { conn.disconnect() }
        } catch (_: Exception) { return false }
        val list = try { JSONObject(text).optJSONArray("books") } catch (_: Exception) { null } ?: return false
        val map = HashMap<String, String>(80)
        for (i in 0 until list.length()) {
            val o = list.optJSONObject(i) ?: continue
            val id = o.optString("id").trim().uppercase()
            val title = o.optString("title").trim()
            if (id.isNotEmpty() && title.isNotEmpty()) map[id] = title
        }
        if (map.isEmpty()) return false
        synchronized(lock) { memory[t.remoteId] = map; revision += 1 }
        writeDisk(context, t.remoteId, map)
        return true
    }

    // ---- 落盘（一行一卷的 TSV，读起来比 JSON 快得多） ----

    private fun file(context: Context, remoteId: String) = File(File(context.cacheDir, "book-names"), "$remoteId.tsv")

    private fun readDisk(context: Context, remoteId: String): Map<String, String> = try {
        val f = file(context, remoteId)
        if (!f.exists()) emptyMap() else f.readText().split('\n').mapNotNull { line ->
            val p = line.split('\t')
            if (p.size == 2 && p[0].isNotEmpty() && p[1].isNotEmpty()) p[0] to p[1] else null
        }.toMap()
    } catch (_: Exception) { emptyMap() }

    private fun writeDisk(context: Context, remoteId: String, map: Map<String, String>) {
        try {
            val f = file(context, remoteId); f.parentFile?.mkdirs()
            f.writeText(map.entries.sortedBy { it.key }.joinToString("\n") { "${it.key}\t${it.value.replace('\t', ' ')}" })
        } catch (_: Exception) { }
    }
}
