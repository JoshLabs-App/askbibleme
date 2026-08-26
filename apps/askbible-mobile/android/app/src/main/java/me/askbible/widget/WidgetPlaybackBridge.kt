package me.askbible.widget

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import me.askbible.MainActivity
import me.askbible.playback.AskBibleShellMediaControlsModule
import me.askbible.playback.ShellPlaybackSession
import java.lang.ref.WeakReference

/**
 * 桌面小挂件冷启动播放：写入 pending → 由用户点击挂件的 Activity PendingIntent 拉起 MainActivity
 * （Android 14+ 禁止 BroadcastReceiver 后台 startActivity）。
 */
object WidgetPlaybackBridge {
  private const val TAG = "WidgetPlaybackBridge"
  const val EXTRA_WIDGET_PLAYBACK = "askbible_widget_playback"
  /** reading / music / verse */
  const val EXTRA_WIDGET_PLAYBACK_ACTION = "askbible_widget_playback_action"
  const val EXTRA_WIDGET_VERSE_KEY = "askbible_widget_verse_key"
  const val ACTION_READING = "reading"
  const val ACTION_MUSIC = "music"
  const val ACTION_VERSE = "verse"

  private const val PREFS_NAME = "askbible_widget_playback"
  private const val KEY_PENDING_ACTION = "pending_action"
  private const val KEY_PENDING_VERSE_KEY = "pending_verse_key"
  private const val KEY_MINIMIZE_AFTER = "minimize_after"
  private const val PENDING_TIMEOUT_MS = 60_000L

  private val handler = Handler(Looper.getMainLooper())
  private val watchDelaysMs =
    longArrayOf(500L, 1000L, 2000L, 3500L, 5000L, 8000L, 12_000L, 20_000L, 35_000L, 55_000L)
  private val minimizeDelaysMs =
    longArrayOf(50L, 200L, 500L, 900L, 1500L, 2500L, 4000L, 7000L, 12_000L)
  private val watchRunnables = ArrayList<Runnable>()
  private val minimizeRunnables = ArrayList<Runnable>()
  private var pendingTimeoutRunnable: Runnable? = null
  @Volatile private var activityForMinimize: WeakReference<Activity>? = null

  fun widgetActionToBridgeAction(widgetAction: String): String? {
    return when (widgetAction) {
      "me.askbible.widget.ACTION_TOGGLE_READING" -> ACTION_READING
      "me.askbible.widget.ACTION_TOGGLE_MUSIC" -> ACTION_MUSIC
      "me.askbible.widget.ACTION_TOGGLE_VERSE" -> ACTION_VERSE
      ACTION_READING, ACTION_MUSIC, ACTION_VERSE -> widgetAction
      else -> null
    }
  }

  fun buildPlaybackActivityIntent(
    context: Context,
    bridgeAction: String,
    verseKey: String? = null,
  ): Intent {
    return Intent(context, MainActivity::class.java).apply {
      flags =
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
          Intent.FLAG_ACTIVITY_NO_ANIMATION
      putExtra(EXTRA_WIDGET_PLAYBACK, true)
      putExtra(EXTRA_WIDGET_PLAYBACK_ACTION, bridgeAction)
      if (!verseKey.isNullOrBlank()) {
        putExtra(EXTRA_WIDGET_VERSE_KEY, verseKey.trim())
      }
    }
  }

  /** 旧版 broadcast 回落：先起前台服务再允许拉起 Activity。 */
  fun requestViaForegroundService(
    context: Context,
    bridgeAction: String,
    verseKey: String? = null,
  ) {
    preparePending(context, bridgeAction, verseKey)
    WidgetPlaybackLauncherService.start(context, bridgeAction)
  }

  fun preparePending(context: Context, bridgeAction: String, verseKey: String? = null) {
    val appContext = context.applicationContext
    Log.i(TAG, "preparePending action=$bridgeAction verseKey=${verseKey ?: ""}")
    val pendingUntil = System.currentTimeMillis() + PENDING_TIMEOUT_MS
    val editor =
      prefs(appContext)
        .edit()
        .putString(KEY_PENDING_ACTION, bridgeAction)
        .putLong("${KEY_PENDING_ACTION}_until", pendingUntil)
        .putBoolean(KEY_MINIMIZE_AFTER, true)
    if (!verseKey.isNullOrBlank()) {
      editor.putString(KEY_PENDING_VERSE_KEY, verseKey.trim())
    } else if (bridgeAction != ACTION_VERSE) {
      editor.remove(KEY_PENDING_VERSE_KEY)
    }
    editor.apply()
    scheduleWatch(appContext)
  }

  /** MainActivity 由用户点小挂件拉起后调用。 */
  fun handleActivityIntent(context: Context, intent: Intent?) {
    if (intent?.getBooleanExtra(EXTRA_WIDGET_PLAYBACK, false) != true) return
    val bridgeAction =
      intent.getStringExtra(EXTRA_WIDGET_PLAYBACK_ACTION)?.trim()?.ifEmpty { null } ?: return
    val verseKey = intent.getStringExtra(EXTRA_WIDGET_VERSE_KEY)?.trim()?.ifEmpty { null }
    Log.i(TAG, "handleActivityIntent action=$bridgeAction active=${ShellPlaybackSession.active}")

    if (context is Activity) {
      activityForMinimize = WeakReference(context)
    }

    // 始终写入 pending，供 RN 挂载后轮询；进程已在播且 RN 就绪时再补一次 remote。
    preparePending(context, bridgeAction, verseKey)
    val pendingVerseKey = verseKey ?: peekPendingVerseKey(context.applicationContext)

    // 冷启动必须短暂拉起 Activity；立刻安排回桌面，尽量不让用户停留在 App。
    scheduleReturnToHome(context.applicationContext)

    if (ShellPlaybackSession.active || bridgeAction == ACTION_VERSE) {
      val event = remoteEventFor(bridgeAction) ?: return
      val payload =
        if (bridgeAction == ACTION_VERSE && !pendingVerseKey.isNullOrBlank()) {
          pendingVerseKey
        } else {
          null
        }
      if (AskBibleShellMediaControlsModule.tryEmitRemote(event, payload)) {
        clearPendingAction(context.applicationContext)
      }
    }
  }

  /** 挂件冷启动后反复尝试回桌面（金句/读经都不依赖前台 UI）。 */
  fun scheduleReturnToHome(context: Context) {
    val appContext = context.applicationContext
    prefs(appContext).edit().putBoolean(KEY_MINIMIZE_AFTER, true).apply()
    clearMinimizeCallbacks()
    minimizeDelaysMs.forEachIndexed { index, delay ->
      val isLast = index == minimizeDelaysMs.lastIndex
      val runnable = Runnable { tryMinimizeToHome(appContext, forceClear = isLast) }
      minimizeRunnables.add(runnable)
      handler.postDelayed(runnable, delay)
    }
  }

  /** JS 侧播放就绪后也可触发一次回桌面。 */
  fun requestMinimizeNow(context: Context) {
    prefs(context.applicationContext).edit().putBoolean(KEY_MINIMIZE_AFTER, true).apply()
    tryMinimizeToHome(context.applicationContext)
  }

  fun onMainActivityReady(context: Context) {
    scheduleWatch(context.applicationContext)
  }

  fun peekPendingAction(context: Context): String? {
    val appContext = context.applicationContext
    val action = rawPendingAction(appContext) ?: return null
    val until = prefs(appContext).getLong("${KEY_PENDING_ACTION}_until", 0L)
    if (until > 0L && System.currentTimeMillis() >= until) {
      clearPendingAction(appContext)
      return null
    }
    return action
  }

  fun peekPendingVerseKey(context: Context): String? {
    return prefs(context.applicationContext)
      .getString(KEY_PENDING_VERSE_KEY, null)
      ?.trim()
      ?.ifEmpty { null }
  }

  fun clearPendingAction(context: Context) {
    prefs(context.applicationContext)
      .edit()
      .remove(KEY_PENDING_ACTION)
      .remove("${KEY_PENDING_ACTION}_until")
      .remove(KEY_PENDING_VERSE_KEY)
      .apply()
  }

  private fun scheduleWatch(context: Context) {
    // 只清 watch，不要清 minimize（否则冷启动回桌面会被冲掉）。
    clearWatchCallbacks()
    val appContext = context.applicationContext
    watchDelaysMs.forEach { delay ->
      val runnable = Runnable { watchPlayback(appContext) }
      watchRunnables.add(runnable)
      handler.postDelayed(runnable, delay)
    }
    val timeout =
      Runnable {
        clearPendingAction(appContext)
      }
    pendingTimeoutRunnable = timeout
    handler.postDelayed(timeout, PENDING_TIMEOUT_MS)
  }

  private fun clearWatchCallbacks() {
    watchRunnables.forEach { handler.removeCallbacks(it) }
    watchRunnables.clear()
    pendingTimeoutRunnable?.let { handler.removeCallbacks(it) }
    pendingTimeoutRunnable = null
  }

  private fun clearMinimizeCallbacks() {
    minimizeRunnables.forEach { handler.removeCallbacks(it) }
    minimizeRunnables.clear()
  }

  private fun watchPlayback(context: Context) {
    val appContext = context.applicationContext
    val pending = peekPendingAction(appContext) ?: return
    if (pending == ACTION_VERSE) {
      // 金句由 RN 辅助播放器负责；成功后由 JS clearPending。仍持续尝试回桌面。
      tryMinimizeToHome(appContext)
      return
    }
    if (ShellPlaybackSession.active && ShellPlaybackSession.playing) {
      Log.i(TAG, "playback started, clearing pending and minimizing")
      clearPendingAction(appContext)
      tryMinimizeToHome(appContext)
    }
  }

  private fun tryMinimizeToHome(context: Context, forceClear: Boolean = false) {
    if (!prefs(context).getBoolean(KEY_MINIMIZE_AFTER, false)) return
    Log.i(TAG, "tryMinimizeToHome forceClear=$forceClear")
    var moved = false
    try {
      val activity = activityForMinimize?.get()
      if (activity != null && !activity.isFinishing) {
        moved = activity.moveTaskToBack(true)
      }
    } catch (_: Exception) {
      /* ignore */
    }
    AskBibleShellMediaControlsModule.minimizeAppToBackground()
    // 成功退后台后停止重试；最后一次也清掉，避免之后误伤用户主动打开 App。
    if (moved || forceClear) {
      prefs(context).edit().putBoolean(KEY_MINIMIZE_AFTER, false).apply()
      clearMinimizeCallbacks()
    }
  }

  private fun remoteEventFor(action: String): String? {
    return when (action) {
      ACTION_READING -> "RemoteReadingToggle"
      ACTION_MUSIC -> "RemoteMusicToggle"
      ACTION_VERSE -> "RemoteVerseToggle"
      else -> null
    }
  }

  private fun rawPendingAction(context: Context): String? {
    return prefs(context).getString(KEY_PENDING_ACTION, null)?.trim()?.ifEmpty { null }
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
