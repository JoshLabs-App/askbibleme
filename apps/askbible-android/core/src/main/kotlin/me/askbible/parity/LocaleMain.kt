package me.askbible.parity

import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.ReadChrome
import me.askbible.native_.data.ReadDisplayLocale
import me.askbible.native_.data.ZhTw
import me.askbible.native_.data.name

/** 语言展示规则对拍 harness（core --locale），协议与 Swift 侧相同 */
fun localeMain() {
    val lines = generateSequence(::readLine).filter { it.isNotEmpty() }.toList()
    fun loc(tag: String) = AppLocale.entries.firstOrNull { it.tag == tag } ?: AppLocale.EN
    val out = ArrayList<String>()
    for (line in lines) {
        val f = line.split("\t")
        out.add(when (f[0]) {
            "tag" -> AppLocale.fromLanguageTag(f.getOrElse(1) { "" }).tag
            "display" -> ReadDisplayLocale.resolve(loc(f[1]), f.getOrNull(2)?.takeIf { it.isNotEmpty() }).tag
            "chrome" -> ReadDisplayLocale.chrome(loc(f[1]), f.getOrNull(2)?.takeIf { it.isNotEmpty() }).tag
            "zhtw" -> ZhTw.convert(f.getOrElse(1) { "" })
            "book" -> BibleCatalog.book(f[1])?.name(loc(f[2])) ?: f[1]
            "title" -> ReadChrome.chapterTitle(f[1], f[2].toIntOrNull() ?: 0, loc(f[3]))
            "label" -> ReadChrome.chapterLabel(f[1].toIntOrNull() ?: 0, loc(f[2]))
            else -> "skip"
        })
    }
    print("[" + out.joinToString(",") { jsonString(it) } + "]")
}
