package me.askbible.native_.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.io.File

data class LoadedVerse(
    val number: Int,
    val text: String,
    val speechParts: List<SpeechPart>?,
    val themeRepeatCount: Int,
    val isGolden: Boolean,
)

/**
 * 内置圣经库的只读访问。与 iOS 的 `ScriptureDatabase.swift` 对等。
 *
 * 和 iOS 的一处真实差异：iOS 能直接以只读方式打开 bundle 内的文件，
 * Android 的 assets 在 APK 里是压缩条目、没有真实路径，SQLiteDatabase 打不开，
 * 必须先拷到 filesDir。（build.gradle 里 noCompress 保证 asset 不被压缩，
 * 拷贝才是按字节直读。）
 *
 * schema（selah-scripture-sqlite-v3）：
 *   verse(book_id, chapter, verse, text, speech_spans, flags, theme_repeat_count)
 */
class ScriptureDatabase private constructor(
    val translationId: String,
    private val db: SQLiteDatabase,
) {
    companion object {
        private val BOOK_RE = Regex("^[A-Z0-9]{2,8}$")

        fun open(context: Context, translationId: String): ScriptureDatabase? {
            // 按需下载的译本（KJV）住在 filesDir/scripture；其余从 assets 拷出来
            val downloaded = TranslationDownloader.localFile(context, translationId)
            val file = (if (downloaded.exists() && downloaded.length() > 0) downloaded else null)
                ?: ensureOnDisk(context, "$translationId.sqlite") ?: return null
            return try {
                ScriptureDatabase(
                    translationId,
                    SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY)
                )
            } catch (_: Exception) {
                null
            }
        }

        /** assets 里的库拷到 filesDir；已存在且大小一致就不重复拷 */
        fun ensureOnDisk(context: Context, assetName: String): File? {
            val dest = File(context.filesDir, assetName)
            return try {
                val expected = context.assets.openFd(assetName).use { it.length }
                if (dest.exists() && dest.length() == expected) return dest
                context.assets.open(assetName).use { input ->
                    dest.outputStream().use { output -> input.copyTo(output, 1 shl 16) }
                }
                dest
            } catch (_: Exception) {
                if (dest.exists()) dest else null
            }
        }
    }

    fun meta(key: String): String? =
        db.rawQuery("SELECT value FROM meta WHERE key = ?", arrayOf(key)).use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        }

    fun chapterCount(bookId: String): Int =
        db.rawQuery("SELECT MAX(chapter) FROM verse WHERE book_id = ?", arrayOf(bookId)).use { c ->
            if (c.moveToFirst()) c.getInt(0) else 0
        }

    /** 读一章，按 verse 升序，逐行走标注解码。 */
    fun loadChapter(bookId: String, chapter: Int): List<LoadedVerse> {
        if (!BOOK_RE.matches(bookId) || chapter < 1) return emptyList()
        val sql = """
            SELECT verse, text, speech_spans, flags, theme_repeat_count
            FROM verse WHERE book_id = ? AND chapter = ? ORDER BY verse ASC
        """.trimIndent()

        return db.rawQuery(sql, arrayOf(bookId, chapter.toString())).use { c ->
            val out = ArrayList<LoadedVerse>(c.count)
            while (c.moveToNext()) {
                val number = c.getInt(0)
                val text = c.getString(1) ?: ""
                if (number < 1 || text.isEmpty()) continue
                val rawSpans = c.getString(2)
                val themeRepeat = c.getInt(4)
                out.add(LoadedVerse(
                    number = number,
                    text = text,
                    speechParts = VerseAnnotations.speechParts(text, rawSpans),
                    themeRepeatCount = themeRepeat,
                    isGolden = VerseAnnotations.showsGoldenThemeMarker(themeRepeat),
                ))
            }
            out
        }
    }

    /**
     * searchScriptureVersesMobile：LIKE 全文；本章范围直接带 book/chapter 条件；旧约 / 新约先取 120 再按卷过滤；最多 40 条。
     * 排序照 RN：ORDER BY book_id, chapter, verse（book_id 是字符串序，RN 就是这么排的，对齐它）。与 iOS 的 ScriptureDatabase.search 对等。
     */
    fun search(raw: String, scope: ScriptureSearchScope, chapterRef: SearchChapterRef?): List<ScriptureSearchHit> {
        val q = ScriptureSearchRules.normalize(raw)
        if (q.isEmpty() || q.length < ScriptureSearchRules.MIN_LENGTH) return emptyList()
        if (scope == ScriptureSearchScope.CHAPTER && chapterRef == null) return emptyList()
        val like = "%${ScriptureSearchRules.escapeLike(q)}%"
        val rows = ArrayList<Array<Any>>()
        val cursor = if (scope == ScriptureSearchScope.CHAPTER && chapterRef != null) db.rawQuery(
            "SELECT book_id, chapter, verse, text FROM verse WHERE text LIKE ? ESCAPE '\\' AND book_id = ? AND chapter = ? ORDER BY verse LIMIT ?",
            arrayOf(like, chapterRef.bookId, chapterRef.chapter.toString(), ScriptureSearchRules.LIMIT.toString()))
        else db.rawQuery(
            "SELECT book_id, chapter, verse, text FROM verse WHERE text LIKE ? ESCAPE '\\' ORDER BY book_id, chapter, verse LIMIT ?",
            arrayOf(like, (if (scope == ScriptureSearchScope.ALL) ScriptureSearchRules.LIMIT else ScriptureSearchRules.SCOPED_FETCH_LIMIT).toString()))
        cursor.use { c -> while (c.moveToNext()) rows.add(arrayOf(c.getString(0) ?: "", c.getInt(1), c.getInt(2), c.getString(3) ?: "")) }
        val filtered = if (scope == ScriptureSearchScope.CHAPTER) rows else rows.filter {
            ScriptureSearchRules.isVerseInScope(it[0] as String, it[1] as Int, scope, chapterRef)
        }
        return filtered.take(ScriptureSearchRules.LIMIT).mapNotNull { r ->
            val bookId = r[0] as String; val text = (r[3] as String).trim()
            if (bookId.isEmpty() || text.isEmpty()) null
            else ScriptureSearchHit(bookId, BibleCatalog.book(bookId)?.nameZh ?: bookId, r[1] as Int, r[2] as Int, text)
        }
    }

    fun close() = db.close()
}

/**
 * 交叉引用库。查询与 iOS 侧、与 RN 的 `load-chapter-xrefs.ts` 的 UNION 一致。
 */
class XrefDatabase private constructor(private val db: SQLiteDatabase) {
    companion object {
        fun open(context: Context): XrefDatabase? {
            val file = ScriptureDatabase.ensureOnDisk(context, "scripture-xrefs.sqlite") ?: return null
            return try {
                XrefDatabase(SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY))
            } catch (_: Exception) {
                null
            }
        }
    }

    /** 一节的交叉引用，与 iOS 侧、RN 的 loadChapterVerseXrefs 一致 */
    fun verseXrefs(bookId: String, chapter: Int, verse: Int): VerseXrefs {
        val args = arrayOf(bookId, chapter.toString(), verse.toString())
        val outgoing = db.rawQuery("""
            SELECT to_book_id, to_chapter, to_verse_start, to_verse_end, priority
            FROM xref_out WHERE from_book_id = ? AND from_chapter = ? AND from_verse = ?
            ORDER BY priority DESC
        """.trimIndent(), args).use { c ->
            val out = ArrayList<XrefTarget>(c.count)
            while (c.moveToNext()) {
                val start = c.getInt(2); val end = c.getInt(3)
                out.add(XrefTarget(c.getString(0), c.getInt(1), start, if (end >= start) end else start, c.getInt(4)))
            }
            out
        }
        val incoming = db.rawQuery("""
            SELECT from_book_id, from_chapter, from_verse, priority
            FROM xref_in WHERE to_book_id = ? AND to_chapter = ? AND to_verse = ?
            ORDER BY priority DESC
        """.trimIndent(), args).use { c ->
            val out = ArrayList<XrefTarget>(c.count)
            while (c.moveToNext()) {
                val v = c.getInt(2)
                out.add(XrefTarget(c.getString(0), c.getInt(1), v, v, c.getInt(3)))
            }
            out
        }
        return VerseXrefs(verse, incoming, outgoing)
    }

    fun versesWithXrefs(bookId: String, chapter: Int): Set<Int> {
        val sql = """
            SELECT DISTINCT from_verse AS verse FROM xref_out
            WHERE from_book_id = ? AND from_chapter = ?
            UNION
            SELECT DISTINCT to_verse AS verse FROM xref_in
            WHERE to_book_id = ? AND to_chapter = ?
            ORDER BY verse
        """.trimIndent()
        val ch = chapter.toString()
        return db.rawQuery(sql, arrayOf(bookId, ch, bookId, ch)).use { c ->
            val out = LinkedHashSet<Int>()
            while (c.moveToNext()) {
                val v = c.getInt(0)
                if (v >= 1) out.add(v)
            }
            out
        }
    }

    fun close() = db.close()
}
