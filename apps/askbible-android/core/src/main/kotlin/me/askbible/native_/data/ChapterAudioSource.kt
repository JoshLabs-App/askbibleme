package me.askbible.native_.data

/**
 * 整章朗读的音源解析。与 iOS 的 `ChapterAudioSource.swift` 对等双写，
 * 真源是 RN 的 `cuv-chapter-audio.ts` / `web-chapter-audio.ts`。
 * URL 规则由 check:chapter-audio 三端对拍 + 实测可达性锁住。
 */
object ChapterAudioSource {
    /** CUV_CHAPTER_AUDIO_REMOTE_BASE */
    const val CUV_REMOTE_BASE = "https://media.fhl.net/unvdavid"
    const val WEB_REMOTE_NT = "https://theaudiopower.org/WEB/Recordings"
    const val WEB_REMOTE_OT = "https://theaudiopower.org/WEB2/Recordings"
    /** OLD_TESTAMENT_MAX_BOOK_NUMBER */
    const val OLD_TESTAMENT_MAX_BOOK_NUMBER = 39

    /** translationSupportsCuvChapterAudio */
    fun supportsCuvAudio(translationId: String): Boolean =
        translationId.trim().lowercase().startsWith("cuv")

    /** translationUsesWebChapterAudio（本工程只内置 web-en） */
    fun usesWebAudio(translationId: String): Boolean =
        translationId.trim().lowercase() == "web-en"

    /** buildExternalCuvChapterAudioUrl —— 章号补三位 */
    fun cuvChapterUrl(bookNumber: Int, chapter: Int): String? {
        if (bookNumber < 1 || chapter < 1) return null
        val ch = chapter.toString().padStart(3, '0')
        return "$CUV_REMOTE_BASE/$bookNumber/${bookNumber}_$ch.mp3"
    }

    /** WEB_AUDIO_BOOK_NAME_OVERRIDES */
    private val WEB_BOOK_NAME_OVERRIDES = mapOf(
        "PSA" to "Psalms",
        "SNG" to "Song of Solomon",
    )

    /** buildExternalWebChapterAudioUrl —— `{base}/{英文书名 章号}.mp3`，空格等要转义 */
    fun webChapterUrl(bookId: String, bookNumber: Int, bookName: String, chapter: Int): String? {
        if (bookNumber < 1 || chapter < 1) return null
        val name = WEB_BOOK_NAME_OVERRIDES[bookId.uppercase()] ?: bookName
        val base = if (bookNumber <= OLD_TESTAMENT_MAX_BOOK_NUMBER) WEB_REMOTE_OT else WEB_REMOTE_NT
        return "$base/${percentEncode("$name $chapter")}.mp3"
    }

    /**
     * 只保留 unreserved 字符，其余按 UTF-8 逐字节转义 ——
     * 与 iOS 侧 addingPercentEncoding(withAllowedCharacters:) 的字符集一致。
     */
    private fun percentEncode(s: String): String {
        val unreserved = "-._~"
        val sb = StringBuilder()
        for (b in s.toByteArray(Charsets.UTF_8)) {
            val c = b.toInt().toChar()
            if (c.isLetterOrDigit() && c.code < 128 || unreserved.indexOf(c) >= 0) {
                sb.append(c)
            } else {
                sb.append('%').append("%02X".format(b.toInt() and 0xFF))
            }
        }
        return sb.toString()
    }

    /** 当前译本下这一章的可播地址；没有音源的译本返回 null（UI 据此禁用播放键） */
    // ---- KJV（lib/bible/kjv-chapter-audio-url.ts：audiotreasure）
    const val KJV_REMOTE_BASE = "https://www.audiotreasure.com/content/KJV_AT"
    private val kjvBookNames = mapOf(
        "GEN" to "Genesis", "EXO" to "Exodus", "LEV" to "Leviticus", "NUM" to "Numbers", "DEU" to "Deuteronomy",
        "JOS" to "Joshua", "JDG" to "Judges", "RUT" to "Ruth", "1SA" to "1Samuel", "2SA" to "2Samuel",
        "1KI" to "1Kings", "2KI" to "2Kings", "1CH" to "1Chronicles", "2CH" to "2Chronicles",
        "EZR" to "Ezra", "NEH" to "Nehemiah", "EST" to "Esther", "JOB" to "Job", "PSA" to "Psalms",
        "PRO" to "Proverbs", "ECC" to "Ecclesiastes", "SNG" to "SongofSolomon", "ISA" to "Isaiah",
        "JER" to "Jeremiah", "LAM" to "Lamentations", "EZK" to "Ezekiel", "DAN" to "Daniel", "HOS" to "Hosea",
        "JOL" to "Joel", "AMO" to "Amos", "OBA" to "Obadiah", "JON" to "Jonah", "MIC" to "Micah", "NAM" to "Nahum",
        "HAB" to "Habakkuk", "ZEP" to "Zephaniah", "HAG" to "Haggai", "ZEC" to "Zechariah", "MAL" to "Malachi",
        "MAT" to "Matthew", "MRK" to "Mark", "LUK" to "Luke", "JHN" to "John", "ACT" to "Acts", "ROM" to "Romans",
        "1CO" to "1Corinthians", "2CO" to "2Corinthians", "GAL" to "Galatians", "EPH" to "Ephesians",
        "PHP" to "Philippians", "COL" to "Colossians", "1TH" to "1Thessalonians", "2TH" to "2Thessalonians",
        "1TI" to "1Timothy", "2TI" to "2Timothy", "TIT" to "Titus", "PHM" to "Philemon", "HEB" to "Hebrews",
        "JAS" to "James", "1PE" to "1Peter", "2PE" to "2Peter", "1JN" to "1John", "2JN" to "2John",
        "3JN" to "3John", "JUD" to "Jude", "REV" to "Revelation",
    )

    /** buildAudioTreasureKjvChapterUrl：`{base}/{书序两位}_{英文名}{章三位}.mp3`；单章小书第 1 章不带章号；约伯 / 雅歌有特殊 stem */
    fun kjvChapterUrl(bookId: String, bookNumber: Int, chapter: Int): String? {
        val id = bookId.trim().uppercase()
        val name = kjvBookNames[id] ?: return null
        if (bookNumber < 1 || chapter < 1) return null
        val ordinal = bookNumber.toString().padStart(2, '0')
        if (chapter == 1 && id in setOf("PHM", "2JN", "3JN", "JUD")) return "$KJV_REMOTE_BASE/${ordinal}_$name.mp3"
        val stem = when (id) { "JOB" -> "18_Job"; "SNG" -> "22_Song_of_Soloman"; else -> "${ordinal}_$name" }
        return "$KJV_REMOTE_BASE/$stem${chapter.toString().padStart(3, '0')}.mp3"
    }

    fun resolve(translationId: String, bookId: String, bookNumber: Int,
                bookName: String, chapter: Int): String? = when {
        supportsCuvAudio(translationId) -> cuvChapterUrl(bookNumber, chapter)
        translationId.trim().lowercase() == "kjv" -> kjvChapterUrl(bookId, bookNumber, chapter)
        usesWebAudio(translationId) -> webChapterUrl(bookId, bookNumber, bookName, chapter)
        // ust-en 在 RN 侧也没有整章音源
        else -> null
    }
}
