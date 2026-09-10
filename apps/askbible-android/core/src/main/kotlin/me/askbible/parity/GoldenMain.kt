package me.askbible.parity

import me.askbible.native_.data.GoldenVerseAudioSource
import me.askbible.native_.data.HomeVerseEntry
import me.askbible.native_.data.HomeVersePool
import me.askbible.native_.data.PrayerMemoryRow
import me.askbible.native_.data.VerseDisplayNotes

/** 金句音源 / 选句算法对拍 harness（core --golden），stdin 协议与 Swift 侧相同 */
fun goldenMain() {
    val lines = generateSequence(::readLine).toList()
    var cursor = 0
    fun take(): String = if (cursor < lines.size) lines[cursor++] else ""
    val k = take().toIntOrNull() ?: 0
    val keys = List(k) { take() }
    val e = take().toIntOrNull() ?: 0
    val entries = List(e) { val p = take().split(" "); HomeVerseEntry(p[0], p.getOrNull(1)?.toIntOrNull() ?: 1) }
    val r = take().toIntOrNull() ?: 0
    val rngValues = List(r) { take().toDoubleOrNull() ?: 0.0 }
    val n = take().toIntOrNull() ?: 0
    val nows = List(n) { take().toDoubleOrNull() ?: 0.0 }
    val t = take().toIntOrNull() ?: 0
    val texts = List(t) { take() }

    var rngCursor = 0
    val rng: () -> Double = { val v = if (rngCursor < rngValues.size) rngValues[rngCursor] else 0.0; rngCursor++; v }

    val memory = HashMap<String, PrayerMemoryRow>()
    val picks = ArrayList<String>()
    for (now in nows) {
        val key = HomeVersePool.pickNext(entries, memory, now, rng)
        picks.add(key)
        if (key.isNotEmpty()) HomeVersePool.advanceMemory(memory, key, now)
    }
    fun str(s: String?) = if (s == null) "null" else jsonString(s)
    val sb = StringBuilder("{\"paths\":[")
    keys.forEachIndexed { i, key ->
        if (i > 0) sb.append(',')
        sb.append("{\"key\":").append(jsonString(key))
            .append(",\"cuv\":").append(str(GoldenVerseAudioSource.relativePath(key)))
            .append(",\"web\":").append(str(GoldenVerseAudioSource.relativePath(key, "web-en")))
            .append(",\"url\":").append(str(GoldenVerseAudioSource.remoteUrl(key))).append('}')
    }
    sb.append("],\"picks\":[")
    picks.forEachIndexed { i, p -> if (i > 0) sb.append(','); sb.append(jsonString(p)) }
    sb.append("],\"memory\":{")
    memory.entries.sortedBy { it.key }.forEachIndexed { i, (key, row) ->
        if (i > 0) sb.append(',')
        sb.append(jsonString(key)).append(":{\"lastShownAt\":").append(row.lastShownAt.toLong())
            .append(",\"intervalMs\":").append(row.intervalMs.toLong())
            .append(",\"level\":").append(row.level).append('}')
    }
    sb.append("},\"rngUsed\":").append(rngCursor).append(",\"strips\":[")
    texts.forEachIndexed { i, x -> if (i > 0) sb.append(','); sb.append("{\"text\":").append(jsonString(x)).append(",\"out\":").append(jsonString(VerseDisplayNotes.strip(x))).append('}') }
    sb.append("]}")
    println(sb)
}
