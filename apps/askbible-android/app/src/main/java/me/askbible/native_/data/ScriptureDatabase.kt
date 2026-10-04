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
        /** `CASE book_id WHEN 'GEN' THEN 0 … END`：把创世记→启示录的卷序交给 SQLite 排 */
        private val bookOrderSql: String by lazy {
            val cases = BibleCatalog.all.withIndex().joinToString(" ") { (i, b) -> "WHEN '${b.id}' THEN $i" }
            "CASE book_id $cases ELSE 999 END"
        }
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
     * 经文搜索：LIKE 全文；本章范围直接带 book/chapter 条件，旧约 / 新约在 SQL 里按卷序筛。
     * 结果全部给出、另报总数，超过 500 条才截断（D-30，Josh 2026-10-04：原来 40 条封顶又不提示，看着像搜不到）。
     * 排序按圣经卷序（Josh 2026-09-11）：book_id 是字符串，直接排「1CO」会在「GEN」前面，所以卷序做成 CASE 表达式。与 iOS 对等。
     */
    fun search(raw: String, scope: ScriptureSearchScope, chapterRef: SearchChapterRef?): ScriptureSearchResult {
        val q = ScriptureSearchRules.normalize(raw)
        if (q.isEmpty() || q.length < ScriptureSearchRules.MIN_LENGTH) return ScriptureSearchResult.EMPTY
        if (scope == ScriptureSearchScope.CHAPTER && chapterRef == null) return ScriptureSearchResult.EMPTY
        var where = "text LIKE ? ESCAPE '\\'"
        val args = arrayListOf("%${ScriptureSearchRules.escapeLike(q)}%")
        val ot = BibleCatalog.OLD_TESTAMENT_MAX
        when (scope) {
            ScriptureSearchScope.CHAPTER -> { where += " AND book_id = ? AND chapter = ?"; args += chapterRef!!.bookId; args += chapterRef.chapter.toString() }
            ScriptureSearchScope.OLD -> where += " AND ($bookOrderSql) < $ot"
            ScriptureSearchScope.NEW -> where += " AND ($bookOrderSql) BETWEEN $ot AND ${BibleCatalog.all.size - 1}"
            ScriptureSearchScope.ALL -> {}
        }
        val total = db.rawQuery("SELECT COUNT(*) FROM verse WHERE $where", args.toTypedArray()).use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }
        if (total == 0) return ScriptureSearchResult.EMPTY
        val hits = ArrayList<ScriptureSearchHit>()
        db.rawQuery("SELECT book_id, chapter, verse, text FROM verse WHERE $where ORDER BY $bookOrderSql, chapter, verse LIMIT ${ScriptureSearchRules.LIMIT}", args.toTypedArray()).use { c ->
            while (c.moveToNext()) {
                val bookId = c.getString(0) ?: ""; val text = (c.getString(3) ?: "").trim()
                if (bookId.isEmpty() || text.isEmpty()) continue
                hits += ScriptureSearchHit(bookId, BibleCatalog.book(bookId)?.nameZh ?: bookId, c.getInt(1), c.getInt(2), text)
            }
        }
        return ScriptureSearchResult(hits, total)
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
