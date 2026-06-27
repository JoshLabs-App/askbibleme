package me.askbible.alarm

import android.content.Context

object ReadingAlarmPrefs {
  const val PREFS_NAME = "askbible_reading_alarm"
  const val KEY_ENABLED = "enabled"
  const val KEY_HOUR = "hour"
  const val KEY_MINUTE = "minute"
  const val KEY_WEEKDAYS = "weekdays"
  const val KEY_LABEL = "label"
  const val KEY_BOOK_ID = "book_id"
  const val KEY_CHAPTER = "chapter"
  const val KEY_BOOK_NAME = "book_name"
  const val KEY_TRANSLATION_ID = "translation_id"
  const val KEY_PENDING_AUTO_PLAY = "pending_auto_play"
  const val KEY_DISMISSED = "dismissed"
  const val KEY_PRELUDE_ACTIVE = "prelude_active"
  const val KEY_PRELUDE_STARTED_AT = "prelude_started_at"
  const val KEY_MODE = "mode"
  const val MODE_MUSIC = "music"
  const val MODE_SCRIPTURE = "scripture"

  fun setSchedule(
    context: Context,
    enabled: Boolean,
    hour: Int,
    minute: Int,
    weekdays: Set<Int>,
    label: String,
    bookId: String,
    chapter: Int,
    bookName: String,
    translationId: String,
    mode: String = MODE_SCRIPTURE,
  ) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_ENABLED, enabled)
      .putInt(KEY_HOUR, hour)
      .putInt(KEY_MINUTE, minute)
      .putStringSet(KEY_WEEKDAYS, weekdays.map { it.toString() }.toSet())
      .putString(KEY_LABEL, label)
      .putString(KEY_BOOK_ID, bookId)
      .putInt(KEY_CHAPTER, chapter)
      .putString(KEY_BOOK_NAME, bookName)
      .putString(KEY_TRANSLATION_ID, translationId)
      .putString(KEY_MODE, if (mode == MODE_MUSIC) MODE_MUSIC else MODE_SCRIPTURE)
      .apply()
  }

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

  fun hour(context: Context): Int =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getInt(KEY_HOUR, 8)

  fun minute(context: Context): Int =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getInt(KEY_MINUTE, 0)

  fun weekdays(context: Context): Set<Int> {
    val raw =
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getStringSet(KEY_WEEKDAYS, null)
    if (raw.isNullOrEmpty()) return setOf(1, 2, 3, 4, 5, 6, 7)
    val parsed = raw.mapNotNull { it.toIntOrNull() }.filter { it in 1..7 }.toSet()
    return parsed.ifEmpty { setOf(1, 2, 3, 4, 5, 6, 7) }
  }

  fun label(context: Context): String =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(KEY_LABEL, "") ?: ""

  fun bookId(context: Context): String =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(KEY_BOOK_ID, "") ?: ""

  fun chapter(context: Context): Int =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getInt(KEY_CHAPTER, 1)

  fun bookName(context: Context): String =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(KEY_BOOK_NAME, "") ?: ""

  fun translationId(context: Context): String =
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_TRANSLATION_ID, "cuv-simp") ?: "cuv-simp"

  fun setPendingAutoPlay(context: Context, pending: Boolean) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_PENDING_AUTO_PLAY, pending)
      .putBoolean(KEY_DISMISSED, false)
      .apply()
  }

  fun consumePendingAutoPlay(context: Context): Boolean {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val pending = prefs.getBoolean(KEY_PENDING_AUTO_PLAY, false)
    val dismissed = prefs.getBoolean(KEY_DISMISSED, false)
    if (!pending || dismissed) return false
    prefs.edit().putBoolean(KEY_PENDING_AUTO_PLAY, false).apply()
    return true
  }

  fun markDismissed(context: Context) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_PENDING_AUTO_PLAY, false)
      .putBoolean(KEY_DISMISSED, true)
      .apply()
  }

  fun setPreludeActive(context: Context, active: Boolean) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_PRELUDE_ACTIVE, active)
      .apply()
  }

  fun clearSessionForNewAlarm(context: Context) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_DISMISSED, false)
      .putBoolean(KEY_PENDING_AUTO_PLAY, false)
      .putBoolean(KEY_PRELUDE_ACTIVE, true)
      .putLong(KEY_PRELUDE_STARTED_AT, System.currentTimeMillis())
      .apply()
  }

  fun preludeStartedAt(context: Context): Long =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getLong(KEY_PRELUDE_STARTED_AT, 0L)

  fun readingReminderMode(context: Context): String {
    val raw =
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getString(KEY_MODE, MODE_SCRIPTURE)
        ?: MODE_SCRIPTURE
    return if (raw == MODE_MUSIC) MODE_MUSIC else MODE_SCRIPTURE
  }

  fun isMusicMode(context: Context): Boolean = readingReminderMode(context) == MODE_MUSIC

  fun isScriptureMode(context: Context): Boolean = !isMusicMode(context)

  fun isPreludeActive(context: Context): Boolean =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(KEY_PRELUDE_ACTIVE, false)

  fun peekPendingAutoPlay(context: Context): Boolean {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return prefs.getBoolean(KEY_PENDING_AUTO_PLAY, false) && !prefs.getBoolean(KEY_DISMISSED, false)
  }
}
