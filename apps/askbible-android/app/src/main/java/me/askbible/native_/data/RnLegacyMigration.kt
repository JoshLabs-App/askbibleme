package me.askbible.native_.data

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import org.json.JSONObject

/**
 * RN 版 → 原生版 本机数据一次性迁移（Josh 2026-09-14 定：先迁移再推 Play 正式版）。
 *
 * 同包名 me.askbible 覆盖更新后，RN 的 AsyncStorage 仍留在 databases/RKStorage（表 catalystLocalStorage）。
 * RN 存盘的 JSON 与会员同步 blob 的 value 同形，所以直接拼成 blobs 交给 [MemberReadingSyncEngine.applyBlobs]，
 * 不另写一套解析。只迁读经进度类数据；RN 的登录态是自家 sessionToken、原生用 Supabase refreshToken，不迁，需重新登录一次。
 * 只读不删 RKStorage，留作兜底。
 */
object RnLegacyMigration {
    private const val TAG = "RnLegacyMigration"
    private const val DONE_KEY = "rn-legacy-migration-v1-done"

    /** blob key → RN AsyncStorage 键（新键在前，旧 selah- 键兜底） */
    private val KEY_MAP: List<Pair<String, List<String>>> = listOf(
        "bookmarks" to listOf("askbible-scripture-verse-bookmarks-v1", "selah-scripture-verse-bookmarks-v1"),
        "highlights" to listOf("askbible-read-verse-text-highlights-v1"),
        "lastPosition" to listOf("askbible-mobile-read-last-v1"),
        "chapterCompletion" to listOf("askbible-read-chapter-completion-v1", "selah-read-chapter-completion-v1"),
        "readingPlanPrefs" to listOf("askbible-reading-plan-prefs-v1", "selah-reading-plan-prefs-v1"),
        "tripleLoopProgress" to listOf("askbible-triple-loop-progress-v1", "selah-triple-loop-progress-v1"),
        "ntDeepRepeatProgress" to listOf(
            "askbible-nt-deep-repeat-progress-v5", "askbible-nt-deep-repeat-progress-v4", "askbible-nt-deep-repeat-progress-v3",
        ),
        "habitStats" to listOf("askbible-reading-habit-stats-v1", "selah-reading-habit-stats-v1"),
        "scriptureListenTotals" to listOf("askbible-scripture-listen-totals-v1"),
        "recentSearches" to listOf("askbible-mobile-scripture-recent-searches-v1"),
    )

    fun runOnce(context: Context, engine: MemberReadingSyncEngine) {
        val sp = context.applicationContext.getSharedPreferences("member-reading-sync", Context.MODE_PRIVATE)
        if (sp.getBoolean(DONE_KEY, false)) return
        try {
            val raw = readRkStorage(context)
            if (raw.isNotEmpty()) {
                val blobs = buildBlobs(raw)
                if (blobs.length() > 0) {
                    engine.applyBlobs(blobs)
                    Log.i(TAG, "migrated ${blobs.length()} blobs: ${blobs.keys().asSequence().toList()}")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "migration failed", e)
        }
        // 失败也只试一次：坏数据反复崩启动比丢游客数据更糟
        sp.edit().putBoolean(DONE_KEY, true).apply()
    }

    internal fun buildBlobs(raw: Map<String, String>): JSONObject {
        val now = MemberReadingSyncRules.isoString(System.currentTimeMillis().toDouble())
        val blobs = JSONObject()
        for ((blobKey, rnKeys) in KEY_MAP) {
            val text = rnKeys.firstNotNullOfOrNull { k -> raw[k]?.takeIf { it.isNotBlank() } } ?: continue
            val value = try { JSONObject(text) } catch (_: Exception) { continue }
            if (value.length() == 0) continue
            blobs.put(blobKey, JSONObject().put("updatedAt", now).put("value", value))
        }
        return blobs
    }

    private fun readRkStorage(context: Context): Map<String, String> {
        val file = context.getDatabasePath("RKStorage")
        if (!file.exists()) return emptyMap()
        val wanted = KEY_MAP.flatMap { it.second }
        val out = HashMap<String, String>()
        SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY).use { db ->
            val placeholders = wanted.joinToString(",") { "?" }
            db.rawQuery("SELECT key, value FROM catalystLocalStorage WHERE key IN ($placeholders)", wanted.toTypedArray()).use { c ->
                while (c.moveToNext()) {
                    val k = c.getString(0) ?: continue
                    val v = c.getString(1) ?: continue
                    out[k] = v
                }
            }
        }
        return out
    }
}
