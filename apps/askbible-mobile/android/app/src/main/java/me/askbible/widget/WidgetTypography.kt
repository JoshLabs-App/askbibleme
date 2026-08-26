package me.askbible.widget

object WidgetTypography {
  enum class TextScale(val raw: String) {
    AUTO("auto"),
    COMFORTABLE("comfortable"),
    COMPACT("compact"),
  }

  data class Resolved(
    val verseFontSp: Float,
    val refFontSp: Float,
    val maxLines: Int,
  )

  fun parseTextScale(raw: String?): TextScale {
    return when (raw?.trim()?.lowercase()) {
      "comfortable" -> TextScale.COMFORTABLE
      "compact" -> TextScale.COMPACT
      else -> TextScale.AUTO
    }
  }

  fun isSmallWidget(minWidthDp: Int): Boolean = minWidthDp < 180

  fun resolve(
    verseLine: String,
    isSmallWidget: Boolean,
    textScale: TextScale,
  ): Resolved {
    // 字号固定：小挂件 18 / 4 行；中号 19.5 / 6 行。超长截断，不随字数缩放。
    // textScale 仅作全局偏好微调（±1），不再按经文字数变字号。
    val baseVerse = if (isSmallWidget) 18f else 19.5f
    val verseFont =
      when (textScale) {
        TextScale.COMFORTABLE -> baseVerse + 1f
        TextScale.COMPACT -> baseVerse - 1f
        TextScale.AUTO -> baseVerse
      }
    val maxLines = if (isSmallWidget) 4 else 6

    return Resolved(
      verseFontSp = verseFont,
      refFontSp = if (isSmallWidget) 13.5f else 14.5f,
      maxLines = maxLines,
    )
  }
}
