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

    // ---- YouVersion（RN youversion-chapter-audio.ts 的 YOUVERSION_AUDIO_VERSION_IDS） ----
    // Josh 2026-09-10：「YouVersion 里有的版本全放开来接入，不需要人为去选」—— RN 的 VERIFIED 名单是空的、原生这里不设名单。
    // bible.com 的音频页现在有 JS 反爬壳，所以走网站自己的代理 /api/read/chapter-audio 拿 CDN 的 mp3 地址，音频本身不经 askbible.me。
    val youVersionVersionIds: Map<String, String> = mapOf(
        "asv" to "12", "esv" to "59", "ccb-zh-hans" to "36", "ccb-zh-hant" to "1392", "cnv-zh-hant" to "40", "cnvs-zh-hans" to "41",
        "csbs-zh-hans" to "43", "csbt-zh-hant" to "312", "cunp-zh-hant" to "46", "cunp-zh-hant-god" to "414",
        "cunpss-zh-hans" to "48", "cunpss-zh-hant" to "47", "rcuv-zh-hant" to "139", "rcuvss-zh-hans" to "140",
        "niv" to "111", "nlt" to "116", "nkjv" to "114", "kjv" to "1",
    )
    const val CHAPTER_AUDIO_PROXY_BASE = "https://askbible.me/api/read/chapter-audio"

    /** 走 YouVersion 音源的译本（和合本 / KJV / WEB 有直连音源的优先直连） */
    fun usesYouVersionAudio(translationId: String): Boolean {
        val id = translationId.trim().lowercase()
        if (supportsCuvAudio(id) || id == "kjv" || usesWebAudio(id)) return false
        return youVersionVersionIds.containsKey(id)
    }

    /** 代理地址：返回 {"src": "<CDN mp3>"}；播放器先问它再装载 */
    fun youVersionResolveUrl(translationId: String, bookId: String, chapter: Int): String? {
        val id = translationId.trim().lowercase(); val book = bookId.trim().uppercase()
        if (chapter < 1 || !youVersionVersionIds.containsKey(id) || book.isEmpty()) return null
        return "$CHAPTER_AUDIO_PROXY_BASE?translationId=$id&bookId=$book&chapter=$chapter"
    }

    /** 这是「先问代理」的地址，不是能直接播的 mp3 */
    fun isResolverUrl(url: String): Boolean = url.startsWith(CHAPTER_AUDIO_PROXY_BASE)

    /** 代理返回的 JSON → mp3 地址（只认 youversionapi.com 的 https 直链） */
    fun parseResolverResponse(text: String): String? {
        val m = Regex("\"src\"\\s*:\\s*\"([^\"]+)\"").find(text) ?: return null
        val src = m.groupValues[1].replace("\\/", "/").trim()
        return if (src.startsWith("https://") && src.contains("youversionapi.com")) src else null
    }

    private val resolvedCache = HashMap<String, String>()

    /** 问代理拿 mp3 地址（15 秒超时；失败回 null）。在 IO 线程调 */
    fun fetchResolved(resolver: String, cacheKey: String): String? {
        synchronized(resolvedCache) { resolvedCache[cacheKey]?.let { return it } }
        return try {
            val conn = java.net.URL(resolver).openConnection() as java.net.HttpURLConnection
            conn.connectTimeout = 15_000; conn.readTimeout = 15_000
            conn.setRequestProperty("Accept", "application/json")
            val text = if (conn.responseCode == 200) conn.inputStream.bufferedReader().use { it.readText() } else null
            conn.disconnect()
            val url = text?.let { parseResolverResponse(it) }
            if (url != null) synchronized(resolvedCache) { resolvedCache[cacheKey] = url }
            url
        } catch (_: Exception) { null }
    }

    /** 这个译本有没有整章音源（直连或 YouVersion） */
    fun hasAudio(translationId: String): Boolean =
        supportsCuvAudio(translationId) || translationId.trim().lowercase() == "kjv" || usesWebAudio(translationId) || usesYouVersionAudio(translationId)

    /** 当前译本下这一章的可播地址；没有音源的译本返回 null。YouVersion 译本返回代理地址（isResolverUrl），壳要先 fetchResolved 再装载 */
    fun resolve(translationId: String, bookId: String, bookNumber: Int,
                bookName: String, chapter: Int): String? = when {
        supportsCuvAudio(translationId) -> cuvChapterUrl(bookNumber, chapter)
        translationId.trim().lowercase() == "kjv" -> kjvChapterUrl(bookId, bookNumber, chapter)
        usesWebAudio(translationId) -> webChapterUrl(bookId, bookNumber, bookName, chapter)
        usesYouVersionAudio(translationId) -> youVersionResolveUrl(translationId, bookId, chapter)
        // ust-en 在 RN 侧也没有整章音源
        else -> null
    }
}
