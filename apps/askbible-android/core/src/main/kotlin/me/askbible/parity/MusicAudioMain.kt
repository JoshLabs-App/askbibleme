package me.askbible.parity

import me.askbible.native_.data.MusicAlbumRules
import me.askbible.native_.data.MusicAudioSource
import me.askbible.native_.data.MusicCatalog

/**
 * 音乐音源 / 专辑规则对拍 harness。stdin 协议：N、N 行 src；M、M 行专辑别名。
 * 输出与 Swift 侧同形状的 JSON（core --music）。
 */
fun musicMain() {
    val lines = generateSequence(::readLine).toList()
    var cursor = 0
    fun take(): String = if (cursor < lines.size) lines[cursor++] else ""
    val n = take().toIntOrNull() ?: 0
    val srcs = List(n) { take() }
    val m = take().toIntOrNull() ?: 0
    val raws = List(m) { take() }

    fun str(s: String?) = if (s == null) "null" else jsonString(s)
    fun int(i: Int?) = i?.toString() ?: "null"
    val tracks = MusicCatalog.tracks
    val sb = StringBuilder("{")
    sb.append("\"urls\":[")
    srcs.forEachIndexed { i, s ->
        if (i > 0) sb.append(',')
        sb.append("{\"src\":").append(jsonString(s)).append(",\"url\":").append(str(MusicAudioSource.remoteUrl(s))).append('}')
    }
    sb.append("],\"normalize\":[")
    raws.forEachIndexed { i, r ->
        if (i > 0) sb.append(',')
        sb.append("{\"raw\":").append(jsonString(r)).append(",\"album\":").append(jsonString(MusicAlbumRules.normalize(r))).append('}')
    }
    sb.append("],\"rules\":[")
    (MusicCatalog.albums + "未知专辑").forEachIndexed { i, a ->
        if (i > 0) sb.append(',')
        sb.append("{\"album\":").append(jsonString(a))
            .append(",\"repeatMode\":").append(str(MusicAlbumRules.defaultRepeatMode(a)?.raw))
            .append(",\"gain\":").append(MusicAlbumRules.defaultGain(a))
            .append(",\"sleepFrom0\":").append(int(MusicAlbumRules.sleepTimerOnSwitch(a, 0)))
            .append(",\"sleepFrom30\":").append(int(MusicAlbumRules.sleepTimerOnSwitch(a, 30)))
            .append(",\"short\":").append(jsonString(MusicAlbumRules.shortLabel(a))).append('}')
    }
    sb.append("],\"starts\":[")
    var first = true
    for (a in MusicCatalog.albums) {
        fun row(from: Int) {
            if (!first) sb.append(','); first = false
            val id = MusicAlbumRules.startIndex(tracks, a, from)?.let { tracks[it].id }
            sb.append("{\"album\":").append(jsonString(a)).append(",\"from\":").append(from)
                .append(",\"startId\":").append(str(id)).append('}')
        }
        row(-1)
        val last = tracks.indices.lastOrNull { tracks[it].album == a }
        if (last != null) row(last)
    }
    sb.append("],\"catalog\":{\"count\":").append(tracks.size).append(",\"bundled\":[")
    tracks.filter { it.bundled }.forEachIndexed { i, t -> if (i > 0) sb.append(','); sb.append(jsonString(t.id)) }
    sb.append("],\"albums\":{")
    val byAlbum = LinkedHashMap<String, Int>()
    for (t in tracks) byAlbum[t.album] = (byAlbum[t.album] ?: 0) + 1
    byAlbum.entries.forEachIndexed { i, e -> if (i > 0) sb.append(','); sb.append(jsonString(e.key)).append(':').append(e.value) }
    sb.append("}}}")
    println(sb)
}
