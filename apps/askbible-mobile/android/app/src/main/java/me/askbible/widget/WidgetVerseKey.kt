package me.askbible.widget

import android.net.Uri

object WidgetVerseKey {
  data class Parsed(val bookId: String, val chapter: Int, val verse: Int)

  fun parse(key: String): Parsed? {
    val s = key.trim().uppercase()
    val match = Regex("^([A-Z0-9]{2,8})\\.(\\d+)\\.(\\d+)$").find(s) ?: return null
    val chapter = match.groupValues[2].toIntOrNull() ?: return null
    val verse = match.groupValues[3].toIntOrNull() ?: return null
    if (chapter < 1 || verse < 1) return null
    return Parsed(match.groupValues[1], chapter, verse)
  }

  fun readChapterUri(verseKey: String): Uri? {
    val parsed = parse(verseKey) ?: return null
    return Uri.parse("askbible://read/${parsed.bookId}/${parsed.chapter}?verse=${parsed.verse}")
  }
}
