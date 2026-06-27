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
    val chars = verseLine.trim().length
    var verseFont =
      when {
        isSmallWidget && chars <= 22 -> 17.5f
        isSmallWidget && chars <= 40 -> 16f
        isSmallWidget && chars <= 60 -> 15f
        isSmallWidget -> 14f
        chars <= 34 -> 18.5f
        chars <= 56 -> 17f
        chars <= 84 -> 15.5f
        else -> 14.5f
      }

    verseFont =
      when (textScale) {
        TextScale.COMFORTABLE -> minOf(if (isSmallWidget) 18f else 19.5f, verseFont + 1f)
        TextScale.COMPACT -> maxOf(13f, verseFont - 1f)
        TextScale.AUTO -> verseFont
      }

    val maxLines =
      when {
        isSmallWidget && chars > 56 -> 6
        isSmallWidget -> 5
        chars > 84 -> 7
        else -> 6
      }

    return Resolved(
      verseFontSp = verseFont,
      refFontSp = if (isSmallWidget) 11.5f else 12.5f,
      maxLines = maxLines,
    )
  }
}
