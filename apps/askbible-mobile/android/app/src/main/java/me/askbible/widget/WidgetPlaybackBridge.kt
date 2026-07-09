package me.askbible.widget

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import me.askbible.MainActivity
import me.askbible.playback.AskBibleShellMediaControlsModule
import me.askbible.playback.ShellPlaybackSession

/**
 * 桌面小挂件冷启动播放：写入 pending → 由用户点击挂件的 Activity PendingIntent 拉起 MainActivity
 * （Android 14+ 禁止 BroadcastReceiver 后台 startActivity）。
 */
object WidgetPlaybackBridge {
  private const val TAG = "WidgetPlaybackBridge"
  const val EXTRA_WIDGET_PLAYBACK = "askbible_widget_playback"
  /** reading / music */
  const val EXTRA_WIDGET_PLAYBACK_ACTION = "askbible_widget_playback_action"
  const val ACTION_READING = "reading"
  const val ACTION_MUSIC = "music"

  private const val PREFS_NAME = "askbible_widget_playback"
  private const val KEY_PENDING_ACTION = "pending_action"
  private const val KEY_MINIMIZE_AFTER = "minimize_after"
  private const val PENDING_TIMEOUT_MS = 60_000L

  private val handler = Handler(Looper.getMainLooper())
  private val watchDelaysMs =
    longArrayOf(500L, 1000L, 2000L, 3500L, 5000L, 8000L, 12_000L, 20_000L, 35_000L, 55_000L)

  fun widgetActionToBridgeAction(widgetAction: String): String? {
    return when (widgetAction) {
      AskBibleDailyVerseWidgetProvider.ACTION_TOGGLE_READING -> ACTION_READING
      AskBibleDailyVerseWidgetProvider.ACTION_TOGGLE_MUSIC -> ACTION_MUSIC
      ACTION_READING, ACTION_MUSIC -> widgetAction
      else -> null
    }
  }

  fun buildPlaybackActivityIntent(context: Context, bridgeAction: String): Intent {
    return Intent(context, MainActivity::class.java).apply {
      flags =
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_SINGLE_TOP or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
          Intent.FLAG_ACTIVITY_NO_ANIMATION
      putExtra(EXTRA_WIDGET_PLAYBACK, true)
      putExtra(EXTRA_WIDGET_PLAYBACK_ACTION, bridgeAction)
    }
  }

  /** 旧版 broadcast 回落：先起前台服务再允许拉起 Activity。 */
  fun requestViaForegroundService(context: Context, bridgeAction: String) {
    preparePending(context, bridgeAction)
    WidgetPlaybackLauncherService.start(context, bridgeAction)
  }

  fun preparePending(context: Context, bridgeAction: String) {
    val appContext = context.applicationContext
    Log.i(TAG, "preparePending action=$bridgeAction")
    val pendingUntil = System.currentTimeMillis() + PENDING_TIMEOUT_MS
    prefs(appContext)
      .edit()
      .putString(KEY_PENDING_ACTION, bridgeAction)
      .putLong("${KEY_PENDING_ACTION}_until", pendingUntil)
      .putBoolean(KEY_MINIMIZE_AFTER, true)
      .apply()
    scheduleWatch(appContext)
  }

  /** MainActivity 由用户点小挂件拉起后调用。 */
  fun handleActivityIntent(context: Context, intent: Intent?) {
    if (intent?.getBooleanExtra(EXTRA_WIDGET_PLAYBACK, false) != true) return
    val bridgeAction =
      intent.getStringExtra(EXTRA_WIDGET_PLAYBACK_ACTION)?.trim()?.ifEmpty { null } ?: return
    Log.i(TAG, "handleActivityIntent action=$bridgeAction active=${ShellPlaybackSession.active}")

    // 始终写入 pending，供 RN 挂载后轮询；进程已在播且 RN 就绪时再补一次 remote。
    preparePending(context, bridgeAction)

    if (ShellPlaybackSession.active) {
      val event = remoteEventFor(bridgeAction) ?: return
      if (AskBibleShellMediaControlsModule.tryEmitRemote(event)) {
        clearPendingAction(context.applicationContext)
        scheduleMinimizeIfNeeded(context.applicationContext)
      }
    }
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

  fun clearPendingAction(context: Context) {
    prefs(context.applicationContext)
      .edit()
      .remove(KEY_PENDING_ACTION)
      .remove("${KEY_PENDING_ACTION}_until")
      .apply()
  }

  private fun scheduleWatch(context: Context) {
    handler.removeCallbacksAndMessages(null)
    watchDelaysMs.forEach { delay ->
      handler.postDelayed({ watchPlayback(context) }, delay)
    }
    handler.postDelayed({ clearPendingAction(context.applicationContext) }, PENDING_TIMEOUT_MS)
  }

  private fun watchPlayback(context: Context) {
    val appContext = context.applicationContext
    if (peekPendingAction(appContext) == null) return
    if (ShellPlaybackSession.active && ShellPlaybackSession.playing) {
      Log.i(TAG, "playback started, clearing pending and minimizing")
      clearPendingAction(appContext)
      scheduleMinimizeIfNeeded(appContext)
    }
  }

  private fun scheduleMinimizeIfNeeded(context: Context) {
    if (!shouldMinimizeAfterPlayback(context)) return
    longArrayOf(200L, 600L, 1200L, 2000L, 3500L, 6000L).forEach { delay ->
      handler.postDelayed(
        {
          if (ShellPlaybackSession.active && ShellPlaybackSession.playing) {
            AskBibleShellMediaControlsModule.minimizeAppToBackground()
          }
        },
        delay,
      )
    }
  }

  private fun remoteEventFor(action: String): String? {
    return when (action) {
      ACTION_READING -> "RemoteReadingToggle"
      ACTION_MUSIC -> "RemoteMusicToggle"
      else -> null
    }
  }

  private fun rawPendingAction(context: Context): String? {
    return prefs(context).getString(KEY_PENDING_ACTION, null)?.trim()?.ifEmpty { null }
  }

  private fun shouldMinimizeAfterPlayback(context: Context): Boolean {
    val prefs = prefs(context)
    if (!prefs.getBoolean(KEY_MINIMIZE_AFTER, false)) return false
    prefs.edit().putBoolean(KEY_MINIMIZE_AFTER, false).apply()
    return true
  }

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
