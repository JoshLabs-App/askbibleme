package me.askbible.parity

import java.io.File
import me.askbible.native_.data.InfoEditionFormat
import me.askbible.native_.data.InfoEditionVariant

/** 读后两版归一化对拍 harness（core --info-edition <用例文件>），协议与 Swift 侧相同（记录以「换行 + U+001E + 换行」分隔） */
fun infoEditionMain(path: String) {
    val raw = File(path).readText()
    val cases = raw.split("\n\n").filter { it.isNotEmpty() }
    val sb = StringBuilder("[")
    for ((i, c) in cases.withIndex()) {
        if (i > 0) sb.append(',')
        val nl = c.indexOf('\n')
        val variant = if (nl >= 0) c.substring(0, nl) else c
        val markdown = if (nl >= 0) c.substring(nl + 1) else ""
        val text = InfoEditionFormat.readerText(markdown, if (variant == "info") InfoEditionVariant.INFO else InfoEditionVariant.GUIDE)
        val (h, b) = InfoEditionFormat.splitPrimaryHeading(text)
        sb.append("{\"h\":").append(if (h == null) "null" else jsonString(h)).append(",\"b\":").append(jsonString(b)).append('}')
    }
    sb.append(']')
    print(sb)
}
