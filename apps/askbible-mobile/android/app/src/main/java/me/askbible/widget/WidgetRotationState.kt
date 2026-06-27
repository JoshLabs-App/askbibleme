package me.askbible.widget

import android.content.Context

object WidgetRotationState {
  private const val PREFS_NAME = "askbible_widget_rotation"
  private const val KEY_ANCHOR_INDEX = "anchor_index"
  private const val KEY_ANCHOR_MS = "anchor_ms"
  private const val KEY_ROTATION_POOL = "rotation_pool"
  private const val KEY_LAST_RENDERED_INDEX = "last_rendered_index"
  private const val KEY_FLIPPER_CHILD = "flipper_child"
  private const val DEFAULT_ROTATION_INTERVAL_SEC = 10
  private const val MIN_ROTATION_INTERVAL_SEC = 3
  private const val MAX_ROTATION_INTERVAL_SEC = 60

  fun rotationIntervalMs(context: Context): Long {
    val sec =
      context
        .getSharedPreferences(AskBibleWidgetPrefsModule.PREFS_NAME, Context.MODE_PRIVATE)
        .getInt(AskBibleWidgetPrefsModule.ROTATION_INTERVAL_SEC_KEY, DEFAULT_ROTATION_INTERVAL_SEC)
        .coerceIn(MIN_ROTATION_INTERVAL_SEC, MAX_ROTATION_INTERVAL_SEC)
    return sec * 1000L
  }

  fun setRotationIntervalSec(context: Context, sec: Int) {
    val clamped = sec.coerceIn(MIN_ROTATION_INTERVAL_SEC, MAX_ROTATION_INTERVAL_SEC)
    context
      .getSharedPreferences(AskBibleWidgetPrefsModule.PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putInt(AskBibleWidgetPrefsModule.ROTATION_INTERVAL_SEC_KEY, clamped)
      .apply()
  }

  fun syncRotationPool(context: Context, poolKey: String) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val stored = prefs.getString(KEY_ROTATION_POOL, null)
    if (stored != poolKey) {
      prefs
        .edit()
        .putString(KEY_ROTATION_POOL, poolKey)
        .putInt(KEY_ANCHOR_INDEX, 0)
        .putLong(KEY_ANCHOR_MS, System.currentTimeMillis())
        .putInt(KEY_LAST_RENDERED_INDEX, -1)
        .putInt(KEY_FLIPPER_CHILD, 0)
        .apply()
    }
  }

  fun lastRenderedIndex(context: Context): Int {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getInt(KEY_LAST_RENDERED_INDEX, -1)
  }

  fun flipperChild(context: Context): Int {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getInt(KEY_FLIPPER_CHILD, 0)
      .coerceIn(0, 1)
  }

  fun markRendered(context: Context, verseIndex: Int, flipperChild: Int) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putInt(KEY_LAST_RENDERED_INDEX, verseIndex)
      .putInt(KEY_FLIPPER_CHILD, flipperChild.coerceIn(0, 1))
      .apply()
  }

  fun currentIndex(context: Context, verseCount: Int, atMs: Long = System.currentTimeMillis()): Int {
    if (verseCount <= 0) return 0
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val anchorIndex = prefs.getInt(KEY_ANCHOR_INDEX, 0)
    val anchorMs = prefs.getLong(KEY_ANCHOR_MS, atMs)
    val elapsed = (atMs - anchorMs).coerceAtLeast(0)
    val steps = (elapsed / rotationIntervalMs(context)).toInt()
    val idx = anchorIndex + steps
    return ((idx % verseCount) + verseCount) % verseCount
  }

  fun advanceOnTap(context: Context, verseCount: Int) {
    if (verseCount <= 0) return
    val now = System.currentTimeMillis()
    val current = currentIndex(context, verseCount, now)
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putInt(KEY_ANCHOR_INDEX, (current + 1) % verseCount)
      .putLong(KEY_ANCHOR_MS, now)
      .apply()
  }
}
