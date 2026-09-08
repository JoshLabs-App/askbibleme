package me.askbible.playback.model

import android.util.Log
import java.util.concurrent.CopyOnWriteArrayList

/**
 * 播放状态的唯一持有者。
 *
 * 所有改动都必须经过 [dispatch]——没有第二个入口，也没有可以被别处直接赋值的公开字段。
 * 旧的 `ShellPlaybackSession` 有 25 个 `@Volatile var` 散落给四个文件随手写，
 * 「谁改了它」无从追溯；那一晚的六个 bug 全部产自这一点。
 *
 * 线程：`dispatch` 整体加锁，监听者在锁外回调（监听者常会转头再 dispatch，
 * 在锁内回调会死锁——同样的坑在 ShellAudioFocus 里踩过一次）。
 */
object PlaybackStore {
  @Volatile
  private var current: PlaybackState = PlaybackState()

  private val listeners = CopyOnWriteArrayList<(PlaybackState, PlaybackState) -> Unit>()

  val state: PlaybackState
    get() = current

  /** 状态变化时回调 (旧, 新)。副作用（起播 / 停止 / 刷通知）都在这里做。 */
  fun subscribe(listener: (previous: PlaybackState, next: PlaybackState) -> Unit): () -> Unit {
    listeners.add(listener)
    return { listeners.remove(listener) }
  }

  fun dispatch(intent: Intent) {
    val previous: PlaybackState
    val next: PlaybackState
    synchronized(this) {
      previous = current
      next = reduce(previous, intent)
      if (previous == next) return
      current = next
    }
    /*
     * 每条意图都留痕。旧模型排查时最大的困难是「谁改了状态」无从追溯——
     * 一整袋全局标志被四个文件随手写，只能靠猜。这一行把它变成可读的账本。
     */
    if (intent !is Intent.Progress) {
      Log.i(
        TAG,
        "${intent::class.simpleName} ${describe(intent)} -> audible=${next.audibleStreams()}",
      )
    }
    for (listener in listeners) {
      try {
        listener(previous, next)
      } catch (_: Exception) {
        /* 一个监听者出错不该拖垮其余的 */
      }
    }
  }

  private const val TAG = "AskBiblePlayback"

  private fun describe(intent: Intent): String =
    when (intent) {
      is Intent.Play -> "${intent.stream} ${intent.uri.takeLast(28)} q=${intent.queue.size}"
      is Intent.Pause -> intent.stream.toString()
      is Intent.Resume -> intent.stream.toString()
      is Intent.Stop -> intent.stream.toString()
      is Intent.SetQueue -> "${intent.stream} q=${intent.queue.size}"
      is Intent.NativeAdvanced -> "${intent.stream} ${intent.uri.takeLast(28)}"
      is Intent.Progress -> ""
      is Intent.Ended -> intent.stream.toString()
      is Intent.SystemInterrupt -> intent.active.toString()
      Intent.PauseAll -> ""
      Intent.SleepTimerFired -> ""
    }

  /** 仅供测试与冷启动重置。 */
  fun resetForTesting() {
    synchronized(this) { current = PlaybackState() }
  }
}
