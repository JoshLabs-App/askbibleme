package me.askbible.alarm

import android.content.Context
import me.askbible.widget.AskBibleDailyVerseWidgetProvider

data class ReadingAlarmVerse(
  val text: String,
  val ref: String,
)

/** 音乐闹钟全屏：优先用排程时写入的今日金句，没有再读挂件快照。 */
object ReadingAlarmDailyVerse {
  fun load(context: Context): ReadingAlarmVerse? {
    val stored = ReadingAlarmPrefs.verseText(context).trim()
    if (stored.isNotEmpty()) {
      return ReadingAlarmVerse(stored, ReadingAlarmPrefs.verseRef(context).trim())
    }
    val snapshot = AskBibleDailyVerseWidgetProvider.firstSnapshotVerse(context) ?: return null
    if (snapshot.first.isBlank()) return null
    return ReadingAlarmVerse(snapshot.first.trim(), snapshot.second.trim())
  }
}
