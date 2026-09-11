package me.askbible.native_.audio

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import me.askbible.native_.data.ScriptureDatabase
import me.askbible.native_.data.VerseTiming
import me.askbible.native_.data.VerseTimingLookup

/**
 * 跟读时间轴的 SQLite 查询。定位算法在 core 的 VerseTimingLookup（已三端对拍），
 * 这里只负责取数 —— 与 iOS 的 VerseTimingDatabase 对等。
 */
class VerseTimingDatabase private constructor(private val db: SQLiteDatabase) {
    companion object {
        fun open(context: Context): VerseTimingDatabase? {
            val file = ScriptureDatabase.ensureOnDisk(context, "verse-timings.sqlite") ?: return null
            return try {
                VerseTimingDatabase(
                    SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY))
            } catch (_: Exception) {
                null
            }
        }
    }

    /** cuv-v20 缺章时回退 cuv-simp，与 TS 侧同 */
    fun timings(translationId: String, bookId: String, chapter: Int): List<VerseTiming> {
        val primary = VerseTimingLookup.scopeFor(translationId) ?: return emptyList()
        val rows = query(primary, bookId, chapter)
        if (rows.isNotEmpty()) return rows
        return if (primary == "cuv-v20") query("cuv-simp", bookId, chapter) else emptyList()
    }

    private fun query(scope: String, bookId: String, chapter: Int): List<VerseTiming> {
        val sql = """
            SELECT verse, start_sec, end_sec FROM timing
            WHERE scope = ? AND book_id = ? AND chapter = ? ORDER BY verse ASC
        """.trimIndent()
        return db.rawQuery(sql, arrayOf(scope, bookId.uppercase(), chapter.toString())).use { c ->
            val out = ArrayList<VerseTiming>(c.count)
            while (c.moveToNext()) {
                out.add(VerseTiming(c.getInt(0), c.getDouble(1), c.getDouble(2)))
            }
            out
        }
    }

    fun close() = db.close()
}
