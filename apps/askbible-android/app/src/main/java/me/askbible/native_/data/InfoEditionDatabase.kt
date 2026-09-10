package me.askbible.native_.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject

/**
 * 「读后两版」内容库：陪你探索（guide，发现版 V2）/ 查找资料（info，讲解版 V1）。
 * 数据是 RN 同一份 assets/content/info-edition.sqlite（4761 行，按「书卷:章:角色」取一行），
 * 由 tools/gen-info-edition.mjs 复制进 assets（noCompress 保证不压缩，先拷到 filesDir 再开）。
 * 查找顺序照搬 RN bundled-info-edition.ts：先「书卷:章:角色」精确取，取不到再退回旧式「书卷:章」并校验角色。
 * 与 iOS 的 InfoEditionDatabase 对等。
 */
data class InfoEditionChapter(
    val bookId: String, val chapter: Int, val roleId: String, val roleLabel: String,
    val markdown: String, val publishedAt: String,
)

class InfoEditionDatabase private constructor(private val db: SQLiteDatabase) {
    companion object {
        const val INFO_ROLE_ID = "info_edition_v1"
        const val INFO_EN_ROLE_ID = "info_edition_v1_en"
        const val GUIDE_ROLE_ID = "role_356f0ffb"
        const val GUIDE_EN_ROLE_ID = "role_guide_v2_en"
        val GUIDE_LABEL_ALIASES = setOf("发现版V2", "引导版V2", "引导版", "Study Guide V2 EN", "Guide V2 EN")

        @Volatile private var shared: InfoEditionDatabase? = null

        fun open(context: Context): InfoEditionDatabase? {
            shared?.let { return it }
            val file = ScriptureDatabase.ensureOnDisk(context, "info-edition.sqlite") ?: return null
            return try {
                InfoEditionDatabase(SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY)).also { shared = it }
            } catch (_: Exception) { null }
        }

        /** 讲解 / 发现两版都有中英两套角色（库里 info_edition_v1 / info_edition_v1_en、role_356f0ffb / role_guide_v2_en） */
        fun roleId(variant: InfoEditionVariant, english: Boolean = false) =
            if (variant == InfoEditionVariant.GUIDE) (if (english) GUIDE_EN_ROLE_ID else GUIDE_ROLE_ID)
            else (if (english) INFO_EN_ROLE_ID else INFO_ROLE_ID)

        fun roleMatches(ch: InfoEditionChapter, target: String, variant: InfoEditionVariant): Boolean {
            if (ch.roleId == target) return true
            val label = ch.roleLabel.trim()
            return if (variant == InfoEditionVariant.INFO)
                ch.roleId == INFO_ROLE_ID || ch.roleId == INFO_EN_ROLE_ID || label.startsWith("基础版") || label.startsWith("讲解版")
            else ch.roleId == GUIDE_ROLE_ID || ch.roleId == GUIDE_EN_ROLE_ID || label in GUIDE_LABEL_ALIASES
        }
    }

    fun chapter(bookId: String, chapter: Int, variant: InfoEditionVariant, english: Boolean = false): InfoEditionChapter? {
        val book = bookId.trim().uppercase()
        val target = roleId(variant, english)
        query("$book:$chapter:$target")?.takeIf { it.markdown.isNotBlank() }?.let { return it }
        // 要的那套语言没有这一章就退回另一套（英文库比中文库少几章）
        query("$book:$chapter:${roleId(variant, !english)}")?.takeIf { it.markdown.isNotBlank() }?.let { return it }
        val legacy = query("$book:$chapter") ?: return null
        return if (legacy.markdown.isNotBlank() && roleMatches(legacy, target, variant)) legacy else null
    }

    private fun query(key: String): InfoEditionChapter? =
        db.rawQuery("SELECT payload FROM chapter WHERE key = ? LIMIT 1", arrayOf(key)).use { c ->
            if (!c.moveToFirst()) return null
            val o = runCatching { JSONObject(c.getString(0)) }.getOrNull() ?: return null
            InfoEditionChapter(
                bookId = o.optString("bookId"), chapter = o.optInt("chapter"), roleId = o.optString("roleId"),
                roleLabel = o.optString("roleLabel"), markdown = o.optString("markdown"), publishedAt = o.optString("publishedAt"),
            )
        }
}
