package me.askbible.playback

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import me.askbible.MainActivity
import me.askbible.R
import me.askbible.widget.WidgetPlaybackBridge

/** 壳层音乐 / 读经朗读：前台服务 + MediaSession，保证后台与锁屏控制。 */
class ShellPlaybackService : Service() {
  private var mediaSession: MediaSessionCompat? = null
  private val handler = Handler(Looper.getMainLooper())
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
    ensureChannel()
    mediaSession =
      MediaSessionCompat(this, TAG).apply {
        setCallback(
          object : MediaSessionCompat.Callback() {
            override fun onPlay() {
              android.util.Log.i(TAG, "MediaSession onPlay -> RemotePlay")
              AskBibleShellMediaControlsModule.emitRemote("RemotePlay")
            }

            override fun onPause() {
              android.util.Log.i(TAG, "MediaSession onPause -> RemotePause")
              AskBibleShellMediaControlsModule.emitRemote("RemotePause")
            }

            override fun onSkipToNext() {
              android.util.Log.i(TAG, "MediaSession onSkipToNext -> RemoteNext")
              AskBibleShellMediaControlsModule.emitRemote("RemoteNext")
            }

            override fun onSkipToPrevious() {
              android.util.Log.i(TAG, "MediaSession onSkipToPrevious -> RemotePrevious")
              AskBibleShellMediaControlsModule.emitRemote("RemotePrevious")
            }
          },
        )
        isActive = true
      }
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
      ACTION_STOP -> {
        android.util.Log.i(TAG, "ACTION_STOP -> stopPlaybackSession")
        stopPlaybackSession()
        return START_NOT_STICKY
      }
      ACTION_REMOTE_TOGGLE -> {
        android.util.Log.i(TAG, "ACTION_REMOTE_TOGGLE -> emit RemoteToggle")
        AskBibleShellMediaControlsModule.emitRemote("RemoteToggle")
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
      ACTION_REMOTE_NEXT -> {
        android.util.Log.i(TAG, "ACTION_REMOTE_NEXT -> emit RemoteNext")
        AskBibleShellMediaControlsModule.emitRemote("RemoteNext")
        if (!ShellPlaybackSession.active) {
          stopPlaybackSession()
          return START_NOT_STICKY
        }
        publishSessionState()
        return START_STICKY
      }
      ACTION_REMOTE_PREVIOUS -> {
        android.util.Log.i(TAG, "ACTION_REMOTE_PREVIOUS -> emit RemotePrevious")
        AskBibleShellMediaControlsModule.emitRemote("RemotePrevious")
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
    mediaSession?.isActive = false
    mediaSession?.release()
    mediaSession = null
    super.onDestroy()
  }

  private fun publishSessionState() {
    if (!ShellPlaybackSession.active) {
      stopPlaybackSession()
      return
    }

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
            PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
            PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS,
        )
        .setState(state, positionMs, if (ShellPlaybackSession.playing) 1f else 0f)
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
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
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
          .setShowActionsInCompactView(0, 1, 2),
      )
      .build()
  }

  private fun stopPlaybackSession() {
    handler.removeCallbacks(refreshRunnable)
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
    const val ACTION_REFRESH = "me.askbible.playback.REFRESH"
    const val ACTION_REMOTE_TOGGLE = "me.askbible.playback.REMOTE_TOGGLE"
    const val ACTION_REMOTE_READING_TOGGLE = "me.askbible.playback.REMOTE_READING_TOGGLE"
    const val ACTION_REMOTE_MUSIC_TOGGLE = "me.askbible.playback.REMOTE_MUSIC_TOGGLE"
    const val ACTION_REMOTE_NEXT = "me.askbible.playback.REMOTE_NEXT"
    const val ACTION_REMOTE_PREVIOUS = "me.askbible.playback.REMOTE_PREVIOUS"

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

    private fun forwardRemote(context: Context, action: String) {
      val appContext = context.applicationContext
      val intent =
        Intent(appContext, ShellPlaybackService::class.java).apply { this.action = action }
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
