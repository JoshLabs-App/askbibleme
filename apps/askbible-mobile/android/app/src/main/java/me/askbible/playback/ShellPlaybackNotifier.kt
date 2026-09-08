package me.askbible.playback

import android.content.Context
import android.os.Handler
import android.os.Looper
import me.askbible.playback.model.PlaybackStore
import me.askbible.playback.model.nowPlaying

/**
 * 状态一变就刷新前台通知。
 *
 * 旧代码要求每个改状态的地方自己记得调 `publishSessionState()`，漏一处通知栏就和实际
 * 播放对不上（「按钮亮着却没声」有一部分来源于此）。现在订阅一次，谁改状态都自动刷新。
 */
object ShellPlaybackNotifier {
  private val handler = Handler(Looper.getMainLooper())

  @Volatile private var started = false

  fun start(context: Context) {
    if (started) return
    started = true
    val app = context.applicationContext
    PlaybackStore.subscribe { previous, next ->
      /** 只有通知栏看得见的部分变了才刷新，避免每秒进度滴答都重建通知。 */
      val before = nowPlaying(previous)
      val after = nowPlaying(next)
      val visibleChanged =
        before?.stream != after?.stream ||
          before?.title != after?.title ||
          before?.playing != after?.playing
      if (!visibleChanged) return@subscribe
      handler.post {
        if (after == null) ShellPlaybackService.stop(app) else ShellPlaybackService.startOrRefresh(app)
      }
    }
  }
}
