package me.askbible.playback.model

/**
 * 播放状态机（纯 Kotlin，刻意不 import 任何 android.*，以便 JVM 单测直接跑）。
 *
 * ## 为什么推倒重来
 *
 * 旧的 `ShellPlaybackSession` 是一袋 25 个全局可变标志（`playing`、`userPaused`、
 * `assetUri`、`forceRestartUri`…），**三路音频共用同一袋**，而且 JS 与原生都往里写。
 * 于是每个读取点都得自己拼一套「这次算不算我」的条件，一处没拼对就出 bug。
 * 2026-09-07~08 一晚上定位到的 6 个问题全是同一个形状：
 *
 * - 音乐与金句各自申请独占音频焦点，系统不知道是同一个 App，后者踢掉前者
 * - `forceRestartUri` 无主：点音乐置上它，金句也读，于是金句 seek 回 0
 * - JS 拿着过期的「当前金句」覆盖原生刚接上的那句，播了 0.9 秒被掐
 * - 关音乐时置了全局 `userPaused`，正在响的金句被连坐停掉，图标却还亮着
 *
 * 结论不是「再补一个条件」，而是**这三路根本不该共用状态**。
 *
 * ## 新模型的三条规矩
 *
 * 1. **每路自己的状态**（[StreamState]）。关音乐在物理上碰不到金句的字段。
 * 2. **唯一真相在原生**。JS 只发意图（[Intent]），原生回报事实。关屏后 JS 会被 Doze
 *    冻住，状态住在会被冻住的一侧就必然分叉——这正是旧代码分裂的根源。
 * 3. **互斥规则集中在一处**（[EXCLUSIVE_WITH]），不再散落在几十个 `if (kind == ...)` 里。
 *
 * [reduce] 是纯函数：给定状态与意图得出新状态，不做 IO、不碰播放器。副作用由调用方
 * 依据前后状态差异去执行（该起播谁、该停谁）。
 */

/** 三路互不相干的音频。 */
enum class StreamId {
  /** 背景音乐。 */
  MUSIC,

  /** 读经朗读（整章）。 */
  SCRIPTURE,

  /** 首页金句轮播。 */
  VERSE,
}

/**
 * 谁与谁不能同时响。
 *
 * 现状即设计：音乐是背景，金句是叠在背景上的短句，两者可以同时；读经是长篇朗读，
 * 与音乐、与金句都互斥（两段人声叠在一起听不清）。
 * 改互斥关系只改这张表，不必再去翻各处的 if。
 */
private val EXCLUSIVE_WITH: Map<StreamId, Set<StreamId>> =
  mapOf(
    StreamId.MUSIC to setOf(StreamId.SCRIPTURE),
    StreamId.SCRIPTURE to setOf(StreamId.MUSIC, StreamId.VERSE),
    StreamId.VERSE to setOf(StreamId.SCRIPTURE),
  )

/** 一路音频的全部状态。除了 [PlaybackState] 里的两个系统级字段，没有任何跨路共享。 */
data class StreamState(
  /** 用户/JS 表达的意图：这一路应该在响。真的有没有出声由播放器回报。 */
  val wantPlaying: Boolean = false,
  /** 当前音轨。 */
  val uri: String? = null,
  /** 待播队列；关屏时原生靠它自己接下一条，不依赖 JS 醒着。 */
  val queue: List<String> = emptyList(),
  /** 两条之间的静默间隔（金句轮播用）。 */
  val gapSec: Double = 0.0,
  val positionSec: Double = 0.0,
  /**
   * 用户显式按了这一路的暂停。
   *
   * **只属于这一路**。旧代码这是个全局标志，关音乐会把金句一起停掉，而且
   * 「音乐停后把金句升为主轨」的恢复路径也要求它为 false，于是一并被堵死——
   * 表现为「关掉音乐，金句按钮还黄着却没声」（2026-09-08 实测复现）。
   */
  val userPaused: Boolean = false,
  val title: String = "",
  val artist: String = "",
  val album: String = "",
  val artworkUri: String? = null,
  val durationSec: Double = 0.0,
) {
  /** 这一路此刻是否应该出声。 */
  val shouldPlay: Boolean
    get() = wantPlaying && !userPaused && uri != null
}

/** 整个播放子系统的状态。 */
data class PlaybackState(
  val music: StreamState = StreamState(),
  val scripture: StreamState = StreamState(),
  val verse: StreamState = StreamState(),
  /** 来电 / 通话：全部停播，但不算用户暂停，通话结束应能恢复。 */
  val systemInterrupted: Boolean = false,
  /**
   * 上一次锁屏/通知栏暂停键停掉的几路。
   *
   * 播放键要恢复的正是这几路，而不是「所有被暂停过的」——否则一条早就被用户单独关掉的流
   * 会被一起放回来（真机账本：读经播着时按暂停再按播放，音乐也跟着回来了）。
   */
  val transportPaused: Set<StreamId> = emptySet(),
) {
  operator fun get(id: StreamId): StreamState =
    when (id) {
      StreamId.MUSIC -> music
      StreamId.SCRIPTURE -> scripture
      StreamId.VERSE -> verse
    }

  fun with(id: StreamId, next: StreamState): PlaybackState =
    when (id) {
      StreamId.MUSIC -> copy(music = next)
      StreamId.SCRIPTURE -> copy(scripture = next)
      StreamId.VERSE -> copy(verse = next)
    }

  /** 此刻真正该出声的几路。系统打断时一路都不响。 */
  fun audibleStreams(): Set<StreamId> {
    if (systemInterrupted) return emptySet()
    return StreamId.entries.filter { this[it].shouldPlay }.toSet()
  }
}

/** 状态机的输入。JS、锁屏控制、原生播放器回报都走这里，没有别的入口。 */
sealed interface Intent {
  /** 用户点播某一路（换轨或从头开始）。 */
  data class Play(
    val stream: StreamId,
    val uri: String,
    val queue: List<String> = emptyList(),
    val gapSec: Double = 0.0,
    val title: String = "",
    val artist: String = "",
    val album: String = "",
    val artworkUri: String? = null,
    val positionSec: Double = 0.0,
  ) : Intent

  /** 用户暂停某一路。只影响这一路。 */
  data class Pause(val stream: StreamId) : Intent

  /** 用户从暂停中续播某一路。 */
  data class Resume(val stream: StreamId) : Intent

  /** 彻底停掉某一路并清空它的队列。 */
  data class Stop(val stream: StreamId) : Intent

  /** 补充/替换待播队列（关屏自接用）。 */
  data class SetQueue(val stream: StreamId, val queue: List<String>) : Intent

  /**
   * 原生播放器自己接上了下一条，回报事实。
   *
   * 旧代码没有这条：原生接句后 JS 仍拿着上一句，随后一次例行同步就把刚起头的新句顶掉。
   * 现在原生是唯一真相，JS 只能听。
   */
  data class NativeAdvanced(val stream: StreamId, val uri: String) : Intent

  /** 播放器回报进度。 */
  data class Progress(val stream: StreamId, val positionSec: Double, val durationSec: Double) :
    Intent

  /** 某一路自然播完且队列空了。 */
  data class Ended(val stream: StreamId) : Intent

  /** 来电 / 通话开始或结束。 */
  data class SystemInterrupt(val active: Boolean) : Intent

  /** 锁屏或通知栏的全局暂停键：当前在响的几路一起停。 */
  data object PauseAll : Intent

  /** 锁屏或通知栏的播放键：恢复上一次 [PauseAll] 停掉的那几路。 */
  data object ResumeTransport : Intent

  /** 睡眠定时器到点。 */
  data object SleepTimerFired : Intent
}

/**
 * 状态转移。纯函数，无副作用。
 *
 * 调用方拿 [reduce] 前后的状态做差，决定去启动或停止哪个播放器——
 * 播放器不再自己读全局标志猜「现在轮不轮到我」。
 */
fun reduce(state: PlaybackState, intent: Intent): PlaybackState =
  when (intent) {
    is Intent.Play -> {
      val next =
        state[intent.stream].copy(
          wantPlaying = true,
          userPaused = false,
          uri = intent.uri,
          queue = intent.queue,
          gapSec = intent.gapSec,
          positionSec = intent.positionSec,
          title = intent.title,
          artist = intent.artist,
          album = intent.album,
          artworkUri = intent.artworkUri,
        )
      /** 开一路就让与它互斥的几路让位——集中在这里，播放器不必各自判断。 */
      var out = state.with(intent.stream, next)
      for (other in EXCLUSIVE_WITH[intent.stream].orEmpty()) {
        out = out.with(other, out[other].copy(wantPlaying = false))
      }
      out
    }

    is Intent.Pause ->
      state.with(intent.stream, state[intent.stream].copy(userPaused = true))

    is Intent.Resume -> {
      /*
       * 与它互斥的一路正在响时，续播不生效——最近一次明确的 Play 优先。
       *
       * 只让 Play 处理互斥是不够的：JS 在开读经之后还会补一次 resumeAppMusic()（旧逻辑
       * 遗留），于是音乐挤回来和读经一起响（2026-09-08 真机账本：
       * `Play SCRIPTURE -> audible=[SCRIPTURE]` 紧接 `Resume MUSIC -> audible=[MUSIC, SCRIPTURE]`）。
       */
      val blocked = EXCLUSIVE_WITH[intent.stream].orEmpty().any { it in state.audibleStreams() }
      if (blocked) {
        state
      } else {
        state.with(
          intent.stream,
          state[intent.stream].copy(userPaused = false, wantPlaying = true),
        )
      }
    }

    is Intent.Stop ->
      state.with(
        intent.stream,
        StreamState(),
      )

    is Intent.SetQueue ->
      state.with(intent.stream, state[intent.stream].copy(queue = intent.queue))

    is Intent.NativeAdvanced ->
      state.with(
        intent.stream,
        state[intent.stream].copy(
          uri = intent.uri,
          queue = state[intent.stream].queue.drop(1),
          positionSec = 0.0,
        ),
      )

    is Intent.Progress ->
      state.with(
        intent.stream,
        state[intent.stream].copy(
          positionSec = intent.positionSec,
          durationSec = intent.durationSec,
        ),
      )

    is Intent.Ended ->
      state.with(intent.stream, state[intent.stream].copy(wantPlaying = false, uri = null))

    is Intent.SystemInterrupt -> state.copy(systemInterrupted = intent.active)

    /** 全局暂停：只暂停此刻在响的，并记下是哪几路，好让播放键原样恢复。 */
    Intent.PauseAll -> {
      val paused = state.audibleStreams()
      var out = state.copy(transportPaused = paused)
      for (id in paused) {
        out = out.with(id, out[id].copy(userPaused = true))
      }
      out
    }

    /** 锁屏/通知栏播放键：恢复上次暂停键停掉的那几路。 */
    Intent.ResumeTransport -> {
      var out = state.copy(transportPaused = emptySet())
      for (id in state.transportPaused) {
        out = reduce(out, Intent.Resume(id))
      }
      out.copy(transportPaused = emptySet())
    }

    Intent.SleepTimerFired -> {
      var out = state
      for (id in StreamId.entries) {
        out = out.with(id, out[id].copy(wantPlaying = false, userPaused = true))
      }
      out
    }
  }

/** 通知栏 / 锁屏要显示的那一路。 */
data class NowPlaying(
  val stream: StreamId,
  val title: String,
  val artist: String,
  val album: String,
  val artworkUri: String?,
  val positionSec: Double,
  val durationSec: Double,
  val playing: Boolean,
)

/**
 * 谁占通知栏。
 *
 * 读经 > 音乐 > 金句：金句是叠在音乐上的短句，抢标题会让通知栏每十几秒跳一次
 * （旧代码专门为此拉了一整套 `verseUnderlay*` 影子字段，现在只需这一行优先级）。
 * 都没在响时，显示最后一个还留着音轨的，好让锁屏上仍有可续播的对象。
 */
fun nowPlaying(state: PlaybackState): NowPlaying? {
  val order = listOf(StreamId.SCRIPTURE, StreamId.MUSIC, StreamId.VERSE)
  val audible = state.audibleStreams()
  val pick =
    order.firstOrNull { it in audible } ?: order.firstOrNull { state[it].uri != null } ?: return null
  val s = state[pick]
  return NowPlaying(
    stream = pick,
    title = s.title,
    artist = s.artist,
    album = s.album,
    artworkUri = s.artworkUri,
    positionSec = s.positionSec,
    durationSec = s.durationSec,
    playing = pick in audible,
  )
}
