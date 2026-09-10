package me.askbible.native_.data

import org.json.JSONArray
import org.json.JSONObject

/**
 * 译本偏好的落盘格式，与 RN `read-bible-translation-prefs.ts` 同键同形（与 iOS 的 TranslationPrefsRules 对等）：
 * `selah_read_bible_translation_v1` = {"version":1,"primaryTranslationId":…,"contrastTranslationIds":[…],"audioTranslationId":null}
 * 原生只接一路对照译本：读回取 contrastTranslationIds 里第一个合法且 ≠ 主译本的 id（老字段 contrastTranslationId 也认），写回也只写一项。
 * audioTranslationId 原生不用，恒写 null（= 朗读随主译本）。
 */
object TranslationPrefsRules {
    const val KEY = "selah_read_bible_translation_v1"

    data class Stored(val primaryId: String, val secondaryId: String?)

    /** raw 为空 / 非 JSON / version ≠ 1 / 主译本不在内置表 → 默认主译本、无对照 */
    fun parse(raw: String?, allowed: List<String>, defaultId: String): Stored {
        val fallback = Stored(defaultId, null)
        val text = raw?.trim().orEmpty()
        if (text.isEmpty()) return fallback
        val j = try { JSONObject(text) } catch (_: Exception) { return fallback }
        // RN 是 `j.version !== 1`：布尔 true / 字符串 "1" 都不算（org.json optInt 会把 "1" 转成 1，不能用）
        val version = j.opt("version")
        if (version !is Number || version.toDouble() != 1.0) return fallback
        val rawPrimary = j.opt("primaryTranslationId")
        val primary = (rawPrimary as? String)?.trim()?.takeIf { it.isNotEmpty() && it in allowed } ?: defaultId
        // RN：`j.contrastTranslationIds ?? j.contrastTranslationId` —— 前者缺失或 null 才看老字段；数组逐项，字符串当单项
        var contrast = j.opt("contrastTranslationIds")
        if (contrast == null || contrast == JSONObject.NULL) contrast = j.opt("contrastTranslationId")
        val candidates: List<String> = when (contrast) {
            is JSONArray -> List(contrast.length()) { i -> (contrast.opt(i) as? String)?.trim().orEmpty() }
            is String -> listOf(contrast.trim())
            else -> emptyList()
        }
        val secondary = candidates.firstOrNull { it.isNotEmpty() && it != primary && it in allowed }
        return Stored(primary, secondary)
    }

    /** 与 RN `JSON.stringify(normalized)` 逐字节相同的键序 */
    fun serialize(primaryId: String, secondaryId: String?): String {
        val contrast = if (secondaryId != null && secondaryId != primaryId) "[" + JSONObject.quote(secondaryId) + "]" else "[]"
        return "{\"version\":1,\"primaryTranslationId\":" + JSONObject.quote(primaryId) +
            ",\"contrastTranslationIds\":" + contrast + ",\"audioTranslationId\":null}"
    }
}
