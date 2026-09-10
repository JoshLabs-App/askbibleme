package me.askbible.parity

import me.askbible.native_.data.ChapterAudioSource
import me.askbible.native_.data.VerseTiming
import me.askbible.native_.data.VerseTimingLookup

/**
 * 音源 URL 与时间轴定位的对拍 harness。
 * 用法：core --audio  /  core --timing（输入从 stdin 读，格式见对拍脚本）
 */
fun audioMain() {
    val cases = listOf(
        Triple("cuv-simp", Triple("GEN", 1, "Genesis"), 1),
        Triple("cuv-trad", Triple("MAT", 40, "Matthew"), 13),
        Triple("web-en", Triple("GEN", 1, "Genesis"), 1),
        Triple("web-en", Triple("MAT", 40, "Matthew"), 13),
        Triple("web-en", Triple("SNG", 22, "Song of Solomon"), 2),
        Triple("web-en", Triple("1CO", 46, "1 Corinthians"), 13),
        Triple("ust-en", Triple("GEN", 1, "Genesis"), 1),
        // YouVersion：先问网站代理，check 脚本会真去问一次再测 mp3
        Triple("niv", Triple("JHN", 43, "John"), 3),
        Triple("ccb-zh-hans", Triple("GEN", 1, "Genesis"), 1),
        Triple("rcuvss-zh-hans", Triple("PSA", 19, "Psalms"), 23),
    )
    val sb = StringBuilder("[")
    for ((i, c) in cases.withIndex()) {
        if (i > 0) sb.append(',')
        val (tid, book, ch) = c
        val (bookId, bookNum, bookName) = book
        val url = ChapterAudioSource.resolve(tid, bookId, bookNum, bookName, ch)
        sb.append("{\"translation\":\"").append(tid)
            .append("\",\"book\":\"").append(bookId)
            .append("\",\"chapter\":").append(ch)
            .append(",\"url\":").append(if (url == null) "null" else "\"" + url + "\"")
            .append('}')
    }
    println(sb.append(']'))
}

/** 定位算法：用固定的合成时间轴，探几个边界点 */
fun timingMain() {
    val timings = listOf(
        VerseTiming(1, 7.15, 12.04),
        VerseTiming(2, 12.04, 19.08),
        VerseTiming(3, 19.08, 22.68),
        VerseTiming(4, 22.68, 27.58),
        VerseTiming(31, 280.0, 290.54),
    )
    val probes = listOf(-1.0, 0.0, 6.15, 7.15, 9.59, 12.04, 20.0, 22.68, 27.57, 27.6, 285.0, 290.54, 295.0)
    val sb = StringBuilder("[")
    for ((i, t) in probes.withIndex()) {
        if (i > 0) sb.append(',')
        val v = VerseTimingLookup.activeVerse(t, timings)
        sb.append("{\"t\":").append(t).append(",\"verse\":").append(v ?: "null").append('}')
    }
    println(sb.append(']'))
}
