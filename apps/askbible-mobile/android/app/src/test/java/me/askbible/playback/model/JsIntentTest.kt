package me.askbible.playback.model

import kotlin.test.assertEquals
import kotlin.test.assertTrue
import org.junit.Test

/**
 * JS 载荷翻译层的测试。
 *
 * 这一层是那一晚多数故障的现场：JS 每秒发一次「当前会话状态」，而它的答案比原生慢一拍。
 * 下面几条就是把当时的载荷序列原样重放，确认新翻译规则不会再让它顶掉正在播的东西。
 */
class JsIntentTest {

  private fun sync(
    kind: String,
    playing: Boolean = true,
    userPlay: Boolean = false,
    userPause: Boolean = false,
    asset: String? = null,
    next: List<String> = emptyList(),
  ) = JsPayload(
    kind = kind,
    playing = playing,
    userPlay = userPlay,
    userPause = userPause,
    assetUri = asset,
    nextUris = next,
  )

  @Test
  fun `user play starts that stream`() {
    val intents = intentsFor(sync("music", userPlay = true, asset = "a.mp3"), PlaybackState())
    assertEquals(1, intents.size)
    val play = intents.single() as Intent.Play
    assertEquals(StreamId.MUSIC, play.stream)
    assertEquals("a.mp3", play.uri)
  }

  /**
   * 关音乐只暂停音乐。
   * 旧代码在这里置全局 userPaused，金句被连坐停掉，图标却还亮着（2026-09-08 实测）。
   */
  @Test
  fun `user pause targets only its own stream`() {
    val intents = intentsFor(sync("music", playing = false, userPause = true), PlaybackState())
    assertEquals(listOf(Intent.Pause(StreamId.MUSIC)), intents)
  }

  /**
   * 保活同步不得改变正在播的音轨。
   *
   * 重放当时的现场：原生已接上 PRO-3-14，JS 仍拿着 ISA-58-10 每秒发一次。
   * 旧代码照单执行，新句播了 0.9 秒被掐；现在这类载荷不产生任何换轨意图。
   */
  @Test
  fun `keepalive cannot change the current track`() {
    val playing =
      reduce(PlaybackState(), Intent.Play(StreamId.VERSE, "PRO-3-14.mp3"))
    val intents = intentsFor(sync("verse", asset = "ISA-58-10.mp3"), playing)

    assertTrue(intents.none { it is Intent.Play })
    val after = intents.fold(playing) { s, i -> reduce(s, i) }
    assertEquals("PRO-3-14.mp3", after.verse.uri)
  }

  /** 保活可以补队列——关屏后原生要靠它自己接下去。 */
  @Test
  fun `keepalive may refill the queue`() {
    val playing = reduce(PlaybackState(), Intent.Play(StreamId.VERSE, "A.mp3"))
    val intents = intentsFor(sync("verse", asset = "A.mp3", next = listOf("B.mp3")), playing)

    assertEquals(listOf(Intent.SetQueue(StreamId.VERSE, listOf("B.mp3"))), intents)
  }

  /** playing=true 的保活不能把已停的一路重新拉起来；开播只认 userPlay。 */
  @Test
  fun `keepalive does not resurrect a stopped stream`() {
    val stopped = PlaybackState()
    val after =
      intentsFor(sync("music", asset = "a.mp3"), stopped).fold(stopped) { s, i -> reduce(s, i) }

    assertTrue(after.audibleStreams().isEmpty())
  }

  /** 字面量 "null"：Android 的 JSONObject 对 JSON null 返回的就是这个字符串。 */
  @Test
  fun `literal null asset is rejected`() {
    assertTrue(intentsFor(sync("music", userPlay = true, asset = "null"), PlaybackState()).isEmpty())
    assertTrue(intentsFor(sync("music", userPlay = true, asset = "  "), PlaybackState()).isEmpty())
  }

  @Test
  fun `unknown kind is ignored`() {
    assertTrue(intentsFor(sync("ambient", userPlay = true, asset = "a.mp3"), PlaybackState()).isEmpty())
  }

  /** 完整重放：音乐 → 金句叠加 → 换音乐 → 关音乐，金句全程不受影响。 */
  @Test
  fun `replay of the reported failure sequence`() {
    var s = PlaybackState()
    fun apply(p: JsPayload) {
      s = intentsFor(p, s).fold(s) { acc, i -> reduce(acc, i) }
    }

    apply(sync("music", userPlay = true, asset = "song1.mp3"))
    apply(sync("verse", userPlay = true, asset = "PSA-23-1.mp3", next = listOf("JHN-3-16.mp3")))
    assertEquals(setOf(StreamId.MUSIC, StreamId.VERSE), s.audibleStreams())

    apply(sync("music", userPlay = true, asset = "song2.mp3"))
    assertEquals("PSA-23-1.mp3", s.verse.uri)
    assertEquals(setOf(StreamId.MUSIC, StreamId.VERSE), s.audibleStreams())

    apply(sync("music", playing = false, userPause = true))
    assertEquals(setOf(StreamId.VERSE), s.audibleStreams())
  }
}
