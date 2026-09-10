package me.askbible.native_.data

/**
 * 金句语音音源。对应共享库 lib/bible/golden-verse-audio.ts + lib/bible/parse-verse-key.ts，与 iOS 对等：
 * R2 直链点播，对象键 audio/golden-verses/{书}-{章}-{节}-32kbps.mp3（英文 WEB 在 golden-verses-web-en）。
 * 禁止回落到 askbible.me / Render。
 */
object GoldenVerseAudioSource {
    const val R2_PUBLIC_BASE = "https://pub-f30fb48025d841f09c37bb9b52df5354.r2.dev"
    const val SUFFIX = "-32kbps.mp3"

    data class Location(val bookId: String, val chapter: Int, val verse: Int)

    private val rangeRe = Regex("^([A-Z0-9]{2,8})\\.([0-9]+)\\.([0-9]+)-")
    private val singleRe = Regex("^([A-Z0-9]{2,8})\\.([0-9]+)\\.([0-9]+)$")

    /** 解析 PRO.3.5 / GEN.1.1-GEN.1.3（区间取起点）；大小写不敏感；章节必须 ≥ 1 */
    fun parseVerseKey(key: String): Location? {
        val s = key.trim().uppercase()
        if (s.isEmpty()) return null
        val m = rangeRe.find(s) ?: singleRe.find(s) ?: return null
        val chapter = m.groupValues[2].toIntOrNull() ?: return null
        val verse = m.groupValues[3].toIntOrNull() ?: return null
        if (chapter < 1 || verse < 1) return null
        return Location(m.groupValues[1], chapter, verse)
    }

    /** golden-verses/GEN-1-1-32kbps.mp3；translationId 只认 web-en，其余都是 cuv-simp */
    fun relativePath(verseKey: String, translationId: String = "cuv-simp"): String? {
        val loc = parseVerseKey(verseKey) ?: return null
        val subdir = if (translationId == "web-en") "golden-verses-web-en" else "golden-verses"
        return "$subdir/${loc.bookId}-${loc.chapter}-${loc.verse}$SUFFIX"
    }

    fun remoteUrl(verseKey: String, translationId: String = "cuv-simp"): String? {
        val rel = relativePath(verseKey, translationId) ?: return null
        return "$R2_PUBLIC_BASE/audio/$rel"
    }
}
