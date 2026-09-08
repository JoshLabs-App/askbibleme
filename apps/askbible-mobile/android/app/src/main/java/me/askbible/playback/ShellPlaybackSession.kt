package me.askbible.playback

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import me.askbible.playback.model.Intent
import me.askbible.playback.model.JsPayload
import me.askbible.playback.model.PlaybackStore
import me.askbible.playback.model.StreamId
import me.askbible.playback.model.intentsFor
import me.askbible.playback.model.nowPlaying
import java.io.FileInputStream

/**
 * 通知栏 / 锁屏要用的那一份「当前在播什么」，以及 JS 载荷的入口。
 *
 * **这里不再存任何状态。** 每个字段都是从 [PlaybackStore] 派生出来的读值，
 * 写入一律走 [PlaybackStore.dispatch]。
 *
 * 它以前是一袋 25 个全局可变标志，三路音频共用、四个文件随手写，
 * 「谁改了它」无从追溯——2026-09-07~08 那一晚定位到的六个 bug 全部产自这一点：
 * 关音乐把金句一起停掉、点音乐让金句从头重放、两个播放器隔着标志互抢音频焦点……
 * 现在三路各有各的状态（[me.askbible.playback.model.StreamState]），
 * 这些串扰在结构上不可能再发生。
 */
object ShellPlaybackSession {

  private val np
    get() = nowPlaying(PlaybackStore.state)

  // ------------------------------------------------------------ 通知栏要显示的

  val title: String
    get() = np?.title.orEmpty()

  val artist: String
    get() = np?.artist.orEmpty()

  val album: String
    get() = np?.album.orEmpty()

  val artworkUri: String?
    get() = np?.artworkUri

  val durationSec: Double
    get() = np?.durationSec ?: 0.0

  val positionSec: Double
    get() = np?.positionSec ?: 0.0

  /** 通知栏那一路此刻是否在响。 */
  val playing: Boolean
    get() = np?.playing == true

  /** 通知栏那一路的种类（"music" / "scripture" / "verse"），没有则空串。 */
  val kind: String
    get() = np?.stream?.name?.lowercase().orEmpty()

  val assetUri: String?
    get() = np?.let { PlaybackStore.state[it.stream].uri }

  /** 还有东西可播（哪怕暂停着），前台服务据此决定是否留着通知。 */
  val active: Boolean
    get() = np != null

  val systemInterrupted: Boolean
    get() = PlaybackStore.state.systemInterrupted

  /** 任意一路在响。 */
  val anyAudible: Boolean
    get() = PlaybackStore.state.audibleStreams().isNotEmpty()

  @Volatile var rate: Float = 1f
  @Volatile var stopAtSec: Double = 0.0

  /** JS 点播时刻：用来丢掉三星在开播瞬间误发的 MediaSession Pause。 */
  @Volatile var lastUserPlayAtElapsed: Long = 0L

  // ------------------------------------------------------------ 写入（全部转成意图）

  fun setSystemInterrupted(active: Boolean) {
    PlaybackStore.dispatch(Intent.SystemInterrupt(active))
  }

  /** 锁屏 / 通知栏的暂停键：当前在响的几路一起停。 */
  fun pauseAll() {
    PlaybackStore.dispatch(Intent.PauseAll)
  }

  /** 锁屏 / 通知栏的播放键：把用户暂停过的几路放回来。 */
  fun resumeAll() {
    PlaybackStore.dispatch(Intent.ResumeTransport)
  }

  fun clear() {
    for (id in StreamId.entries) PlaybackStore.dispatch(Intent.Stop(id))
  }

  /**
   * JS 每次 `updateSession()` 的入口。
   *
   * 只做两件事：解析 JSON、翻成意图。语义判断全在
   * [me.askbible.playback.model.intentsFor]（纯函数，有单测）。
   */
  fun updateFromJson(json: String) {
    val payload =
      try {
        parsePayload(JSONObject(json))
      } catch (_: Exception) {
        return
      }
    if (payload.userPlay) lastUserPlayAtElapsed = android.os.SystemClock.elapsedRealtime()
    for (intent in intentsFor(payload, PlaybackStore.state)) {
      PlaybackStore.dispatch(intent)
    }
  }

  private fun parsePayload(o: JSONObject): JsPayload =
    JsPayload(
      kind = o.optString("kind", ""),
      playing = o.optBoolean("playing", false),
      userPlay = o.optBoolean("userPlay", false),
      userPause = o.optBoolean("userPause", false),
      assetUri = o.stringOrNull("assetUri"),
      nextUris = collectNextUris(o),
      gapSec = o.optDouble("gapSec", 0.0).takeIf { it.isFinite() } ?: 0.0,
      title = o.optString("title", ""),
      artist = o.optString("artist", ""),
      album = o.optString("album", ""),
      artworkUri = o.stringOrNull("artworkUri"),
      positionSec = o.optDouble("positionSec", 0.0).takeIf { it.isFinite() } ?: 0.0,
      durationSec = o.optDouble("durationSec", 0.0).takeIf { it.isFinite() } ?: 0.0,
    )

  /**
   * 取字符串字段。**不要直接用 `optString`**：Android 的 JSONObject 遇到 JSON null 会返回
   * 字面量 `"null"` 字符串而不是 Kotlin null，于是 `assetUri: null` 会被当成一条叫 "null"
   * 的路径送进 MediaPlayer（`startUri failed uri=null` + ENOENT，2026-09-07 实证）。
   */
  private fun JSONObject.stringOrNull(key: String): String? {
    if (isNull(key)) return null
    val raw = optString(key, "").trim()
    return raw.takeIf { it.isNotEmpty() && it != "null" && it != "undefined" }
  }

  private fun collectNextUris(o: JSONObject): List<String> {
    val out = ArrayList<String>()
    fun add(v: String?) {
      val uri = v?.trim().orEmpty()
      if (uri.isNotEmpty() && uri != "null" && !out.contains(uri)) out.add(uri)
    }
    add(o.stringOrNull("nextAssetUri"))
    add(o.stringOrNull("nextNextAssetUri"))
    val arr = o.optJSONArray("nextAssetUris") ?: JSONArray()
    for (i in 0 until arr.length()) add(arr.optString(i, ""))
    return out
  }

  // ------------------------------------------------------------ 封面

  fun loadArtworkBitmap(): Bitmap? {
    val uri = artworkUri?.trim().orEmpty()
    if (uri.isEmpty()) return null
    return try {
      when {
        uri.startsWith("file://") ->
          FileInputStream(Uri.parse(uri).path ?: return null).use { BitmapFactory.decodeStream(it) }
        uri.startsWith("/") -> FileInputStream(uri).use { BitmapFactory.decodeStream(it) }
        else -> null
      }
    } catch (_: Exception) {
      null
    }
  }
}
