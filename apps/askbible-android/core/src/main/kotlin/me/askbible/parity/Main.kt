package me.askbible.parity

import me.askbible.native_.data.VerseAnnotations

/**
 * 对拍 harness：从 stdin 读 [{text, spans, themeRepeatCount}]，
 * 输出切分与金句判定，交给 tools/verse-annotation-parity.mjs 比对。
 *
 * 手写最小 JSON 读写 —— core 刻意零依赖，跑的就是 App 里那份逻辑。
 * 输入由对拍脚本生成，形状固定，只需支持它用到的转义。
 */
fun main(args: Array<String>) {
    when (args.firstOrNull()) {
        "--audio" -> return audioMain()
        "--timing" -> return timingMain()
        "--music" -> return musicMain()
        "--golden" -> return goldenMain()
        "--ambient" -> return ambientMain()
        "--plans" -> return plansMain()
        "--info-edition" -> return infoEditionMain(args[1])
        "--scripture-search" -> return scriptureSearchMain()
        "--locale" -> return localeMain()
        "--musicvis" -> return musicVisualsMain()
        "--memberauth" -> return memberAuthMain()
        "--membersync" -> return memberSyncMain()
    }
    val input = generateSequence(::readLine).joinToString("\n")
    val cases = parseCases(input)
    val sb = StringBuilder("[")
    for ((i, c) in cases.withIndex()) {
        if (i > 0) sb.append(',')
        val parts = VerseAnnotations.speechParts(c.text, c.spans)
        val golden = VerseAnnotations.showsGoldenThemeMarker(c.themeRepeatCount)
        sb.append("{\"isGolden\":").append(golden).append(",\"parts\":")
        if (parts == null) {
            sb.append("null")
        } else {
            sb.append('[')
            for ((j, p) in parts.withIndex()) {
                if (j > 0) sb.append(',')
                sb.append("{\"kind\":\"").append(p.kind.raw).append("\",\"text\":")
                    .append(jsonString(p.text)).append('}')
            }
            sb.append(']')
        }
        sb.append('}')
    }
    sb.append(']')
    println(sb)
}

private data class Case(val text: String, val spans: String, val themeRepeatCount: Int)

private fun parseCases(json: String): List<Case> {
    val out = ArrayList<Case>()
    var i = 0
    while (i < json.length) {
        val objStart = json.indexOf('{', i)
        if (objStart < 0) break
        val objEnd = findObjectEnd(json, objStart)
        if (objEnd < 0) break
        val obj = json.substring(objStart, objEnd + 1)
        out.add(
            Case(
                text = readStringField(obj, "text") ?: "",
                spans = readStringField(obj, "spans") ?: "",
                themeRepeatCount = readIntField(obj, "themeRepeatCount") ?: 0,
            )
        )
        i = objEnd + 1
    }
    return out
}

private fun findObjectEnd(s: String, start: Int): Int {
    var depth = 0
    var i = start
    var inStr = false
    var esc = false
    while (i < s.length) {
        val c = s[i]
        if (inStr) {
            when {
                esc -> esc = false
                c == '\\' -> esc = true
                c == '"' -> inStr = false
            }
        } else when (c) {
            '"' -> inStr = true
            '{' -> depth++
            '}' -> {
                depth--
                if (depth == 0) return i
            }
        }
        i++
    }
    return -1
}

private fun readStringField(obj: String, name: String): String? {
    val key = "\"" + name + "\""
    val k = obj.indexOf(key)
    if (k < 0) return null
    var i = obj.indexOf(':', k + key.length)
    if (i < 0) return null
    i++
    while (i < obj.length && obj[i].isWhitespace()) i++
    if (i >= obj.length || obj[i] != '"') return null
    i++
    val sb = StringBuilder()
    while (i < obj.length) {
        val c = obj[i]
        if (c == '\\') {
            i++
            val e = obj.getOrNull(i) ?: return sb.toString()
            when (e) {
                'n' -> sb.append('\n')
                't' -> sb.append('\t')
                'r' -> sb.append('\r')
                'u' -> {
                    sb.append(obj.substring(i + 1, i + 5).toInt(16).toChar())
                    i += 4
                }
                else -> sb.append(e)
            }
        } else if (c == '"') {
            return sb.toString()
        } else {
            sb.append(c)
        }
        i++
    }
    return sb.toString()
}

private fun readIntField(obj: String, name: String): Int? {
    val key = "\"" + name + "\""
    val k = obj.indexOf(key)
    if (k < 0) return null
    var i = obj.indexOf(':', k + key.length)
    if (i < 0) return null
    i++
    while (i < obj.length && obj[i].isWhitespace()) i++
    val sb = StringBuilder()
    while (i < obj.length && (obj[i].isDigit() || obj[i] == '-')) {
        sb.append(obj[i])
        i++
    }
    return sb.toString().toIntOrNull()
}

/** 非 ASCII 与孤立代理项统一转成 uXXXX 转义，避免管道上的编码差异 */
internal fun jsonString(s: String): String {
    val sb = StringBuilder("\"")
    for (c in s) {
        when {
            c == '"' -> sb.append("\\\"")
            c == '\\' -> sb.append("\\\\")
            c == '\n' -> sb.append("\\n")
            c == '\r' -> sb.append("\\r")
            c == '\t' -> sb.append("\\t")
            c.code < 0x20 || c.code > 0x7E -> sb.append(String.format("\\u%04x", c.code))
            else -> sb.append(c)
        }
    }
    return sb.append('"').toString()
}
