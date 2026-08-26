package me.askbible.widget

import android.content.Context

object WidgetRotationState {
  private const val PREFS_NAME = "askbible_widget_rotation"
  private const val KEY_ANCHOR_INDEX = "anchor_index"
  private const val KEY_ANCHOR_MS = "anchor_ms"
  private const val KEY_ROTATION_POOL = "rotation_pool"
  private const val KEY_LAST_RENDERED_INDEX = "last_rendered_index"
  private const val KEY_FLIPPER_CHILD = "flipper_child"
  /** App 金句朗读跟随时：钉住当前 verseKey，并可选冻结墙钟轮换。 */
  private const val KEY_FOLLOW_VERSE_KEY = "follow_verse_key"
  private const val KEY_FOLLOW_FROZEN = "follow_frozen"
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

  fun isFollowFrozen(context: Context): Boolean {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getBoolean(KEY_FOLLOW_FROZEN, false)
  }

  fun followVerseKey(context: Context): String? {
    return context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_FOLLOW_VERSE_KEY, null)
      ?.trim()
      ?.uppercase()
      ?.ifEmpty { null }
  }

  /**
   * App 当前展示/播放的金句：钉到挂件索引。
   * freeze=true：朗读中钉住并停墙钟；freeze=false：把锚点落到该句后恢复墙钟轮换。
   */
  fun followAppVerse(
    context: Context,
    verseKey: String?,
    verseKeys: List<String>,
    freeze: Boolean,
  ) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val key = verseKey?.trim()?.uppercase().orEmpty()
    if (key.isEmpty() || verseKeys.isEmpty()) {
      prefs.edit().putBoolean(KEY_FOLLOW_FROZEN, false).remove(KEY_FOLLOW_VERSE_KEY).apply()
      return
    }
    val idx =
      verseKeys
        .indexOfFirst { it.trim().uppercase() == key }
        .let { if (it >= 0) it else 0 }
    val now = System.currentTimeMillis()
    val editor =
      prefs
        .edit()
        .putInt(KEY_ANCHOR_INDEX, idx)
        .putLong(KEY_ANCHOR_MS, now)
        .putBoolean(KEY_FOLLOW_FROZEN, freeze)
    if (freeze) {
      editor.putString(KEY_FOLLOW_VERSE_KEY, key)
    } else {
      editor.remove(KEY_FOLLOW_VERSE_KEY)
    }
    editor.apply()
  }

  fun clearFollowFreeze(context: Context) {
    context
      .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(KEY_FOLLOW_FROZEN, false)
      .remove(KEY_FOLLOW_VERSE_KEY)
      .apply()
  }

  fun currentIndex(context: Context, verseCount: Int, atMs: Long = System.currentTimeMillis()): Int {
    if (verseCount <= 0) return 0
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val anchorIndex = prefs.getInt(KEY_ANCHOR_INDEX, 0)
    if (prefs.getBoolean(KEY_FOLLOW_FROZEN, false)) {
      return ((anchorIndex % verseCount) + verseCount) % verseCount
    }
    val anchorMs = prefs.getLong(KEY_ANCHOR_MS, atMs)
    val elapsed = (atMs - anchorMs).coerceAtLeast(0)
    val steps = (elapsed / rotationIntervalMs(context)).toInt()
    val idx = anchorIndex + steps
    return ((idx % verseCount) + verseCount) % verseCount
  }

  /** 优先按 follow verseKey 取下标（仅朗读冻结时）；找不到再走墙钟 / 冻结锚点。 */
  fun currentIndexForVerses(
    context: Context,
    verseKeys: List<String>,
    atMs: Long = System.currentTimeMillis(),
  ): Int {
    if (verseKeys.isEmpty()) return 0
    if (isFollowFrozen(context)) {
      val follow = followVerseKey(context)
      if (!follow.isNullOrBlank()) {
        val found = verseKeys.indexOfFirst { it.trim().uppercase() == follow }
        if (found >= 0) return found
      }
    }
    return currentIndex(context, verseKeys.size, atMs)
  }

  fun advanceOnTap(context: Context, verseCount: Int) {
    if (verseCount <= 0) return
    // 朗读跟随时勿被挂件点按打乱 App 当前句。
    if (isFollowFrozen(context)) return
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
