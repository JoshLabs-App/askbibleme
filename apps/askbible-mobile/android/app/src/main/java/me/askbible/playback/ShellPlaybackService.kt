package me.askbible.playback

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.view.Display
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import me.askbible.MainActivity
import me.askbible.R
import me.askbible.widget.WidgetPlaybackBridge

/** 壳层音乐 / 读经朗读：前台服务 + MediaSession，保证后台与锁屏控制。 */
class ShellPlaybackService : Service() {
  private var mediaSession: MediaSessionCompat? = null
  private val handler = Handler(Looper.getMainLooper())
  private var lastScreenOffAtElapsed = 0L
  private var pendingUserPause: Runnable? = null
  private var displayManager: DisplayManager? = null
  private val displayListener =
    object : DisplayManager.DisplayListener {
      override fun onDisplayAdded(displayId: Int) {}

      override fun onDisplayRemoved(displayId: Int) {}

      override fun onDisplayChanged(displayId: Int) {
        if (!isScreenInteractive()) onScreenTurnedOff()
      }
    }
  private val screenOffReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == Intent.ACTION_SCREEN_OFF) onScreenTurnedOff()
      }
    }
  private val refreshRunnable =
    object : Runnable {
      override fun run() {
        if (!ShellPlaybackSession.active) return
        publishSessionState()
        handler.postDelayed(this, 1000L)
      }
    }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    ShellCallAudioMonitor.start(this)
    ensureChannel()
    mediaSession =
      MediaSessionCompat(this, TAG).apply {
        setCallback(
          object : MediaSessionCompat.Callback() {
            override fun onPlay() {
              android.util.Log.i(TAG, "MediaSession onPlay -> RemotePlay")
              applyUserPlay()
              AskBibleShellMediaControlsModule.emitRemote("RemotePlay")
            }

            override fun onPause() {
              if (isCallInterrupted()) {
                android.util.Log.i(TAG, "MediaSession onPause ignored (phone call)")
                applySystemInterruptPause()
                return
              }
              if (shouldIgnoreStartPlaybackOemPause()) {
                android.util.Log.i(TAG, "MediaSession onPause ignored (start-play OEM window)")
                keepPlayingAfterOemFalsePause()
                return
              }
              if (shouldIgnoreOemScreenOffPause()) {
                android.util.Log.i(TAG, "MediaSession onPause ignored (OEM screen-off window)")
                keepPlayingAfterOemFalsePause()
                return
              }
              // 三星常在 SCREEN_OFF 之前误发 Pause；仅屏灭时 defer，屏亮点停立即生效。
              if (isSessionAudible() && !isScreenInteractive()) {
                android.util.Log.i(TAG, "MediaSession onPause deferred (screen off, confirm OEM)")
                scheduleConfirmUserPause()
                return
              }
              android.util.Log.i(TAG, "MediaSession onPause -> RemotePause")
              applyUserPause()
              AskBibleShellMediaControlsModule.emitRemote("RemotePause", "user")
            }

            override fun onStop() {
              if (shouldIgnoreOemMediaTeardown()) {
                android.util.Log.i(TAG, "MediaSession onStop ignored (OEM screen-off window)")
                keepPlayingAfterOemFalsePause()
                return
              }
              android.util.Log.i(TAG, "MediaSession onStop -> user dismiss")
              handleUserDismiss()
            }

            override fun onSkipToNext() {
              // 仅金句占栏时推进金句；音乐+金句垫底时运输键切音乐曲。
              val verseNext =
                !ShellPlaybackSession.userPaused && ShellPlaybackSession.kind == "verse"
              if (verseNext) {
                android.util.Log.i(TAG, "MediaSession onSkipToNext -> VerseAdvance")
                AskBibleShellMediaControlsModule.emitRemote("ShellMediaNativeVerseAdvance")
                return
              }
              ShellPlaybackSession.userPaused = false
              android.util.Log.i(TAG, "MediaSession onSkipToNext -> RemoteNext")
              AskBibleShellMediaControlsModule.emitRemote("RemoteNext")
            }

            override fun onSkipToPrevious() {
              val versePrev =
                !ShellPlaybackSession.userPaused && ShellPlaybackSession.kind == "verse"
              if (versePrev) {
                android.util.Log.i(TAG, "MediaSession onSkipToPrevious -> VerseRestart")
                AskBibleShellMediaControlsModule.emitRemote("ShellMediaNativeVerseRestart")
                return
              }
              ShellPlaybackSession.userPaused = false
              android.util.Log.i(TAG, "MediaSession onSkipToPrevious -> RemotePrevious")
              AskBibleShellMediaControlsModule.emitRemote("RemotePrevious")
            }
          },
        )
        isActive = true
      }
    registerScreenOffReceiver()
    registerDisplayListener()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // 无论走哪条分支，都必须先满足前台服务契约（startForegroundService 后须尽快 startForeground），
    // 否则系统会抛 ForegroundServiceDidNotStartInTimeException 直接杀掉进程。
    if (!ensureForeground()) {
      stopForegroundSafely()
      stopSelf()
      return START_NOT_STICKY
    }

    android.util.Log.i(
      TAG,
      "onStartCommand action=${intent?.action} active=${ShellPlaybackSession.active} playing=${ShellPlaybackSession.playing} title=${ShellPlaybackSession.title}",
    )
    when (intent?.action) {
      ACTION_DISMISS -> {
        if (shouldIgnoreOemMediaTeardown()) {
          android.util.Log.i(TAG, "ACTION_DISMISS ignored (OEM screen-off window)")
          keepPlayingAfterOemFalsePause()
          return START_STICKY
        }
        android.util.Log.i(TAG, "ACTION_DISMISS -> user dismiss")
        handleUserDismiss()
        return START_NOT_STICKY
      }
      ACTION_STOP -> {
        android.util.Log.i(TAG, "ACTION_STOP -> stopPlaybackSession")
        stopPlaybackSession()
        return START_NOT_STICKY
      }
      ACTION_REMOTE_TOGGLE -> {
        android.util.Log.i(TAG, "ACTION_REMOTE_TOGGLE -> user play/pause")
        if (isCallInterrupted()) {
          applySystemInterruptPause()
          return START_STICKY
        }
        if (isSessionAudible() && !ShellPlaybackSession.userPaused) {
          applyUserPause()
          AskBibleShellMediaControlsModule.emitRemote("RemotePause", "user")
        } else {
          applyUserPlay()
          AskBibleShellMediaControlsModule.emitRemote("RemotePlay")
        }
        if (!ShellPlaybackSession.active) {
          stopPlaybackSession()
          return START_NOT_STICKY
        }
        publishSessionState()
        return START_STICKY
      }
      ACTION_REMOTE_READING_TOGGLE -> {
        android.util.Log.i(TAG, "ACTION_REMOTE_READING_TOGGLE -> try RemoteReadingToggle")
        if (!AskBibleShellMediaControlsModule.tryEmitRemote("RemoteReadingToggle")) {
          android.util.Log.i(TAG, "ACTION_REMOTE_READING_TOGGLE -> fallback widget bridge")
          WidgetPlaybackBridge.requestViaForegroundService(this, WidgetPlaybackBridge.ACTION_READING)
          return START_STICKY
        }
        if (!ShellPlaybackSession.active) {
          stopPlaybackSession()
          return START_NOT_STICKY
        }
        publishSessionState()
        return START_STICKY
      }
      ACTION_REMOTE_MUSIC_TOGGLE -> {
        android.util.Log.i(TAG, "ACTION_REMOTE_MUSIC_TOGGLE -> try RemoteMusicToggle")
        if (!AskBibleShellMediaControlsModule.tryEmitRemote("RemoteMusicToggle")) {
          android.util.Log.i(TAG, "ACTION_REMOTE_MUSIC_TOGGLE -> fallback widget bridge")
          WidgetPlaybackBridge.requestViaForegroundService(this, WidgetPlaybackBridge.ACTION_MUSIC)
          return START_STICKY
        }
        if (!ShellPlaybackSession.active) {
          stopPlaybackSession()
          return START_NOT_STICKY
        }
        publishSessionState()
        return START_STICKY
      }
      ACTION_REMOTE_VERSE_TOGGLE -> {
        val verseKey = intent?.getStringExtra(EXTRA_VERSE_KEY)?.trim().orEmpty()
        android.util.Log.i(TAG, "ACTION_REMOTE_VERSE_TOGGLE verseKey=$verseKey")
        if (!verseKey.isEmpty()) {
          WidgetPlaybackBridge.preparePending(this, WidgetPlaybackBridge.ACTION_VERSE, verseKey)
        }
        val payload = verseKey.ifEmpty { null }
        if (!AskBibleShellMediaControlsModule.tryEmitRemote("RemoteVerseToggle", payload)) {
          WidgetPlaybackBridge.requestViaForegroundService(
            this,
            WidgetPlaybackBridge.ACTION_VERSE,
            verseKey.ifEmpty { null },
          )
          return START_STICKY
        }
        publishSessionState()
        return START_STICKY
      }
      ACTION_REMOTE_NEXT -> {
        android.util.Log.i(TAG, "ACTION_REMOTE_NEXT")
        val verseNext =
          !ShellPlaybackSession.userPaused && ShellPlaybackSession.kind == "verse"
        if (verseNext) {
          AskBibleShellMediaControlsModule.emitRemote("ShellMediaNativeVerseAdvance")
        } else {
          ShellPlaybackSession.userPaused = false
          AskBibleShellMediaControlsModule.emitRemote("RemoteNext")
        }
        if (!ShellPlaybackSession.active) {
          stopPlaybackSession()
          return START_NOT_STICKY
        }
        publishSessionState()
        return START_STICKY
      }
      ACTION_REMOTE_PREVIOUS -> {
        android.util.Log.i(TAG, "ACTION_REMOTE_PREVIOUS")
        val versePrev =
          !ShellPlaybackSession.userPaused && ShellPlaybackSession.kind == "verse"
        if (versePrev) {
          AskBibleShellMediaControlsModule.emitRemote("ShellMediaNativeVerseRestart")
        } else {
          ShellPlaybackSession.userPaused = false
          AskBibleShellMediaControlsModule.emitRemote("RemotePrevious")
        }
        if (!ShellPlaybackSession.active) {
          stopPlaybackSession()
          return START_NOT_STICKY
        }
        publishSessionState()
        return START_STICKY
      }
    }

    if (!ShellPlaybackSession.active) {
      stopPlaybackSession()
      return START_NOT_STICKY
    }

    publishSessionState()
    ShellVerseNativePlayer.syncFromSession(this)
    ShellMainNativePlayer.syncFromSession(this)
    handler.removeCallbacks(refreshRunnable)
    handler.post(refreshRunnable)
    return START_STICKY
  }

  /** 立即进入前台（即使会话为空也先挂一个最小通知），满足 FGS 契约；失败返回 false。 */
  private fun ensureForeground(): Boolean {
    val session = mediaSession ?: return false
    return try {
      val notification = buildNotification(session.sessionToken)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
        )
      } else {
        @Suppress("DEPRECATION")
        startForeground(NOTIFICATION_ID, notification)
      }
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun stopForegroundSafely() {
    try {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } catch (_: Exception) {
      /* ignore */
    }
  }

  override fun onDestroy() {
    handler.removeCallbacks(refreshRunnable)
    cancelPendingUserPause()
    unregisterScreenOffReceiver()
    unregisterDisplayListener()
    ShellCallAudioMonitor.stop(this)
    mediaSession?.isActive = false
    mediaSession?.release()
    mediaSession = null
    super.onDestroy()
  }

  private fun isSessionAudible(): Boolean {
    if (ShellPlaybackSession.userPaused) return false
    return ShellPlaybackSession.playing || ShellPlaybackSession.verseUnderlayPlaying
  }

  private fun isScreenInteractive(): Boolean {
    val pm = getSystemService(PowerManager::class.java) ?: return true
    if (!pm.isInteractive) return false
    val display = displayManager?.getDisplay(Display.DEFAULT_DISPLAY) ?: return true
    return display.state != Display.STATE_OFF &&
      display.state != Display.STATE_DOZE &&
      display.state != Display.STATE_DOZE_SUSPEND
  }

  private fun onScreenTurnedOff() {
    lastScreenOffAtElapsed = SystemClock.elapsedRealtime()
    val hadPendingPause = pendingUserPause != null
    cancelPendingUserPause()
    // 只丢掉「关屏前尚未落地」的误 Pause；用户已经点停的不要因为关屏又续上。
    if (hadPendingPause && ShellPlaybackSession.active) publishSessionState()
  }

  private fun isInOemScreenOffWindow(): Boolean {
    if (!isScreenInteractive() && lastScreenOffAtElapsed <= 0L) {
      lastScreenOffAtElapsed = SystemClock.elapsedRealtime()
    }
    if (lastScreenOffAtElapsed <= 0L) return false
    val dt = SystemClock.elapsedRealtime() - lastScreenOffAtElapsed
    return dt in 0L..OEM_SCREEN_OFF_PAUSE_MS
  }

  private fun shouldIgnoreOemScreenOffPause(): Boolean {
    return isInOemScreenOffWindow() && isSessionAudible()
  }

  /** 三星在开播瞬间常误发 Pause；屏亮时 deferred confirm 会把刚点的读经/音乐掐掉。 */
  private fun shouldIgnoreStartPlaybackOemPause(): Boolean {
    // 章朗读要先缓冲：还没 start 时 session 也可能被标成 playing，2.5s 窗口不够。
    if (ShellMainNativePlayer.isPreparing()) return true
    val started = ShellPlaybackSession.lastUserPlayAtElapsed
    if (started <= 0L) return false
    val dt = SystemClock.elapsedRealtime() - started
    if (dt !in 0L..OEM_START_PLAY_PAUSE_MS) return false
    // 屏亮 = 用户在前台点系统栏停/播：必须当真，勿当开播误发 Pause。
    if (isScreenInteractive()) return false
  // 不要求 isSessionAudible：开播瞬间 playing 未置位，或刚被误 Pause 清掉时，
  // 仍须丢掉 OEM Pause，否则首按音乐只响约 1 秒、UI 仍显示播放却无声。
    return true
  }

  private fun shouldIgnoreOemMediaTeardown(): Boolean {
    return isInOemScreenOffWindow() && ShellPlaybackSession.active
  }

  private fun cancelPendingUserPause() {
    pendingUserPause?.let { handler.removeCallbacks(it) }
    pendingUserPause = null
  }

  private fun scheduleConfirmUserPause() {
    cancelPendingUserPause()
    val runnable = Runnable {
      pendingUserPause = null
      if (isCallInterrupted()) return@Runnable
      if (shouldIgnoreStartPlaybackOemPause() || shouldIgnoreOemScreenOffPause()) {
        android.util.Log.i(TAG, "deferred MediaSession onPause ignored (OEM start/screen-off)")
        keepPlayingAfterOemFalsePause()
        return@Runnable
      }
      android.util.Log.i(TAG, "deferred MediaSession onPause -> RemotePause")
      applyUserPause()
      AskBibleShellMediaControlsModule.emitRemote("RemotePause", "user")
    }
    pendingUserPause = runnable
    handler.postDelayed(runnable, OEM_SCREEN_OFF_PAUSE_CONFIRM_MS)
  }

  private fun keepPlayingAfterOemFalsePause() {
    ShellPlaybackSession.userPaused = false
    if (ShellPlaybackSession.kind == "verse" && !ShellPlaybackSession.assetUri.isNullOrBlank()) {
      ShellPlaybackSession.playing = true
    }
    if (
      (ShellPlaybackSession.kind == "verse" && ShellPlaybackSession.playing) ||
        ShellPlaybackSession.verseUnderlayPlaying
    ) {
      ShellVerseNativePlayer.resume(this)
    }
    if (
      (ShellPlaybackSession.kind == "music" || ShellPlaybackSession.kind == "scripture") &&
        !ShellPlaybackSession.userPaused
    ) {
      ShellPlaybackSession.playing = true
      ShellMainNativePlayer.resume(this)
    }
    publishSessionState()
  }

  private fun applyUserPause() {
    ShellPlaybackSession.userPaused = true
    ShellPlaybackSession.playing = false
    // 勿清 verseUnderlayPlaying：否则 Play 只能恢复主轨，音乐+金句会丢金句。
    ShellVerseNativePlayer.pause()
    ShellMainNativePlayer.pause()
    publishSessionState()
  }

  private fun applySystemInterruptPause() {
    ShellVerseNativePlayer.pause()
    ShellMainNativePlayer.pause()
    publishSessionState()
  }

  private fun isCallInterrupted(): Boolean {
    ShellCallAudioMonitor.clearStaleInterruptIfIdle(this)
    return ShellPlaybackSession.systemInterrupted || ShellCallAudioMonitor.isCallLikeNow(this)
  }

  private fun applyUserPlay() {
    ShellCallAudioMonitor.clearStaleInterruptIfIdle(this)
    ShellPlaybackSession.userPaused = false
    ShellPlaybackSession.lastUserPlayAtElapsed = SystemClock.elapsedRealtime()
    cancelPendingUserPause()
    if (ShellPlaybackSession.kind == "verse" && !ShellPlaybackSession.assetUri.isNullOrBlank()) {
      ShellPlaybackSession.playing = true
      ShellVerseNativePlayer.resume(this)
      publishSessionState()
      return
    }
    if (
      (ShellPlaybackSession.kind == "music" || ShellPlaybackSession.kind == "scripture") &&
        !ShellPlaybackSession.assetUri.isNullOrBlank()
    ) {
      ShellPlaybackSession.playing = true
      ShellMainNativePlayer.resume(this)
      if (
        ShellPlaybackSession.verseUnderlayPlaying &&
          !ShellPlaybackSession.verseUnderlayUri.isNullOrBlank()
      ) {
        ShellVerseNativePlayer.resume(this)
      }
      publishSessionState()
    }
  }

  private fun registerScreenOffReceiver() {
    val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        // SCREEN_OFF 是系统广播；部分三星机型 NOT_EXPORTED 收不到，关屏窗口失效。
        registerReceiver(screenOffReceiver, filter, Context.RECEIVER_EXPORTED)
      } else {
        registerReceiver(screenOffReceiver, filter)
      }
    } catch (_: Exception) {
      /* ignore */
    }
  }

  private fun registerDisplayListener() {
    displayManager = getSystemService(DisplayManager::class.java)
    try {
      displayManager?.registerDisplayListener(displayListener, handler)
    } catch (_: Exception) {
      /* ignore */
    }
  }

  private fun unregisterDisplayListener() {
    try {
      displayManager?.unregisterDisplayListener(displayListener)
    } catch (_: Exception) {
      /* ignore */
    }
    displayManager = null
  }

  private fun unregisterScreenOffReceiver() {
    try {
      unregisterReceiver(screenOffReceiver)
    } catch (_: Exception) {
      /* ignore */
    }
  }

  private fun publishSessionState() {
    if (!ShellPlaybackSession.active) {
      stopPlaybackSession()
      return
    }

    ShellVerseNativePlayer.syncFromSession(this)
    ShellMainNativePlayer.syncFromSession(this)

    val session = mediaSession ?: return
    val durationMs = (ShellPlaybackSession.durationSec * 1000).toLong().coerceAtLeast(0L)
    val positionMs = (ShellPlaybackSession.positionSec * 1000).toLong().coerceAtLeast(0L)
    val state =
      if (ShellPlaybackSession.playing) PlaybackStateCompat.STATE_PLAYING
      else PlaybackStateCompat.STATE_PAUSED

    val metadataBuilder =
      MediaMetadataCompat.Builder()
        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, ShellPlaybackSession.title)
        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, ShellPlaybackSession.artist)
        .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, ShellPlaybackSession.album)
    if (durationMs > 0L) {
      metadataBuilder.putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)
    }
    ShellPlaybackSession.loadArtworkBitmap()?.let { bitmap ->
      metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
    }
    session.setMetadata(metadataBuilder.build())
    session.setPlaybackState(
      PlaybackStateCompat.Builder()
        .setActions(
          PlaybackStateCompat.ACTION_PLAY or
            PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_PLAY_PAUSE or
            PlaybackStateCompat.ACTION_STOP or
            PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
            PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS,
        )
        .setState(
          state,
          positionMs,
          if (ShellPlaybackSession.playing) ShellPlaybackSession.rate else 0f,
        )
        .build(),
    )

    val notification = buildNotification(session.sessionToken)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
        )
      } else {
        @Suppress("DEPRECATION")
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Exception) {
      /* 通知权限缺失时仍尝试维持 MediaSession */
    }
  }

  private fun buildNotification(sessionToken: MediaSessionCompat.Token): Notification {
    val openApp =
      PendingIntent.getActivity(
        this,
        9200,
        Intent(this, MainActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    val toggleIntent =
      PendingIntent.getService(
        this,
        9201,
        Intent(this, ShellPlaybackService::class.java).apply { action = ACTION_REMOTE_TOGGLE },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    val prevIntent =
      PendingIntent.getService(
        this,
        9202,
        Intent(this, ShellPlaybackService::class.java).apply { action = ACTION_REMOTE_PREVIOUS },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    val nextIntent =
      PendingIntent.getService(
        this,
        9203,
        Intent(this, ShellPlaybackService::class.java).apply { action = ACTION_REMOTE_NEXT },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    val dismissIntent =
      PendingIntent.getService(
        this,
        9204,
        Intent(this, ShellPlaybackService::class.java).apply { action = ACTION_DISMISS },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    val playPauseLabel =
      if (ShellPlaybackSession.playing) {
        getString(R.string.shell_playback_pause)
      } else {
        getString(R.string.shell_playback_play)
      }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(ShellPlaybackSession.title.ifBlank { getString(R.string.app_name) })
      .setContentText(ShellPlaybackSession.artist)
      .setSubText(ShellPlaybackSession.album.takeIf { it.isNotBlank() })
      .setContentIntent(openApp)
      .setDeleteIntent(dismissIntent)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      // 播放中保持 ongoing，避免三星等机型关屏时清掉媒体通知并触发 dismiss 停播。
      // 暂停后可划掉；划掉由 ACTION_DISMISS 停播且不再自动弹出。
      .setOngoing(ShellPlaybackSession.playing)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .addAction(0, getString(R.string.shell_playback_previous), prevIntent)
      .addAction(0, playPauseLabel, toggleIntent)
      .addAction(0, getString(R.string.shell_playback_next), nextIntent)
      .setStyle(
        MediaStyle()
          .setMediaSession(sessionToken)
          .setShowActionsInCompactView(0, 1, 2)
          .setCancelButtonIntent(dismissIntent)
          .setShowCancelButton(true),
      )
      .build()
  }

  /** 用户划掉 / 关闭系统媒体控件：通知 JS 停播，并拆除前台服务。 */
  private fun handleUserDismiss() {
    AskBibleShellMediaControlsModule.emitRemote("RemoteStop")
    stopPlaybackSession()
  }

  private fun stopPlaybackSession() {
    handler.removeCallbacks(refreshRunnable)
    ShellVerseNativePlayer.stop()
    ShellMainNativePlayer.stop()
    ShellPlaybackSession.clear()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        getString(R.string.shell_playback_channel_name),
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = getString(R.string.shell_playback_channel_desc)
        setSound(null, null)
        enableVibration(false)
      },
    )
  }

  companion object {
    const val TAG = "ShellPlaybackService"
    const val CHANNEL_ID = "shell-playback-service"
    const val NOTIFICATION_ID = 9202
    const val ACTION_STOP = "me.askbible.playback.STOP"
    const val ACTION_DISMISS = "me.askbible.playback.DISMISS"
    const val ACTION_REFRESH = "me.askbible.playback.REFRESH"
    const val ACTION_REMOTE_TOGGLE = "me.askbible.playback.REMOTE_TOGGLE"
    const val ACTION_REMOTE_READING_TOGGLE = "me.askbible.playback.REMOTE_READING_TOGGLE"
    const val ACTION_REMOTE_MUSIC_TOGGLE = "me.askbible.playback.REMOTE_MUSIC_TOGGLE"
    const val ACTION_REMOTE_VERSE_TOGGLE = "me.askbible.playback.REMOTE_VERSE_TOGGLE"
    const val EXTRA_VERSE_KEY = "askbible_widget_verse_key"
    const val ACTION_REMOTE_NEXT = "me.askbible.playback.REMOTE_NEXT"
    const val ACTION_REMOTE_PREVIOUS = "me.askbible.playback.REMOTE_PREVIOUS"
    private const val OEM_SCREEN_OFF_PAUSE_MS = 4000L
    private const val OEM_SCREEN_OFF_PAUSE_CONFIRM_MS = 500L
    /** 读经常要缓冲；三星开播后数秒内仍会误发 Pause。 */
    private const val OEM_START_PLAY_PAUSE_MS = 8000L

    fun pauseFromJs(context: Context) {
      ShellPlaybackSession.userPaused = true
      ShellPlaybackSession.playing = false
      // 勿清 verseUnderlayPlaying：与 applyUserPause 一致。否则「停音乐」会丢金句垫底，
      // 续播只能恢复主轨；读经开播仍由 kind=scripture 硬清垫底。
      ShellVerseNativePlayer.pause()
      ShellMainNativePlayer.pause()
      if (ShellPlaybackSession.active) startOrRefresh(context)
    }

    fun resumeFromJs(context: Context) {
      ShellCallAudioMonitor.clearStaleInterruptIfIdle(context)
      ShellPlaybackSession.userPaused = false
      ShellPlaybackSession.lastUserPlayAtElapsed = android.os.SystemClock.elapsedRealtime()
      if (!ShellPlaybackSession.assetUri.isNullOrBlank()) {
        ShellPlaybackSession.playing = true
      }
      if (ShellPlaybackSession.active) startOrRefresh(context)
    }

    fun startOrRefresh(context: Context) {
      val appContext = context.applicationContext
      val intent =
        Intent(appContext, ShellPlaybackService::class.java).apply { action = ACTION_REFRESH }
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          appContext.startForegroundService(intent)
        } else {
          appContext.startService(intent)
        }
      } catch (_: Exception) {
        /* ignore */
      }
    }

    /** 金句原生轨更新时长后刷新通知（服务已在跑时）。 */
    fun refreshIfRunning(context: Context) {
      startOrRefresh(context)
    }

    fun stop(context: Context) {
      context.startService(
        Intent(context, ShellPlaybackService::class.java).apply { action = ACTION_STOP },
      )
    }

    /** 桌面小挂件切换播放/暂停：转发 RemoteToggle 给存活的 JS 播放器。 */
    fun toggle(context: Context) {
      forwardRemote(context, ACTION_REMOTE_TOGGLE)
    }

    /** 桌面挂件「读经」键：只切换本日读经音频（不碰音乐播放器）。 */
    fun readingToggle(context: Context) {
      forwardRemote(context, ACTION_REMOTE_READING_TOGGLE)
    }

    /** 桌面挂件「音乐」键：只切换音乐播放器。 */
    fun musicToggle(context: Context) {
      forwardRemote(context, ACTION_REMOTE_MUSIC_TOGGLE)
    }

    /** 桌面挂件「喇叭」键：播放挂件当前经文金句。 */
    fun verseToggle(context: Context, verseKey: String) {
      forwardRemote(context, ACTION_REMOTE_VERSE_TOGGLE, verseKey)
    }

    private fun forwardRemote(context: Context, action: String, verseKey: String? = null) {
      val appContext = context.applicationContext
      val intent =
        Intent(appContext, ShellPlaybackService::class.java).apply {
          this.action = action
          if (!verseKey.isNullOrBlank()) {
            putExtra(EXTRA_VERSE_KEY, verseKey.trim())
          }
        }
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          appContext.startForegroundService(intent)
        } else {
          appContext.startService(intent)
        }
      } catch (_: Exception) {
        /* ignore */
      }
    }
  }
}
