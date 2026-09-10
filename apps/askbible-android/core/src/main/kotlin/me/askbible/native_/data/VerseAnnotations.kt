package me.askbible.native_.data

/**
 * 经文标注解码。与 iOS 的 `VerseAnnotations.swift` 是对等双写的两份实现，
 * 真源都是 RN 的 `src/bible/verse-annotations.ts`。三端一致由 fixture 对拍保证。
 *
 * speech_spans 是 `[[start, end, code]]` 的 JSON，code 1 = 神言、2 = 人言，
 * 落在 span 外的是 plain。
 */
enum class SpeechKind(val raw: String) {
    PLAIN("plain"), DIVINE("divine"), HUMAN("human")
}

data class SpeechPart(val kind: SpeechKind, val text: String)

object VerseAnnotations {
    /** 与 `lib/bible/golden-verse-theme-repeat.ts` 同步 */
    const val MIN_GOLDEN_THEME_REPEAT_COUNT = 3

    fun showsGoldenThemeMarker(themeRepeatCount: Int): Boolean =
        themeRepeatCount >= MIN_GOLDEN_THEME_REPEAT_COUNT

    private data class Span(val start: Int, val end: Int, val code: Int)

    /**
     * 解码并过滤：要求整数、start >= 0、end > start、code 为 1 或 2，其余丢弃。
     *
     * 不用 org.json：它是 Android 专有的，JVM 上跑不了同一份代码，
     * 对拍就没法脱离模拟器。span 的形状是固定的 `[[int,int,int],...]`，
     * 手写解析既没有依赖，两端行为也完全可控。
     * 任何不合形状的输入一律当作「无 span」，与 TS 侧 try/catch 后返回 [] 同义。
     */
    private fun decodeSpeechSpans(raw: String?): List<Span> {
        val s = raw?.trim().orEmpty()
        if (s.length < 2 || s[0] != '[' || s[s.length - 1] != ']') return emptyList()

        val out = ArrayList<Span>()
        var i = 1
        val end = s.length - 1
        while (i < end) {
            when (s[i]) {
                ' ', ',', '\t', '\n', '\r' -> { i++; continue }
                '[' -> {}
                else -> return emptyList()   // 元素不是数组：整体判为非法
            }
            val close = s.indexOf(']', i + 1)
            if (close < 0) return emptyList()
            val nums = s.substring(i + 1, close).split(',').map { it.trim() }
            i = close + 1
            if (nums.size < 3) continue      // 元素不足：跳过这一条，与 TS 的 row.length < 3 一致
            val a = nums[0].toIntStrict() ?: continue
            val b = nums[1].toIntStrict() ?: continue
            val c = nums[2].toIntStrict() ?: continue
            if (a < 0 || b <= a) continue
            if (c != 1 && c != 2) continue
            out.add(Span(a, b, c))
        }
        return out
    }

    /** 只接受整数字面量；"0.5" 这类小数要丢掉（TS 侧 Number.isInteger 同样拒绝） */
    private fun String.toIntStrict(): Int? {
        if (isEmpty()) return null
        var idx = 0
        if (this[0] == '-' || this[0] == '+') {
            if (length == 1) return null
            idx = 1
        }
        for (k in idx until length) if (!this[k].isDigit()) return null
        return toIntOrNull()
    }

    /**
     * 按 span 把整节切成若干段；没有有效 span 时返回 null（调用方按整节 plain 处理）。
     *
     * Kotlin 的 String 本来就是 UTF-16 序列，substring 的下标与 TS 的 slice 一致 ——
     * iOS 那边要显式绕到 utf16 视图才能对齐，这里天然一致。
     */
    fun speechParts(text: String, rawSpans: String?): List<SpeechPart>? {
        val spans = decodeSpeechSpans(rawSpans).sortedBy { it.start }
        if (spans.isEmpty()) return null

        val parts = ArrayList<SpeechPart>()
        var cursor = 0
        val len = text.length

        for (span in spans) {
            val s = minOf(span.start, len)
            val e = minOf(span.end, len)
            if (e <= s) continue
            if (s > cursor) parts.add(SpeechPart(SpeechKind.PLAIN, text.substring(cursor, s)))
            parts.add(SpeechPart(
                if (span.code == 1) SpeechKind.DIVINE else SpeechKind.HUMAN,
                text.substring(s, e)
            ))
            cursor = e
        }
        if (cursor < len) parts.add(SpeechPart(SpeechKind.PLAIN, text.substring(cursor)))
        return parts.ifEmpty { null }
    }
}
