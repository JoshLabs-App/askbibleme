package me.askbible.playback

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import me.askbible.playback.model.PlaybackState
import me.askbible.playback.model.PlaybackStore
import me.askbible.playback.model.StreamId
import me.askbible.playback.model.StreamState

/**
 * 把三条流的状态推给 JS。
 *
 * **JS 从此不再自己记「现在在播什么」**，只订阅这里推来的事实。
 *
 * 旧代码里 JS 维护着 `playing` / `playbackMode` 两个共用状态，三路都读它，于是同一个按钮
 * 的图标和点击处理可能得出不同答案——2026-09-08 实测「播着音乐点读经没反应」就是这么来的：
 * 图标判断 `playbackMode === "scripture" && playing`，点击处理只判断 `playing`，
 * 音乐在放时后者为真，于是按下去执行了暂停。
 *
 * 事件名 `ShellPlaybackState`，载荷形如：
 * ```
 * { music: {playing, uri, positionSec, durationSec, userPaused, title…}, scripture: {…}, verse: {…},
 *   systemInterrupted: false, nowPlayingStream: "music" }
 * ```
 */
object PlaybackStateBridge {
  private const val EVENT = "ShellPlaybackState"

  @Volatile private var started = false

  fun start() {
    if (started) return
    started = true
    PlaybackStore.subscribe { _, next -> emit(next) }
    emit(PlaybackStore.state)
  }

  private fun emit(state: PlaybackState) {
    AskBibleShellMediaControlsModule.emitRemote(EVENT, serialize(state))
  }

  private fun serialize(state: PlaybackState): WritableMap {
    val audible = state.audibleStreams()
    val map = Arguments.createMap()
    for (id in StreamId.entries) {
      map.putMap(id.name.lowercase(), streamMap(state[id], playing = id in audible))
    }
    map.putBoolean("systemInterrupted", state.systemInterrupted)
    map.putString(
      "nowPlayingStream",
      me.askbible.playback.model.nowPlaying(state)?.stream?.name?.lowercase(),
    )
    return map
  }

  private fun streamMap(stream: StreamState, playing: Boolean): WritableMap =
    Arguments.createMap().apply {
      /** `playing` 是「此刻真的该出声」，已经把用户暂停与系统打断算进去了。 */
      putBoolean("playing", playing)
      putBoolean("wantPlaying", stream.wantPlaying)
      putBoolean("userPaused", stream.userPaused)
      putString("uri", stream.uri)
      putDouble("positionSec", stream.positionSec)
      putDouble("durationSec", stream.durationSec)
      putInt("queueLength", stream.queue.size)
      putString("title", stream.title)
      putString("artist", stream.artist)
      putString("album", stream.album)
    }
}
