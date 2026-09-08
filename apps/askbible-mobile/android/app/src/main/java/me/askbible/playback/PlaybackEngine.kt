package me.askbible.playback

import android.content.Context
import android.os.Handler
import android.os.Looper
import me.askbible.playback.model.PlaybackState
import me.askbible.playback.model.PlaybackStore
import me.askbible.playback.model.StreamId

/**
 * 把 [PlaybackStore] 的状态落到三个 [StreamPlayer] 上。
 *
 * **这是全 App 唯一决定「谁该响」的地方。** 旧代码里这个决定散在两个播放器、一个前台
 * 服务和几十处 `if (kind == "music" && ...)` 里，彼此不一致就出 bug；现在只有下面这一个
 * 循环：状态说某条流该响就让它响，没说就停。播放器自己不再有任何判断权。
 *
 * 所有播放器操作都在主线程执行（MediaPlayer 的回调与生命周期要求）。
 */
object PlaybackEngine {
  private val handler = Handler(Looper.getMainLooper())

  private val players =
    mapOf(
      StreamId.MUSIC to StreamPlayer(StreamId.MUSIC, speech = false, tag = "AskBibleMusic"),
      StreamId.SCRIPTURE to StreamPlayer(StreamId.SCRIPTURE, speech = true, tag = "AskBibleScripture"),
      StreamId.VERSE to StreamPlayer(StreamId.VERSE, speech = true, tag = "AskBibleVerse"),
    )

  @Volatile private var started = false
  @Volatile private var appContext: Context? = null

  fun start(context: Context) {
    appContext = context.applicationContext
    if (started) return
    started = true
    PlaybackStore.subscribe { _, next -> handler.post { apply(next) } }
    apply(PlaybackStore.state)
  }

  fun playerFor(stream: StreamId): StreamPlayer = players.getValue(stream)

  /** 有任何一路还在缓冲。三星在开播瞬间会误发 Pause，服务据此多等一会儿。 */
  fun anyPreparing(): Boolean = players.values.any { it.isPreparing() }

  /** 状态 → 三个播放器。幂等：同样的状态跑两遍不会有额外动作。 */
  private fun apply(state: PlaybackState) {
    val context = appContext ?: return
    val audible = state.audibleStreams()
    for (id in StreamId.entries) {
      val player = players.getValue(id)
      val stream = state[id]
      when {
        id in audible -> player.play(context, stream.uri!!, stream.positionSec)
        /** 只是暂停：保留 MediaPlayer 与进度，续播才不用重新缓冲。 */
        stream.uri != null -> player.pause()
        else -> player.stop()
      }
    }
  }
}
