package me.askbible.widget

import android.os.Build
import android.text.Layout
import android.widget.RemoteViews

object WidgetVerseDisplay {
  /** 方角引号（非弯引号 “ ”） */
  const val OPEN_QUOTE = "\u300C"
  const val CLOSE_QUOTE = "\u300D"

  private val QUOTE_TRIM_CHARS = charArrayOf(
    '\u201C', '\u201D', '"', '"', '「', '」', '『', '』',
  )

  fun stripExistingQuotes(line: String): String {
    return line.trim().trim(*QUOTE_TRIM_CHARS).trim()
  }

  fun isChineseLocale(locale: String?): Boolean {
    return locale?.trim()?.lowercase()?.startsWith("zh") == true
  }

  fun prepareVerseText(line: String): String = stripExistingQuotes(line)

  /** 中文经文两端对齐（字间拉伸），由系统自动换行。 */
  fun applyChineseJustification(views: RemoteViews, textViewId: Int, locale: String?) {
    if (!isChineseLocale(locale)) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      views.setInt(textViewId, "setJustificationMode", Layout.JUSTIFICATION_MODE_INTER_CHARACTER)
    }
  }

  /** 小挂件只展示主语言经文：取首条非空行，忽略对照译本。 */
  fun joinVerseLines(lines: org.json.JSONArray?): String {
    if (lines == null || lines.length() == 0) return ""
    for (i in 0 until lines.length()) {
      val part = lines.optString(i).trim()
      if (part.isNotEmpty()) return part
    }
    return ""
  }
}
