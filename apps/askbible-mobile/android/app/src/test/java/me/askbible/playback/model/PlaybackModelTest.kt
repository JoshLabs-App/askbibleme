package me.askbible.playback.model

import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.Test

/**
 * 状态机测试。
 *
 * 前半部分是 2026-09-07~08 那一晚在三星 S23 Ultra 上用 logcat 逐个定位到的真实故障，
 * 每条都注明当时的现象与证据。它们在旧模型里靠「给某个全局标志补一个条件」勉强修复，
 * 在新模型里应当**结构上不可能发生**——如果哪天有人把三路状态又合并回去，这些会先红。
 */
class PlaybackModelTest {

  private fun playMusic(state: PlaybackState = PlaybackState(), uri: String = "song.mp3") =
    reduce(state, Intent.Play(StreamId.MUSIC, uri, title = "曙光"))

  private fun playVerse(state: PlaybackState, uri: String = "PSA-23-1.mp3") =
    reduce(state, Intent.Play(StreamId.VERSE, uri, queue = listOf("JHN-3-16.mp3")))

  // ---------------------------------------------------------------- 回归：那一晚的六个

  /**
   * 现象：金句在放，点音乐 → 金句没声，按钮还黄着。
   * 证据：`I/ShellVerseNative: audio focus lost permanently; pausing` 紧跟在音乐起播之后。
   * 旧因：两个播放器各自申请独占的 AUDIOFOCUS_GAIN，系统不知道同属一个 App。
   * 新模型：音乐与金句不互斥，两路都该出声；焦点由 App 统一持有（ShellAudioFocus）。
   */
  @Test
  fun `music and verse play together`() {
    val s = playVerse(playMusic())
    assertEquals(setOf(StreamId.MUSIC, StreamId.VERSE), s.audibleStreams())
  }

  /**
   * 现象：金句在放，点另一首音乐 → 金句从头重来。
   * 证据：`sync uri=PSA-139-13 cur=PSA-139-13 primary=false underlay=true force=true`
   * 旧因：`forceRestartUri` 是无主的全局布尔，音乐点播置上它，金句也读到。
   * 新模型：Play 只写自己那一路，别路的 uri / position 不可能被碰到。
   */
  @Test
  fun `switching music track leaves verse untouched`() {
    val before = playVerse(playMusic(), uri = "PSA-139-13.mp3")
    val after = reduce(before, Intent.Play(StreamId.MUSIC, "另一首.mp3", title = "柔光之下"))

    assertEquals(before.verse, after.verse)
    assertEquals("另一首.mp3", after.music.uri)
    assertTrue(StreamId.VERSE in after.audibleStreams())
  }

  /**
   * 现象：关掉音乐 → 金句也没声了，但金句图标仍是黄的。
   * 证据：关音乐后金句 36 秒零日志；`pauseGate verseUserPaused=true kind=music`。
   * 旧因：`userPaused` 是整会话一个标志，关音乐置上它，金句开头那句 `if (userPaused) pause()`
   *       就把金句一起停了；而且「音乐停后把金句升为主轨」的恢复路径要求它为 false，
   *       恢复也被同一个标志堵死。
   * 新模型：userPaused 属于各自那一路。
   */
  @Test
  fun `pausing music does not pause verse`() {
    val s = reduce(playVerse(playMusic()), Intent.Pause(StreamId.MUSIC))

    assertTrue(s.music.userPaused)
    assertFalse(s.verse.userPaused)
    assertEquals(setOf(StreamId.VERSE), s.audibleStreams())
  }

  /**
   * 现象：原生刚接上新句 0.9 秒，就被换成另一句。
   * 证据：`chain next=PRO-3-14` → 0.9s → `playing ISA-58-10`。
   * 旧因：原生自接后 JS 仍拿着上一句，例行同步把它顶掉——两个写入方各有一份答案。
   * 新模型：原生用 NativeAdvanced 回报事实，它就是唯一真相。
   */
  @Test
  fun `native advance is the source of truth`() {
    val s0 = reduce(PlaybackState(), Intent.Play(StreamId.VERSE, "A.mp3", queue = listOf("B.mp3", "C.mp3")))
    val s1 = reduce(s0, Intent.NativeAdvanced(StreamId.VERSE, "B.mp3"))

    assertEquals("B.mp3", s1.verse.uri)
    assertEquals(listOf("C.mp3"), s1.verse.queue)
    assertEquals(0.0, s1.verse.positionSec)
  }

  /**
   * 现象：播着音乐进读经页点播放 → 毫无反应，日志里连一条 scripture 都没有。
   * 旧因在 JS（按钮的图标判断 playbackMode+playing，点击处理只判断 playing），
   * 这里守住模型侧：开读经必须让音乐让位，且读经确实要响。
   */
  @Test
  fun `starting scripture while music plays takes over`() {
    val s = reduce(playMusic(), Intent.Play(StreamId.SCRIPTURE, "GEN-1.mp3"))

    assertEquals(setOf(StreamId.SCRIPTURE), s.audibleStreams())
    assertFalse(s.music.wantPlaying)
    /** 音乐的音轨要留着，回头还能续播。 */
    assertEquals("song.mp3", s.music.uri)
  }

  /** 读经与金句都是人声，不能叠。 */
  @Test
  fun `scripture and verse are exclusive both ways`() {
    val a = reduce(playVerse(PlaybackState()), Intent.Play(StreamId.SCRIPTURE, "GEN-1.mp3"))
    assertEquals(setOf(StreamId.SCRIPTURE), a.audibleStreams())

    val b = reduce(a, Intent.Play(StreamId.VERSE, "PSA-1-1.mp3"))
    assertEquals(setOf(StreamId.VERSE), b.audibleStreams())
  }

  // ---------------------------------------------------------------- 系统事件

  /** 来电：全停，但不算用户暂停，挂断后应自己回来。 */
  @Test
  fun `system interrupt silences everything without marking user pause`() {
    val playing = playVerse(playMusic())
    val during = reduce(playing, Intent.SystemInterrupt(true))
    assertTrue(during.audibleStreams().isEmpty())
    assertFalse(during.music.userPaused)
    assertFalse(during.verse.userPaused)

    val after = reduce(during, Intent.SystemInterrupt(false))
    assertEquals(setOf(StreamId.MUSIC, StreamId.VERSE), after.audibleStreams())
  }

  /** 锁屏暂停键：在响的都停；没在响的不该被标记，否则下次开播还要先清一遍。 */
  @Test
  fun `pause all only marks audible streams`() {
    val s = reduce(playVerse(playMusic()), Intent.PauseAll)

    assertTrue(s.music.userPaused)
    assertTrue(s.verse.userPaused)
    assertFalse(s.scripture.userPaused)
    assertTrue(s.audibleStreams().isEmpty())
  }

  @Test
  fun `resume brings back only that stream`() {
    val paused = reduce(playVerse(playMusic()), Intent.PauseAll)
    val s = reduce(paused, Intent.Resume(StreamId.VERSE))

    assertEquals(setOf(StreamId.VERSE), s.audibleStreams())
    assertTrue(s.music.userPaused)
  }

  /**
   * 互斥的一路在响时，续播另一路不生效。
   * 真机账本：开读经后 JS 补发的 resumeAppMusic() 让音乐挤回来与读经同响。
   */
  @Test
  fun `resume is ignored while an exclusive stream is audible`() {
    val s0 = reduce(playMusic(), Intent.Pause(StreamId.MUSIC))
    val s1 = reduce(s0, Intent.Play(StreamId.SCRIPTURE, "GEN-1.mp3"))
    val s2 = reduce(s1, Intent.Resume(StreamId.MUSIC))

    assertEquals(setOf(StreamId.SCRIPTURE), s2.audibleStreams())
  }

  /** 但金句与音乐不互斥，续播金句不该被音乐挡住。 */
  @Test
  fun `resume works across non exclusive streams`() {
    val s0 = reduce(playVerse(playMusic()), Intent.Pause(StreamId.VERSE))
    val s1 = reduce(s0, Intent.Resume(StreamId.VERSE))

    assertEquals(setOf(StreamId.MUSIC, StreamId.VERSE), s1.audibleStreams())
  }

  @Test
  fun `stop clears the stream completely`() {
    val s = reduce(playVerse(playMusic()), Intent.Stop(StreamId.VERSE))

    assertEquals(StreamState(), s.verse)
    assertEquals(setOf(StreamId.MUSIC), s.audibleStreams())
  }

  @Test
  fun `sleep timer stops every stream`() {
    val s = reduce(playVerse(playMusic()), Intent.SleepTimerFired)
    assertTrue(s.audibleStreams().isEmpty())
    assertTrue(StreamId.entries.all { s[it].userPaused })
  }

  // ---------------------------------------------------------------- 通知栏归属

  /** 金句叠在音乐上时不该抢标题，否则通知栏每十几秒跳一次。 */
  @Test
  fun `verse under music does not take the notification`() {
    val s = playVerse(playMusic())
    val np = nowPlaying(s)!!

    assertEquals(StreamId.MUSIC, np.stream)
    assertEquals("曙光", np.title)
    assertTrue(np.playing)
  }

  @Test
  fun `scripture outranks music in the notification`() {
    val s = reduce(playMusic(), Intent.Play(StreamId.SCRIPTURE, "GEN-1.mp3", title = "创世记 1"))
    assertEquals(StreamId.SCRIPTURE, nowPlaying(s)!!.stream)
  }

  /** 全停后仍要显示最后的音轨，锁屏上才有得可续播。 */
  @Test
  fun `notification keeps the last track after pausing`() {
    val np = nowPlaying(reduce(playMusic(), Intent.PauseAll))!!

    assertEquals(StreamId.MUSIC, np.stream)
    assertFalse(np.playing)
  }

  @Test
  fun `nothing playing and nothing loaded shows no notification`() {
    assertNull(nowPlaying(PlaybackState()))
  }

  // ---------------------------------------------------------------- 其它

  /** 没有音轨就不该算在响——旧代码曾把 uri="null" 的字符串当路径送进 MediaPlayer。 */
  @Test
  fun `want playing without a uri is not audible`() {
    val s = PlaybackState(music = StreamState(wantPlaying = true, uri = null))
    assertTrue(s.audibleStreams().isEmpty())
  }

  /** 重新点播要清掉自己的暂停标记，否则「暂停后再点播放」点不动。 */
  @Test
  fun `play clears its own paused flag`() {
    val paused = reduce(playMusic(), Intent.Pause(StreamId.MUSIC))
    val s = reduce(paused, Intent.Play(StreamId.MUSIC, "song.mp3"))

    assertFalse(s.music.userPaused)
    assertEquals(setOf(StreamId.MUSIC), s.audibleStreams())
  }

  @Test
  fun `ended clears the track but leaves the stream usable`() {
    val s = reduce(playMusic(), Intent.Ended(StreamId.MUSIC))

    assertNull(s.music.uri)
    assertTrue(s.audibleStreams().isEmpty())
    assertFalse(s.music.userPaused)
  }
}
