import XCTest
@testable import PlaybackModel

/**
 与 Android 侧 `PlaybackModelTest.kt` **同一组用例**。两边行为必须一致：改了一边就同步另一边。

 前半部分是 2026-09-07~08 在三星 S23 Ultra 上用 logcat 逐个定位到的真实故障。
 iOS 的旧实现（`AskBibleMusicService`，1956 行）有同构的共享标志，同样的坑迟早会踩到；
 这些用例把它们钉死在结构层面。
 */
final class PlaybackModelTests: XCTestCase {

  private func playMusic(_ state: PlaybackState = PlaybackState(), uri: String = "song.mp3") -> PlaybackState {
    reduce(state, .play(stream: .music, uri: uri, title: "曙光"))
  }

  private func playVerse(_ state: PlaybackState, uri: String = "PSA-23-1.mp3") -> PlaybackState {
    reduce(state, .play(stream: .verse, uri: uri, queue: ["JHN-3-16.mp3"]))
  }

  // MARK: - 回归：那一晚的六个

  /// 金句在放，点音乐 → 两路都该响。旧实现里后开的那路会把先开的踢掉。
  func testMusicAndVersePlayTogether() {
    XCTAssertEqual(playVerse(playMusic()).audibleStreams, [.music, .verse])
  }

  /// 点另一首音乐不该碰到金句。旧实现共用一个无主的「强制重开」标志。
  func testSwitchingMusicLeavesVerseUntouched() {
    let before = playVerse(playMusic(), uri: "PSA-139-13.mp3")
    let after = reduce(before, .play(stream: .music, uri: "另一首.mp3", title: "柔光之下"))

    XCTAssertEqual(before.verse, after.verse)
    XCTAssertEqual(after.music.uri, "另一首.mp3")
    XCTAssertTrue(after.audibleStreams.contains(.verse))
  }

  /// 关音乐只暂停音乐。旧实现置的是全局 userPaused，金句被连坐停掉、按钮还亮着。
  func testPausingMusicDoesNotPauseVerse() {
    let s = reduce(playVerse(playMusic()), .pause(.music))

    XCTAssertTrue(s.music.userPaused)
    XCTAssertFalse(s.verse.userPaused)
    XCTAssertEqual(s.audibleStreams, [.verse])
  }

  /// 播放器自接的下一条就是真相，JS 的滞后答案不得覆盖。
  func testNativeAdvanceIsSourceOfTruth() {
    let s0 = reduce(PlaybackState(), .play(stream: .verse, uri: "A.mp3", queue: ["B.mp3", "C.mp3"]))
    let s1 = reduce(s0, .nativeAdvanced(.verse, "B.mp3"))

    XCTAssertEqual(s1.verse.uri, "B.mp3")
    XCTAssertEqual(s1.verse.queue, ["C.mp3"])
    XCTAssertEqual(s1.verse.positionSec, 0)
  }

  /// 播着音乐开读经：读经接管，音乐让位但保留音轨以便回头续播。
  func testScriptureOverMusicTakesOver() {
    let s = reduce(playMusic(), .play(stream: .scripture, uri: "GEN-1.mp3"))

    XCTAssertEqual(s.audibleStreams, [.scripture])
    XCTAssertFalse(s.music.wantPlaying)
    XCTAssertEqual(s.music.uri, "song.mp3")
  }

  /// 读经与金句都是人声，两个方向都互斥。
  func testScriptureAndVerseExclusiveBothWays() {
    let a = reduce(playVerse(PlaybackState()), .play(stream: .scripture, uri: "GEN-1.mp3"))
    XCTAssertEqual(a.audibleStreams, [.scripture])

    let b = reduce(a, .play(stream: .verse, uri: "PSA-1-1.mp3"))
    XCTAssertEqual(b.audibleStreams, [.verse])
  }

  // MARK: - 系统事件

  /// 来电：全停，但不算用户暂停，挂断后自己回来。
  func testSystemInterruptDoesNotMarkUserPause() {
    let playing = playVerse(playMusic())
    let during = reduce(playing, .systemInterrupt(true))
    XCTAssertTrue(during.audibleStreams.isEmpty)
    XCTAssertFalse(during.music.userPaused)

    let after = reduce(during, .systemInterrupt(false))
    XCTAssertEqual(after.audibleStreams, [.music, .verse])
  }

  func testPauseAllOnlyMarksAudible() {
    let s = reduce(playVerse(playMusic()), .pauseAll)

    XCTAssertTrue(s.music.userPaused)
    XCTAssertTrue(s.verse.userPaused)
    XCTAssertFalse(s.scripture.userPaused)
    XCTAssertTrue(s.audibleStreams.isEmpty)
  }

  /// 单独续播一路时，别的暂停中的流要留在暂停状态。
  func testResumeBringsBackOnlyThatStream() {
    let paused = reduce(playVerse(playMusic()), .pauseAll)
    let s = reduce(paused, .resume(.verse))

    XCTAssertEqual(s.audibleStreams, [.verse])
    XCTAssertTrue(s.music.userPaused)
  }

  /// 播放键只恢复暂停键停掉的那几路，手动关掉的那路要留在关闭状态。
  func testTransportResumeRestoresOnlyWhatItPaused() {
    let musicOff = reduce(playMusic(), .pause(.music))
    let scripture = reduce(musicOff, .play(stream: .scripture, uri: "GEN-1.mp3"))
    let resumed = reduce(reduce(scripture, .pauseAll), .resumeTransport)

    XCTAssertEqual(resumed.audibleStreams, [.scripture])
  }

  func testTransportResumeBringsBackMixedStreams() {
    let both = playVerse(playMusic())
    let resumed = reduce(reduce(both, .pauseAll), .resumeTransport)

    XCTAssertEqual(resumed.audibleStreams, [.music, .verse])
  }

  /// 互斥的一路在响时，续播另一路不生效。
  func testResumeIgnoredWhileExclusiveAudible() {
    let s0 = reduce(playMusic(), .pause(.music))
    let s1 = reduce(s0, .play(stream: .scripture, uri: "GEN-1.mp3"))
    let s2 = reduce(s1, .resume(.music))

    XCTAssertEqual(s2.audibleStreams, [.scripture])
  }

  func testResumeWorksAcrossNonExclusiveStreams() {
    let s0 = reduce(playVerse(playMusic()), .pause(.verse))
    XCTAssertEqual(reduce(s0, .resume(.verse)).audibleStreams, [.music, .verse])
  }

  func testStopClearsTheStream() {
    let s = reduce(playVerse(playMusic()), .stop(.verse))

    XCTAssertEqual(s.verse, StreamState())
    XCTAssertEqual(s.audibleStreams, [.music])
  }

  func testSleepTimerStopsEverything() {
    let s = reduce(playVerse(playMusic()), .sleepTimerFired)
    XCTAssertTrue(s.audibleStreams.isEmpty)
    XCTAssertTrue(StreamId.allCases.allSatisfy { s[$0].userPaused })
  }

  // MARK: - 锁屏归属

  /// 金句叠在音乐上时不该抢标题，否则锁屏每十几秒跳一次。
  func testVerseUnderMusicDoesNotTakeTheLockScreen() {
    let np = nowPlaying(playVerse(playMusic()))!

    XCTAssertEqual(np.stream, .music)
    XCTAssertEqual(np.title, "曙光")
    XCTAssertTrue(np.playing)
  }

  func testScriptureOutranksMusic() {
    let s = reduce(playMusic(), .play(stream: .scripture, uri: "GEN-1.mp3", title: "创世记 1"))
    XCTAssertEqual(nowPlaying(s)!.stream, .scripture)
  }

  func testLockScreenKeepsLastTrackAfterPause() {
    let np = nowPlaying(reduce(playMusic(), .pauseAll))!

    XCTAssertEqual(np.stream, .music)
    XCTAssertFalse(np.playing)
  }

  func testNothingLoadedShowsNothing() {
    XCTAssertNil(nowPlaying(PlaybackState()))
  }

  // MARK: - 其它

  func testWantPlayingWithoutUriIsNotAudible() {
    var s = PlaybackState()
    s.music.wantPlaying = true
    XCTAssertTrue(s.audibleStreams.isEmpty)
  }

  func testPlayClearsItsOwnPausedFlag() {
    let paused = reduce(playMusic(), .pause(.music))
    let s = reduce(paused, .play(stream: .music, uri: "song.mp3"))

    XCTAssertFalse(s.music.userPaused)
    XCTAssertEqual(s.audibleStreams, [.music])
  }

  func testEndedClearsTrackButLeavesStreamUsable() {
    let s = reduce(playMusic(), .ended(.music))

    XCTAssertNil(s.music.uri)
    XCTAssertTrue(s.audibleStreams.isEmpty)
    XCTAssertFalse(s.music.userPaused)
  }
}

/// JS 载荷翻译层，与 Android 侧 `JsIntentTest.kt` 同一组用例。
final class JsIntentTests: XCTestCase {

  private func sync(
    _ kind: String,
    playing: Bool = true,
    userPlay: Bool = false,
    userPause: Bool = false,
    asset: String? = nil,
    next: [String] = []
  ) -> JsPayload {
    JsPayload(
      kind: kind, playing: playing, userPlay: userPlay, userPause: userPause,
      assetUri: asset, nextUris: next
    )
  }

  func testUserPlayStartsThatStream() {
    let intents = intentsFor(sync("music", userPlay: true, asset: "a.mp3"), PlaybackState())
    guard case let .play(stream, uri, _, _, _, _, _, _, _) = intents.first else {
      return XCTFail("expected play, got \(intents)")
    }
    XCTAssertEqual(stream, .music)
    XCTAssertEqual(uri, "a.mp3")
  }

  func testUserPauseTargetsOnlyItsOwnStream() {
    XCTAssertEqual(
      intentsFor(sync("music", playing: false, userPause: true), PlaybackState()),
      [.pause(.music)]
    )
  }

  /// 保活同步不得改变正在播的音轨。
  func testKeepaliveCannotChangeCurrentTrack() {
    let playing = reduce(PlaybackState(), .play(stream: .verse, uri: "PRO-3-14.mp3"))
    let intents = intentsFor(sync("verse", asset: "ISA-58-10.mp3"), playing)
    let after = intents.reduce(playing) { reduce($0, $1) }

    XCTAssertEqual(after.verse.uri, "PRO-3-14.mp3")
  }

  func testKeepaliveMayRefillQueue() {
    let playing = reduce(PlaybackState(), .play(stream: .verse, uri: "A.mp3"))
    XCTAssertEqual(
      intentsFor(sync("verse", asset: "A.mp3", next: ["B.mp3"]), playing),
      [.setQueue(.verse, ["B.mp3"])]
    )
  }

  func testKeepaliveDoesNotResurrectStoppedStream() {
    let stopped = PlaybackState()
    let after = intentsFor(sync("music", asset: "a.mp3"), stopped).reduce(stopped) { reduce($0, $1) }
    XCTAssertTrue(after.audibleStreams.isEmpty)
  }

  func testLiteralNullAssetRejected() {
    XCTAssertTrue(intentsFor(sync("music", userPlay: true, asset: "null"), PlaybackState()).isEmpty)
    XCTAssertTrue(intentsFor(sync("music", userPlay: true, asset: "  "), PlaybackState()).isEmpty)
  }

  func testUnknownKindIgnored() {
    XCTAssertTrue(intentsFor(sync("ambient", userPlay: true, asset: "a.mp3"), PlaybackState()).isEmpty)
  }

  /// 完整重放：音乐 → 金句叠加 → 换音乐 → 关音乐，金句全程不受影响。
  func testReplayOfReportedFailureSequence() {
    var s = PlaybackState()
    func apply(_ p: JsPayload) { s = intentsFor(p, s).reduce(s) { reduce($0, $1) } }

    apply(sync("music", userPlay: true, asset: "song1.mp3"))
    apply(sync("verse", userPlay: true, asset: "PSA-23-1.mp3", next: ["JHN-3-16.mp3"]))
    XCTAssertEqual(s.audibleStreams, [.music, .verse])

    apply(sync("music", userPlay: true, asset: "song2.mp3"))
    XCTAssertEqual(s.verse.uri, "PSA-23-1.mp3")

    apply(sync("music", playing: false, userPause: true))
    XCTAssertEqual(s.audibleStreams, [.verse])
  }
}
