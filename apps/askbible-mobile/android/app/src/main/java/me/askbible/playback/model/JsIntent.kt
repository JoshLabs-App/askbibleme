package me.askbible.playback.model

/**
 * JS 载荷 → [Intent] 的翻译。
 *
 * 这是新旧世界的接缝：JS 目前仍然按老样子发一坨「当前会话状态」（kind / playing /
 * userPlay / userPause / assetUri / next…），这里把它翻成对**某一路**的意图。
 * 等 JS 侧改成直接发意图，这一层就可以删掉。
 *
 * 刻意做成不依赖 org.json 的纯数据入口（[JsPayload]），好在 JVM 上直接测——
 * JSON 解析留在调用方，解析错误不该混进语义判断里。
 */
data class JsPayload(
  val kind: String,
  val playing: Boolean,
  val userPlay: Boolean = false,
  val userPause: Boolean = false,
  val assetUri: String? = null,
  val nextUris: List<String> = emptyList(),
  val gapSec: Double = 0.0,
  val title: String = "",
  val artist: String = "",
  val album: String = "",
  val artworkUri: String? = null,
  val positionSec: Double = 0.0,
  val durationSec: Double = 0.0,
)

/** JS 的 kind 字符串 → 流。认不出的（旧的环境音等）返回 null，直接忽略。 */
fun streamOf(kind: String): StreamId? =
  when (kind.trim().lowercase()) {
    "music" -> StreamId.MUSIC
    "scripture" -> StreamId.SCRIPTURE
    "verse" -> StreamId.VERSE
    else -> null
  }

/**
 * 把一次 JS 同步翻成零或多条意图。
 *
 * 规则（每条都对应旧代码里一处踩过的坑）：
 * - `userPlay` → [Intent.Play]。这是唯一会换轨、会清暂停标记的输入。
 * - `userPause` → [Intent.Pause]，**只针对它自己那一路**。旧代码在这里置全局
 *   `userPaused`，于是关音乐会把正在响的金句一起停掉。
 * - 其余是 JS 每秒一次的保活同步：**只允许补充元数据与队列，不允许改变谁在播**。
 *   旧代码让保活能改 `assetUri`，而 JS 的答案比原生慢一拍，于是原生刚接上的那句
 *   被顶掉（实测起播 0.9 秒被掐）。现在保活碰不到 uri。
 */
fun intentsFor(payload: JsPayload, state: PlaybackState): List<Intent> {
  val stream = streamOf(payload.kind) ?: return emptyList()
  val uri = payload.assetUri?.trim()?.takeIf { it.isNotEmpty() && it != "null" }

  if (payload.userPlay) {
    if (uri == null) return emptyList()
    return listOf(
      Intent.Play(
        stream = stream,
        uri = uri,
        queue = payload.nextUris.mapNotNull { it.trim().takeIf(String::isNotEmpty) },
        gapSec = payload.gapSec,
        title = payload.title,
        artist = payload.artist,
        album = payload.album,
        artworkUri = payload.artworkUri,
        positionSec = payload.positionSec,
      ),
    )
  }

  if (payload.userPause) return listOf(Intent.Pause(stream))

  /*
   * 保活：只补队列与元数据。
   *
   * 特别地，playing=true 的保活**不**用来开播——开播只认 userPlay。旧代码靠
   * 「playing=true 就播」，导致 JS 一个迟到的心跳就能把已经停掉的一路重新拉起来。
   */
  val out = mutableListOf<Intent>()
  val queue = payload.nextUris.mapNotNull { it.trim().takeIf(String::isNotEmpty) }
  if (queue.isNotEmpty() && queue != state[stream].queue) {
    out += Intent.SetQueue(stream, queue)
  }
  if (payload.durationSec > 0 && payload.durationSec != state[stream].durationSec) {
    out += Intent.Progress(stream, state[stream].positionSec, payload.durationSec)
  }
  return out
}
