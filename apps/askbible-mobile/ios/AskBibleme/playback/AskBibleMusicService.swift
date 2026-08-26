import AVFoundation
import CallKit
import MediaPlayer
import UIKit
import Darwin

extension Notification.Name {
  /// JS/Expo → App：更新/开播音乐 payload（userInfo 即 session dict）
  static let askBibleMusicApply = Notification.Name("me.askbible.music.apply")
  /// JS/Expo → App：暂停（keep engine）
  static let askBibleMusicPause = Notification.Name("me.askbible.music.pause")
  /// JS/Expo → App：继续
  static let askBibleMusicResume = Notification.Name("me.askbible.music.resume")
  /// JS/Expo → App：停止并拆除
  static let askBibleMusicStop = Notification.Name("me.askbible.music.stop")
  /// JS → App：读经语速（userInfo.rate）
  static let askBibleMusicSetRate = Notification.Name("me.askbible.music.setRate")
  /// JS → App：主轨跳转到秒（userInfo.positionSec）；勿走 apply，否则同曲会忽略新位置
  static let askBibleMusicSeek = Notification.Name("me.askbible.music.seek")
  /// JS → App：音乐基准音量（userInfo.volume，0…1）；金句 duck 在此之上再压
  static let askBibleMusicSetVolume = Notification.Name("me.askbible.music.setVolume")
  /// App → Expo：事件（userInfo: name, body）
  static let askBibleMusicEvent = Notification.Name("me.askbible.music.event")
  /// Expo → App：睡眠定时到点，停主轨 + 金句
  static let askBibleSleepTimerFire = Notification.Name("me.askbible.music.sleepTimer")
}

/// App 主工程拥有的音乐引擎（与 Expo module 生命周期解耦）。
/// 长本地曲目用 AVPlayer 流式读盘（AVAudioPlayer contentsOf 会把整文件如 32MB 进内存，锁屏易 jetsam）。
@objc(AskBibleMusicService)
final class AskBibleMusicService: NSObject {
  @objc static let shared = AskBibleMusicService()

  private var player: AVPlayer?
  private var endObserver: NSObjectProtocol?
  private var statusObservation: NSKeyValueObservation?
  private var boundaryObserver: Any?
  /// 读经跟读：按 AVPlayer 媒体时钟密报进度，勿只靠 2s Timer。
  private var progressObserver: Any?
  private var assetUri: String?
  /// 金句独立轨：与音乐主轨混播（音乐压到 0.3），避免抢同一个 AVPlayer。
  private var versePlayer: AVPlayer?
  private var verseEndObserver: NSObjectProtocol?
  private var verseAssetUri: String?
  private var lastVersePayload: [String: Any]?
  private var versePhase = "content" // content | gap
  /// 与 JS payload 解耦：避免 aux 刷新丢掉 gap/next 后金句约 1 分钟断播。
  private var verseGapSec: Double = 5
  private var verseGapAssetUri: String?
  private var verseNextQueue: [String] = []
  /// 读经章间接播：与金句同款浅队列，降低后台 JS 挂起时断播。
  private var scriptureNextQueue: [String] = []
  private var healthTimer: Timer?
  private var refreshTimer: Timer?
  private var gapTimer: Timer?
  private var verseBgTask = UIBackgroundTaskIdentifier.invalid
  private var scriptureBgTask = UIBackgroundTaskIdentifier.invalid
  private var lifecycleObservers: [NSObjectProtocol] = []
  private var remoteRegistered = false
  private var userPaused = false
  /// 来电或系统音频打断：停播但保留用户「想听」，结束后才续。
  private var audioSessionInterrupted = false
  private var phoneCallActive = false
  private var systemInterrupted: Bool { audioSessionInterrupted || phoneCallActive }
  private let callObserver = CXCallObserver()
  private var wantPlaying = false
  private var lastPayload: [String: Any]?
  private var contentKind = "music"
  /// 读经语速。AVPlayer.play() 会回到 defaultRate=1，必须自己记住并写回。
  private var scriptureRate: Double = 1
  /// 跳转未完成时勿发旧进度，否则 JS 进度轴会弹回。
  private var seeking = false
  private var phase = "content" // content | gap（主轨：音乐/读经）
  private var sessionArmed = false
  private var appInBackground = false
  private let musicDuckWhileVerse: Float = 0.3
  /// 专辑基准音量（JS setMusicGain 写下来，如睡眠专辑 0.3）。
  private var musicBaseVolume: Float = 1
  private var cachedArtwork: MPMediaItemArtwork?
  private var cachedArtworkUri: String?
  private var lastBgLogAt: TimeInterval = 0
  private let logName = "askbible-shell-media.log"
  private let wantKey = "askbible.nativeMusicWantPlaying"
  private let verseWantKey = "askbible.nativeVerseWantPlaying"
  private let scriptureWantKey = "askbible.nativeScriptureWantPlaying"
  private let posKey = "askbible.nativeMusicPositionSec"
  private let uriKey = "askbible.nativeMusicUri"

  private override init() {
    super.init()
  }

  @objc func bootstrap() {
    // 冷启动清除上次 wantPlaying，避免一打开就自动出声（与 JS playing=false 互殴）。
    UserDefaults.standard.set(false, forKey: wantKey)
    UserDefaults.standard.set(false, forKey: verseWantKey)
    UserDefaults.standard.set(false, forKey: scriptureWantKey)
    wantPlaying = false
    // 勿在冷启动标 userPaused：否则点音乐时壳层先推 playing=true（无 userPlay）会被丢掉，只剩黄标。
    // 不自动出声靠 wantKey=false + lastPayload.playing=false + isWantingPlayback 不含预加载。
    userPaused = false
    contentKind = "music"
    phase = "content"
    if var payload = lastPayload {
      payload["playing"] = false
      lastPayload = payload
    }
    registerCommandObservers()
    registerLifecycle()
    ensureRemoteCommands()
    callObserver.setDelegate(self, queue: .main)
    phoneCallActive = callObserver.calls.contains { !$0.hasEnded }
    activateSession(force: true)
    log("app music service bootstrap (cold silent)")
  }

  /// 主轨（音乐 / 读经）是否要播。金句有独立 versePlayer，不得算进这里。
  /// 也不看 lastPayload.playing：预加载曲目是 playing=false，一旦被写成 true
  /// 点金句 ensureAlive / heartbeat 就会把安静专辑拉起来。
  private var isWantingPlayback: Bool {
    wantPlaying
      || UserDefaults.standard.bool(forKey: wantKey)
      || UserDefaults.standard.bool(forKey: scriptureWantKey)
  }

  private func normalizedKind(_ raw: String) -> String {
    switch raw.lowercased() {
    case "verse": return "verse"
    case "scripture": return "scripture"
    case "ambient": return "ambient"
    default: return "music"
    }
  }

  private func setWantKeysForKind(_ kind: String, on: Bool) {
    // 音乐与金句可同时 want（混播）；读经与二者互斥。
    switch kind {
    case "music":
      UserDefaults.standard.set(on, forKey: wantKey)
      if on { UserDefaults.standard.set(false, forKey: scriptureWantKey) }
    case "verse":
      UserDefaults.standard.set(on, forKey: verseWantKey)
      if on { UserDefaults.standard.set(false, forKey: scriptureWantKey) }
    case "scripture":
      UserDefaults.standard.set(on, forKey: scriptureWantKey)
      if on {
        UserDefaults.standard.set(false, forKey: wantKey)
        UserDefaults.standard.set(false, forKey: verseWantKey)
      }
    default:
      break
    }
  }

  private func clearAllWantKeys() {
    UserDefaults.standard.set(false, forKey: wantKey)
    UserDefaults.standard.set(false, forKey: verseWantKey)
    UserDefaults.standard.set(false, forKey: scriptureWantKey)
  }

  private var isVerseWanting: Bool {
    UserDefaults.standard.bool(forKey: verseWantKey)
  }

  private var isVersePlaying: Bool {
    guard let versePlayer else { return false }
    return isPlayerActivelyPlaying(versePlayer)
  }

  private func syncMusicDuckForVerse() {
    guard let player else { return }
    guard contentKind == "music" else {
      player.volume = 1
      return
    }
    let duck = isVerseWanting && versePlayer != nil
    player.volume = duck ? min(musicDuckWhileVerse, musicBaseVolume) : musicBaseVolume
  }

  private func setMusicBaseVolume(_ raw: Double) {
    let next = Float(max(0, min(1, raw)))
    guard abs(next - musicBaseVolume) > 0.001 else { return }
    musicBaseVolume = next
    syncMusicDuckForVerse()
  }

  /// AppDelegate 进后台时同步调用：抢回 playback 会话并续播（勿等 JS/视频卸除）。
  @objc func prepareForBackground() {
    appInBackground = true
    if systemInterrupted {
      pause(userInitiated: false)
      pauseVerse(userInitiated: false)
      log("prepareForBackground skip systemInterrupted")
      return
    }
    let verseNeeds = isVerseWanting
    let musicNeeds = !userPaused && isWantingPlayback
    guard verseNeeds || musicNeeds else {
      if userPaused {
        log("prepareForBackground skip userPaused bgRemaining=\(bgRemainingLabel())")
      }
      return
    }
    activateSession(force: sessionLooksWrong(AVAudioSession.sharedInstance()))
    UIApplication.shared.beginReceivingRemoteControlEvents()
    // 后台：停掉所有 Timer / 写盘心跳。保活只靠 AVPlayer + audio background mode。
    healthTimer?.invalidate()
    healthTimer = nil
    refreshTimer?.invalidate()
    refreshTimer = nil
    // 后台勿再向 JS 密报进度：高频桥曾拖死进程。
    removeScriptureProgressObserver()
    if verseNeeds {
      if let versePlayer {
        if !isPlayerActivelyPlaying(versePlayer) { versePlayer.play() }
      } else if let payload = lastVersePayload {
        beginOrResumeVerse(payload: payload)
      }
    }
    if musicNeeds {
      if let player {
        if !isPlayerActivelyPlaying(player) { playMain(player) }
        // 时长未进 Now Playing 时勿 lightweight：系统会当短音频，约 60s 掐后台。
        let durReady = duration > 1
        if !durReady {
          refreshDurationIntoPayload()
        }
        publishNowPlaying(
          playing: isPlayerActivelyPlaying(player) || isVersePlaying,
          lightweight: durReady
        )
        persist(currentTime)
        log(
          "app music prepareForBackground playing=\(isPlayerActivelyPlaying(player)) verse=\(isVersePlaying) t=\(currentTime) dur=\(duration) kind=\(contentKind) bgRemaining=\(bgRemainingLabel()) quarantine=1 lowPower=\(ProcessInfo.processInfo.isLowPowerModeEnabled) rssMB=\(residentMemoryMB()) engine=AVPlayer"
        )
      } else if let payload = lastPayload, contentKind != "verse" {
        beginOrResume(payload: payload)
        healthTimer?.invalidate()
        healthTimer = nil
        refreshTimer?.invalidate()
        refreshTimer = nil
      }
    } else if verseNeeds {
      publishNowPlaying(playing: isVersePlaying, lightweight: false)
      log("app verse prepareForBackground playing=\(isVersePlaying) bgRemaining=\(bgRemainingLabel())")
    }
    syncMusicDuckForVerse()
    URLCache.shared.removeAllCachedResponses()
  }

  private func residentMemoryMB() -> String {
    var info = mach_task_basic_info()
    var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size) / 4
    let kr = withUnsafeMutablePointer(to: &info) {
      $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
        task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
      }
    }
    guard kr == KERN_SUCCESS else { return "?" }
    return String(format: "%.0f", Double(info.resident_size) / 1_048_576.0)
  }

  // MARK: - Commands from Expo

  private func registerCommandObservers() {
    let center = NotificationCenter.default
    center.addObserver(forName: .askBibleMusicApply, object: nil, queue: .main) { [weak self] note in
      guard let payload = note.userInfo as? [String: Any] else { return }
      self?.apply(payload: payload)
    }
    center.addObserver(forName: .askBibleMusicPause, object: nil, queue: .main) { [weak self] _ in
      self?.pause(userInitiated: true)
    }
    center.addObserver(forName: .askBibleMusicResume, object: nil, queue: .main) { [weak self] note in
      let user = (note.userInfo?["userInitiated"] as? Bool) ?? false
      self?.resume(userInitiated: user)
    }
    center.addObserver(forName: .askBibleMusicStop, object: nil, queue: .main) { [weak self] note in
      let reason = note.userInfo?["reason"] as? String ?? "stop"
      self?.stop(reason: reason)
    }
    center.addObserver(forName: .askBibleMusicSetRate, object: nil, queue: .main) { [weak self] note in
      self?.setScriptureRate(self?.doubleValue(note.userInfo?["rate"]) ?? 1)
    }
    center.addObserver(forName: .askBibleMusicSetVolume, object: nil, queue: .main) { [weak self] note in
      self?.setMusicBaseVolume(self?.doubleValue(note.userInfo?["volume"]) ?? 1)
    }
    center.addObserver(forName: .askBibleMusicSeek, object: nil, queue: .main) { [weak self] note in
      self?.seekMain(toSec: self?.doubleValue(note.userInfo?["positionSec"]) ?? 0)
    }
    center.addObserver(forName: .askBibleSleepTimerFire, object: nil, queue: .main) { [weak self] _ in
      self?.pause(userInitiated: true)
      self?.pauseVerse(userInitiated: true)
      self?.clearAllWantKeys()
    }
  }

  private func apply(payload: [String: Any]) {
    let playing = boolValue(payload["playing"])
    let userPause = boolValue(payload["userPause"])
    let userPlay = boolValue(payload["userPlay"])
    let kind = normalizedKind((payload["kind"] as? String) ?? "music")
    if kind == "scripture" {
      rememberScriptureRate(from: payload)
    }

    // 环境音走 expo-av，勿占主轨、勿把首页预加载曲目拉起来。
    if kind == "ambient" {
      log("ignore ambient payload playing=\(playing)")
      return
    }

    // 金句：独立轨，不拆音乐主轨。
    if kind == "verse" {
      let merged = mergeVersePayload(payload)
      // 用户点播 / 新开一句：先清空残留 nextNext，再按本次 payload 重建。
      if userPlay, let uri = (merged["assetUri"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
         !uri.isEmpty,
         musicIdentity(uri) != musicIdentity(verseAssetUri ?? "") {
        verseNextQueue.removeAll()
      }
      lastVersePayload = merged
      ingestVerseQueue(from: merged)
      if !playing {
        pauseVerse(userInitiated: userPause)
        return
      }
      setWantKeysForKind("verse", on: true)
      // 间隔中：勿被 music/aux 的残缺 verse 刷新打断；只吸收下一句 URI。
      if versePhase == "gap" {
        if userPlay, let uri = merged["assetUri"] as? String, !uri.isEmpty,
           musicIdentity(uri) != musicIdentity(verseAssetUri ?? "") {
          gapTimer?.invalidate()
          gapTimer = nil
          versePhase = "content"
          beginOrResumeVerse(payload: merged)
        } else {
          log("app verse gap: absorb next only queue=\(verseNextQueue.count)")
        }
        syncMusicDuckForVerse()
        return
      }
      // 句中预取/文案同步：无 userPlay 时禁止用另一路径 URI 顶掉正在播的句（点播抽条 vs 整包）。
      if let uri = merged["assetUri"] as? String, !uri.isEmpty,
         let versePlayer, isPlayerActivelyPlaying(versePlayer),
         !userPlay,
         musicIdentity(uri) != musicIdentity(verseAssetUri ?? "") {
        log("app verse: ignore mid-play asset swap queue=\(verseNextQueue.count)")
        syncMusicDuckForVerse()
        return
      }
      // 队列/元数据同步（无 userPlay）：播放器已在句中则勿 beginOrResume（缓冲期 rate=0 也会被误判重建）。
      if !userPlay, versePhase == "content", let versePlayer, versePlayer.currentItem != nil {
        let uri = (merged["assetUri"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let incomingId = uri.isEmpty ? nil : musicIdentity(uri)
        let currentId = musicIdentity(verseAssetUri ?? "")
        if incomingId == nil || incomingId == currentId || currentId == nil {
          if !uri.isEmpty && (verseAssetUri == nil || verseAssetUri?.isEmpty == true) {
            verseAssetUri = uri
          }
          if !isPlayerActivelyPlaying(versePlayer) {
            versePlayer.play()
          }
          syncMusicDuckForVerse()
          publishNowPlaying(playing: isPlaying || isVersePlaying, lightweight: appInBackground)
          log("app verse metadata/queue sync skip beginOrResume")
          return
        }
      }
      beginOrResumeVerse(payload: merged)
      syncMusicDuckForVerse()
      return
    }

    lastPayload = payload
    contentKind = kind
    if !playing {
      if userPause || userPaused {
        pause(userInitiated: true)
        return
      }
      if player != nil || isWantingPlayback {
        if systemInterrupted {
          log("keep paused while systemInterrupted kind=\(contentKind)")
          return
        }
        log("ignore js pause while app audio want/alive kind=\(contentKind)")
        var restored = payload
        restored["playing"] = true
        lastPayload = restored
        ensureAlive(reason: "ignore-js-pause")
        return
      }
      return
    }
    if userPaused && !userPlay {
      log("ignore js play while userPaused")
      return
    }
    // 读经开播：停金句（人声互斥）。音乐开播：保留金句并压音。
    if kind == "scripture" {
      stopVerse(reason: "scripture-start")
      // 用户显式点播换章：清掉旧下一章队列，避免仍按上一章的预取续播。
      if userPlay, let uri = (payload["assetUri"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
         !uri.isEmpty,
         musicIdentity(uri) != musicIdentity(assetUri ?? "") {
        scriptureNextQueue.removeAll()
      }
      ingestScriptureQueue(from: payload)
    } else if kind == "music" {
      scriptureNextQueue.removeAll()
    }
    userPaused = false
    wantPlaying = true
    phase = "content"
    setWantKeysForKind(contentKind, on: true)
    beginOrResume(payload: payload)
    syncMusicDuckForVerse()
  }

  private func pause(userInitiated: Bool) {
    if userInitiated {
      userPaused = true
      wantPlaying = false
      // 只清主轨 want；金句可继续。
      UserDefaults.standard.set(false, forKey: wantKey)
      UserDefaults.standard.set(false, forKey: scriptureWantKey)
    }
    player?.pause()
    if var payload = lastPayload {
      payload["playing"] = false
      lastPayload = payload
    }
    publishNowPlaying(playing: isVersePlaying)
    log("app music paused user=\(userInitiated) t=\(currentTime) kind=\(contentKind)")
    emitProgress(playing: false)
  }

  private func pauseVerse(userInitiated: Bool) {
    gapTimer?.invalidate()
    gapTimer = nil
    versePhase = "content"
    if userInitiated {
      setWantKeysForKind("verse", on: false)
    }
    versePlayer?.pause()
    if var payload = lastVersePayload {
      payload["playing"] = false
      lastVersePayload = payload
    }
    syncMusicDuckForVerse()
    log("app verse paused user=\(userInitiated)")
  }

  private func stopVerse(reason: String) {
    gapTimer?.invalidate()
    gapTimer = nil
    versePhase = "content"
    setWantKeysForKind("verse", on: false)
    tearDownVersePlayer()
    lastVersePayload = nil
    verseNextQueue.removeAll()
    syncMusicDuckForVerse()
    log("app verse stop reason=\(reason)")
  }

  private func resume(userInitiated: Bool = false) {
    if systemInterrupted {
      log("ignore resume while systemInterrupted")
      return
    }
    if userPaused && !userInitiated {
      log("ignore resume while userPaused")
      return
    }
    userPaused = false
    wantPlaying = true
    setWantKeysForKind(contentKind, on: true)
    ensureAlive(reason: userInitiated ? "user-resume" : "resume")
  }

  private func stop(reason: String) {
    if reason == "js-null-payload" || reason == "unspecified" {
      log("refuse app music stop reason=\(reason)")
      if wantPlaying || player != nil || isVerseWanting {
        ensureAlive(reason: "refuse-stop-\(reason)")
      }
      return
    }
    let pos = currentTime
    stopVerse(reason: "stop-\(reason)")
    scriptureNextQueue.removeAll()
    endScriptureBackgroundTask(after: 0)
    tearDownPlayer()
    wantPlaying = false
    userPaused = false
    phase = "content"
    clearAllWantKeys()
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    if #available(iOS 13.0, *) {
      MPNowPlayingInfoCenter.default().playbackState = .stopped
    }
    log("app music stop reason=\(reason) pos=\(pos) kind=\(contentKind)")
    emit("ShellMediaNativeRelease", ["positionSec": pos, "reason": reason])
  }

  // MARK: - Playback

  private var isPlaying: Bool {
    guard let player else { return false }
    return isPlayerActivelyPlaying(player)
  }

  private func isPlayerActivelyPlaying(_ player: AVPlayer) -> Bool {
    player.rate > 0.01 && player.error == nil
  }

  private func rememberScriptureRate(from payload: [String: Any]?) {
    guard let payload, payload["rate"] != nil, let value = doubleValue(payload["rate"]) else { return }
    scriptureRate = max(0.5, min(2.0, value))
  }

  private func setScriptureRate(_ raw: Double) {
    scriptureRate = max(0.5, min(2.0, raw))
    if var payload = lastPayload, contentKind == "scripture" {
      payload["rate"] = scriptureRate
      lastPayload = payload
    }
    guard contentKind == "scripture", let player else {
      log("scripture setRate=\(scriptureRate) deferred (no player/kind)")
      return
    }
    applyStoredScriptureRate(to: player)
    log("scripture setRate=\(scriptureRate) playing=\(isPlayerActivelyPlaying(player))")
  }

  private func seekMain(toSec raw: Double) {
    guard let player else {
      log("seek skipped no player")
      return
    }
    let dur = duration
    guard dur > 0.05, raw.isFinite else {
      log("seek skipped dur=\(dur)")
      return
    }
    let t = min(max(0, raw), max(0, dur - 0.05))
    log("seek t=\(t) dur=\(dur) kind=\(contentKind)")
    seeking = true
    let seek = CMTime(seconds: t, preferredTimescale: 600)
    player.seek(to: seek, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] ok in
      guard let self else { return }
      self.seeking = false
      if !ok { self.log("seek failed t=\(t)") }
      if var payload = self.lastPayload {
        payload["positionSec"] = t
        self.lastPayload = payload
      }
      if self.contentKind == "scripture" {
        self.applyStoredScriptureRate(to: player)
      }
      let playing = self.isPlayerActivelyPlaying(player)
      self.emitProgress(playing: playing)
      self.publishNowPlaying(playing: playing, lightweight: false)
      if self.contentKind == "music" {
        self.persist(t)
      }
    }
  }

  private func applyStoredScriptureRate(to player: AVPlayer) {
    guard contentKind == "scripture" else { return }
    let rate = Float(scriptureRate)
    if #available(iOS 16.0, *) {
      player.defaultRate = rate
    }
    player.rate = rate
  }

  private func playMain(_ player: AVPlayer) {
    if contentKind == "scripture" {
      if #available(iOS 16.0, *) {
        player.defaultRate = Float(scriptureRate)
      }
      player.play()
      player.rate = Float(scriptureRate)
      return
    }
    player.play()
  }

  private var currentTime: Double {
    guard let player else { return 0 }
    let t = CMTimeGetSeconds(player.currentTime())
    return t.isFinite && t > 0 ? t : 0
  }

  private var duration: Double {
    if let item = player?.currentItem {
      let d = CMTimeGetSeconds(item.duration)
      if d.isFinite, d > 0 { return d }
    }
    return doubleValue(lastPayload?["durationSec"]) ?? 0
  }

  private func beginOrResume(payload: [String: Any]) {
    if systemInterrupted {
      pause(userInitiated: false)
      log("beginOrResume deferred systemInterrupted")
      return
    }
    guard let assetUri = payload["assetUri"] as? String, !assetUri.isEmpty else {
      log("app music skip: no assetUri")
      return
    }
    // TEMP：非首曲走 R2 HTTPS；本地 file 仍优先。
    guard let playURL = resolvePlayableMediaURL(assetUri) else {
      log("app music skip: bad uri")
      return
    }
    let remote = isRemoteMediaURL(playURL)
    if !remote {
      guard FileManager.default.fileExists(atPath: playURL.path) else {
        log("app music skip: missing \(playURL.path)")
        return
      }
    }

    var position = doubleValue(payload["positionSec"]) ?? 0
    let same = musicIdentity(assetUri) != nil && musicIdentity(assetUri) == musicIdentity(self.assetUri ?? "")
    if same, let player {
      position = currentTime
      if isPlayerActivelyPlaying(player) {
        rememberScriptureRate(from: payload)
        applyStoredScriptureRate(to: player)
        armTimers()
        publishNowPlaying(playing: true)
        return
      }
      activateSession(force: !sessionArmed)
      playMain(player)
      emit("ShellMediaNativeTakeover", ["positionSec": currentTime, "assetUri": assetUri])
      armTimers()
      publishNowPlaying(playing: true)
      log("app music resume t=\(currentTime) engine=AVPlayer")
      return
    }

    if player == nil, contentKind == "music" {
      let savedUri = UserDefaults.standard.string(forKey: uriKey) ?? ""
      let savedPos = UserDefaults.standard.double(forKey: posKey)
      if musicIdentity(assetUri) == musicIdentity(savedUri), savedPos > 1 {
        position = savedPos
      }
    }
    if let dur = doubleValue(payload["durationSec"]), dur > 0 {
      position = min(max(0, position), max(0, dur - 0.25))
    }

    tearDownPlayer()
    activateSession(force: true)
    ensureRemoteCommands()

    let item = AVPlayerItem(url: playURL)
    if contentKind == "scripture" {
      item.audioTimePitchAlgorithm = .timeDomain
    }
    // 本地长音频：限制前向缓冲，降低常驻内存。远程先少缓冲，尽快出声。
    item.preferredForwardBufferDuration = remote ? 8 : (contentKind == "scripture" ? 30 : 20)
    item.canUseNetworkResourcesForLiveStreamingWhilePaused = remote
    let next = AVPlayer(playerItem: item)
    next.automaticallyWaitsToMinimizeStalling = remote
    if #available(iOS 15.0, *) {
      next.audiovisualBackgroundPlaybackPolicy = .continuesIfPossible
    }

    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      self?.handlePlaybackEnded()
    }
    statusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
      guard let self else { return }
      if item.status == .failed {
        self.log("app music decode error: \(item.error?.localizedDescription ?? "?")")
        self.emit("ShellMediaNativeStopped", ["reason": "decode-error"])
        return
      }
      if item.status == .readyToPlay {
        self.refreshDurationIntoPayload()
        if self.isWantingPlayback || self.isPlaying {
          self.emitProgress(playing: true)
          self.publishNowPlaying(playing: true, lightweight: false)
          self.log("app music item ready dur=\(self.duration) kind=\(self.contentKind)")
        }
      }
    }

    // 本地文件先探时长写入 payload，避免锁屏 Now Playing 无 duration 被系统约 60s 掐掉。
    if !remote, let probed = probeFileDuration(playURL), probed > 1 {
      if var p = lastPayload {
        p["durationSec"] = probed
        lastPayload = p
      }
    }

    player = next
    self.assetUri = assetUri

    let start: () -> Void = { [weak self] in
      guard let self else { return }
      self.rememberScriptureRate(from: payload)
      self.playMain(next)
      self.armStopAtBoundaryIfNeeded(player: next, payload: payload)
      self.emit("ShellMediaNativeTakeover", ["positionSec": self.currentTime, "assetUri": assetUri])
      if self.contentKind == "music" {
        self.persist(self.currentTime)
      }
      self.refreshDurationIntoPayload()
      self.emitProgress(playing: true)
      self.armTimers()
      self.publishNowPlaying(playing: true, lightweight: false)
      self.phase = "content"
      self.log(
        "app music started pos=\(self.currentTime) ok=true \(remote ? "remote" : "path")=\(remote ? playURL.absoluteString : playURL.path) engine=AVPlayer kind=\(self.contentKind) dur=\(self.duration)"
      )
    }

    if position > 0.05 {
      let seek = CMTime(seconds: position, preferredTimescale: 600)
      next.seek(to: seek, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] ok in
        guard self != nil else { return }
        if !ok { self?.log("app music seek failed pos=\(position)") }
        start()
      }
    } else {
      start()
    }
  }

  // MARK: - Verse track (mix with music)

  private func beginOrResumeVerse(payload: [String: Any]) {
    if systemInterrupted {
      pauseVerse(userInitiated: false)
      log("beginOrResumeVerse deferred systemInterrupted")
      return
    }
    guard let assetUri = payload["assetUri"] as? String, !assetUri.isEmpty else {
      log("app verse skip: no assetUri")
      return
    }
    // TEMP：金句可走 R2 HTTPS；本地 file 仍优先。
    guard let playURL = resolvePlayableMediaURL(assetUri) else {
      log("app verse skip: bad uri")
      return
    }
    let remote = isRemoteMediaURL(playURL)
    if !remote {
      guard FileManager.default.fileExists(atPath: playURL.path) else {
        log("app verse skip: missing \(playURL.path)")
        return
      }
    }

    var position = doubleValue(payload["positionSec"]) ?? 0
    let userPlay = boolValue(payload["userPlay"])
    let forceRestart = boolValue(payload["forceRestart"])
    let same =
      musicIdentity(assetUri) != nil
      && musicIdentity(assetUri) == musicIdentity(verseAssetUri ?? "")
    if same, let versePlayer {
      let sec = CMTimeGetSeconds(versePlayer.currentTime())
      // userPlay + 位置靠近 0：锁屏 Previous 重开当前句，勿只 resume 半句。
      // 缓冲卡顿 rate=0 时勿误判；只要进度已过 0.08s 就视为同句重复点播。
      if userPlay, position <= 0.05, !forceRestart, sec.isFinite, sec > 0.08 {
        syncMusicDuckForVerse()
        publishNowPlaying(playing: isPlaying || isVersePlaying, lightweight: appInBackground)
        log("app verse ignore duplicate userPlay at \(String(format: "%.2f", sec))s")
        return
      }
      if userPlay, position <= 0.05 {
        activateSession(force: !sessionArmed)
        versePlayer.seek(to: .zero, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
          guard let self else { return }
          versePlayer.play()
          self.syncMusicDuckForVerse()
          self.publishNowPlaying(playing: true, lightweight: self.appInBackground)
        }
        log("app verse restart from 0")
        return
      }
      if isPlayerActivelyPlaying(versePlayer) {
        syncMusicDuckForVerse()
        publishNowPlaying(playing: isPlaying || isVersePlaying, lightweight: appInBackground)
        return
      }
      activateSession(force: !sessionArmed)
      versePlayer.play()
      syncMusicDuckForVerse()
      publishNowPlaying(playing: true, lightweight: appInBackground)
      log("app verse resume mixMusic=\(player != nil && isPlaying)")
      return
    }

    if let dur = doubleValue(payload["durationSec"]), dur > 0 {
      position = min(max(0, position), max(0, dur - 0.25))
    }

    // 并发 sync（无 userPlay）：第一路正在播/缓冲时，第二路勿 tearDown 重建（听感像第 1 秒重播）。
    if !userPlay, !forceRestart, let versePlayer, versePlayer.currentItem != nil,
       let incomingId = musicIdentity(assetUri) {
      let currentId = musicIdentity(verseAssetUri ?? "")
      if incomingId == currentId || currentId == nil {
        if verseAssetUri == nil || verseAssetUri?.isEmpty == true {
          verseAssetUri = assetUri
        }
        if !isPlayerActivelyPlaying(versePlayer) {
          versePlayer.play()
        }
        syncMusicDuckForVerse()
        publishNowPlaying(playing: isPlaying || isVersePlaying, lightweight: appInBackground)
        log("app verse skip rebuild on sync (no userPlay)")
        return
      }
    }

    tearDownVersePlayerKeepingWant()
    activateSession(force: true)
    ensureRemoteCommands()

    let item = AVPlayerItem(url: playURL)
    item.preferredForwardBufferDuration = remote ? 8 : 20
    item.canUseNetworkResourcesForLiveStreamingWhilePaused = remote
    let next = AVPlayer(playerItem: item)
    next.automaticallyWaitsToMinimizeStalling = remote
    if #available(iOS 15.0, *) {
      next.audiovisualBackgroundPlaybackPolicy = .continuesIfPossible
    }

    verseEndObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      self?.handleVersePlaybackEnded()
    }

    versePlayer = next
    verseAssetUri = assetUri
    versePhase = "content"

    let start: () -> Void = { [weak self] in
      guard let self else { return }
      next.play()
      self.syncMusicDuckForVerse()
      self.publishNowPlaying(playing: true, lightweight: self.appInBackground)
      self.log(
        "app verse started \(remote ? "remote" : "path")=\(remote ? playURL.absoluteString : playURL.path) mixMusic=\(self.player != nil && self.isPlaying)"
      )
    }

    if position > 0.05 {
      let seek = CMTime(seconds: position, preferredTimescale: 600)
      next.seek(to: seek, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] ok in
        guard self != nil else { return }
        if !ok { self?.log("app verse seek failed pos=\(position)") }
        start()
      }
    } else {
      start()
    }
  }

  private func mergeVersePayload(_ payload: [String: Any]) -> [String: Any] {
    var merged = lastVersePayload ?? [:]
    for (key, value) in payload {
      merged[key] = value
    }
    // 预取/锁屏图等局部刷新不带 userPlay：勿沿用上次点播，否则同句会被 seek 回 0（首秒卡顿重播）。
    if payload["userPlay"] == nil {
      merged["userPlay"] = false
    }
    if payload["userPause"] == nil {
      merged["userPause"] = false
    }
    // 残缺刷新勿清掉间隔/预取。
    if doubleValue(payload["gapSec"]) == nil, verseGapSec > 0 {
      merged["gapSec"] = verseGapSec
    }
    if (payload["gapAssetUri"] as? String)?.isEmpty != false {
      if let gapUri = verseGapAssetUri, !gapUri.isEmpty {
        merged["gapAssetUri"] = gapUri
      }
    }
    if (payload["nextAssetUri"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false {
      if let next = verseNextQueue.first {
        merged["nextAssetUri"] = next
      }
    }
    if let gap = doubleValue(merged["gapSec"]), gap > 0 {
      verseGapSec = gap
    }
    if let gapUri = (merged["gapAssetUri"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
       !gapUri.isEmpty {
      verseGapAssetUri = gapUri
    }
    return merged
  }

  private func ingestVerseQueue(from payload: [String: Any]) {
    let currentId = musicIdentity(verseAssetUri ?? "")
    // gap 时 verseAssetUri 是静音轨；正文以 payload / 上一句为准，避免把当前句当 next。
    let contentId = musicIdentity((payload["assetUri"] as? String) ?? "") ?? currentId
    var candidates: [String] = []
    func appendCandidate(_ raw: String?) {
      guard let uri = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !uri.isEmpty else { return }
      if candidates.contains(where: { $0 == uri }) { return }
      candidates.append(uri)
    }
    appendCandidate(payload["nextAssetUri"] as? String)
    appendCandidate(payload["nextNextAssetUri"] as? String)
    if let arr = payload["nextAssetUris"] as? [String] {
      arr.forEach { appendCandidate($0) }
    } else if let arr = payload["nextAssetUris"] as? [Any] {
      arr.forEach { appendCandidate($0 as? String) }
    }
    var fresh: [String] = []
    let sawProvided = !candidates.isEmpty
    for uri in candidates {
      let id = musicIdentity(uri)
      if id == nil { continue }
      if id == currentId || id == contentId { continue }
      if fresh.contains(where: { musicIdentity($0) == id }) { continue }
      fresh.append(uri)
    }
    // JS 明确给了 next*：整表替换，丢掉上一轮残留的 nextNext（否则会先播错句再被纠正）。
    // 若 next* 皆空则不动队列（避免预取完成前的空刷新把有效队列清掉）。
    if sawProvided {
      verseNextQueue = Array(fresh.prefix(120))
    }
  }

  private func dequeueVerseNext() -> String? {
    while !verseNextQueue.isEmpty {
      let uri = verseNextQueue.removeFirst()
      let id = musicIdentity(uri)
      if id == nil { continue }
      if id == musicIdentity(verseAssetUri ?? "") { continue }
      guard let url = resolvePlayableMediaURL(uri) else { continue }
      if isRemoteMediaURL(url) { return uri }
      if FileManager.default.fileExists(atPath: url.path) { return uri }
    }
    return nil
  }

  private func handleVersePlaybackEnded() {
    if versePhase == "gap" {
      finishVerseGapAndAdvance(reason: "silence-end")
      return
    }
    let gapSec = max(verseGapSec, doubleValue(lastVersePayload?["gapSec"]) ?? 0)
    let gapUri = verseGapAssetUri
      ?? (lastVersePayload?["gapAssetUri"] as? String)
      ?? ""
    if gapSec > 0.05, let gapURL = resolveLocalFileURL(gapUri),
       FileManager.default.fileExists(atPath: gapURL.path) {
      log("app verse finished → gap \(gapSec)s queue=\(verseNextQueue.count)")
      beginVerseGap(silenceURL: gapURL, gapSec: gapSec)
      return
    }
    // 无间隔资源时仍尽量原生接播，避免只抛事件给可能挂起的 JS。
    if let nextUri = dequeueVerseNext() {
      var nextPayload = lastVersePayload ?? [:]
      nextPayload["assetUri"] = nextUri
      nextPayload["positionSec"] = 0
      nextPayload["playing"] = true
      nextPayload["userPlay"] = true
      nextPayload["kind"] = "verse"
      nextPayload["nextAssetUri"] = verseNextQueue.first
      lastVersePayload = nextPayload
      log("app verse finished → native next (no gap) queue=\(verseNextQueue.count)")
      beginOrResumeVerse(payload: nextPayload)
      emit("ShellMediaNativeVerseAdvance", ["assetUri": nextUri, "nativeChained": true])
      endVerseBackgroundTask(after: 20)
      return
    }
    log("app verse finished → advance (no gap/next)")
    emit("ShellMediaNativeVerseAdvance", [:])
    endVerseBackgroundTask(after: 20)
  }

  private func armStopAtBoundaryIfNeeded(player: AVPlayer, payload: [String: Any]) {
    if let boundaryObserver {
      player.removeTimeObserver(boundaryObserver)
      self.boundaryObserver = nil
    }
    guard contentKind == "scripture" else { return }
    guard let stopAt = doubleValue(payload["stopAtSec"]), stopAt > 0.2 else { return }
    let t = CMTime(seconds: stopAt, preferredTimescale: 600)
    boundaryObserver = player.addBoundaryTimeObserver(
      forTimes: [NSValue(time: t)],
      queue: .main
    ) { [weak self] in
      guard let self, !self.userPaused else { return }
      self.log("app scripture stopAt=\(stopAt) → ended")
      self.player?.pause()
      self.emit("ShellMediaNativeScriptureEnded", [
        "positionSec": stopAt,
        "durationSec": self.duration,
        "segmentEnd": true,
      ])
    }
  }

  @objc func ensureAlive(reason: String) {
    guard isWantingPlayback || isVerseWanting else { return }
    if systemInterrupted {
      pause(userInitiated: false)
      pauseVerse(userInitiated: false)
      log("app music ensureAlive skip systemInterrupted reason=\(reason)")
      return
    }
    log("app music ensureAlive reason=\(reason) kind=\(contentKind) verse=\(isVerseWanting)")
    activateSession(force: appInBackground || !sessionArmed)
    UIApplication.shared.beginReceivingRemoteControlEvents()
    if isVerseWanting {
      if let versePlayer {
        if !isPlayerActivelyPlaying(versePlayer) { versePlayer.play() }
      } else if let payload = lastVersePayload {
        beginOrResumeVerse(payload: payload)
      }
    }
    // 仅用户要听歌/读经时拉主轨；金句 want 不得把预加载音乐开出来。
    if isWantingPlayback, !userPaused {
      if let player {
        if !isPlayerActivelyPlaying(player) { playMain(player) }
        persist(currentTime)
        armTimers()
      } else if let payload = lastPayload, contentKind != "verse", boolValue(payload["playing"]) || boolValue(payload["userPlay"]) {
        beginOrResume(payload: payload)
      }
    }
    syncMusicDuckForVerse()
    publishNowPlaying(playing: isPlaying || isVersePlaying)
  }

  private func handlePlaybackEnded() {
    // 金句走 versePlayer / handleVersePlaybackEnded，勿占主轨。
    if contentKind == "scripture" {
      beginScriptureBackgroundTask()
      if let nextUri = dequeueScriptureNext() {
        var nextPayload = lastPayload ?? [:]
        nextPayload["assetUri"] = nextUri
        nextPayload["positionSec"] = 0
        nextPayload["playing"] = true
        nextPayload["userPlay"] = true
        nextPayload["kind"] = "scripture"
        nextPayload.removeValue(forKey: "stopAtSec")
        nextPayload["nextAssetUri"] = scriptureNextQueue.first
        nextPayload["nextNextAssetUri"] = scriptureNextQueue.count > 1 ? scriptureNextQueue[1] : nil
        lastPayload = nextPayload
        log("app scripture finished → native next queue=\(scriptureNextQueue.count)")
        beginOrResume(payload: nextPayload)
        emit("ShellMediaNativeScriptureEnded", [
          "assetUri": nextUri,
          "nativeChained": true,
          "positionSec": 0,
          "durationSec": duration,
        ])
        endScriptureBackgroundTask(after: 25)
        return
      }
      log("app scripture finished → ended")
      emit("ShellMediaNativeScriptureEnded", [
        "positionSec": currentTime,
        "durationSec": duration,
      ])
      endScriptureBackgroundTask(after: 25)
      return
    }
    log("app music finished ok=true")
    emit("RemoteNext", [:])
  }

  private func ingestScriptureQueue(from payload: [String: Any]) {
    let currentId = musicIdentity(assetUri ?? "")
    let candidates = [
      payload["nextAssetUri"] as? String,
      payload["nextNextAssetUri"] as? String,
    ]
    for raw in candidates {
      guard let uri = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !uri.isEmpty else { continue }
      let id = musicIdentity(uri)
      if id == nil { continue }
      if id == currentId { continue }
      if scriptureNextQueue.contains(where: { musicIdentity($0) == id }) { continue }
      scriptureNextQueue.append(uri)
    }
    if scriptureNextQueue.count > 6 {
      scriptureNextQueue = Array(scriptureNextQueue.suffix(6))
    }
  }

  private func dequeueScriptureNext() -> String? {
    while !scriptureNextQueue.isEmpty {
      let uri = scriptureNextQueue.removeFirst()
      let id = musicIdentity(uri)
      if id == nil { continue }
      if id == musicIdentity(assetUri ?? "") { continue }
      guard let url = resolvePlayableMediaURL(uri) else { continue }
      if isRemoteMediaURL(url) { return uri }
      if FileManager.default.fileExists(atPath: url.path) { return uri }
    }
    return nil
  }

  private func beginScriptureBackgroundTask() {
    if scriptureBgTask != .invalid {
      UIApplication.shared.endBackgroundTask(scriptureBgTask)
      scriptureBgTask = .invalid
    }
    scriptureBgTask = UIApplication.shared.beginBackgroundTask(withName: "askbible-scripture-advance") { [weak self] in
      self?.endScriptureBackgroundTask(after: 0)
    }
  }

  private func endScriptureBackgroundTask(after delay: TimeInterval) {
    let endNow = { [weak self] in
      guard let self else { return }
      if self.scriptureBgTask != .invalid {
        UIApplication.shared.endBackgroundTask(self.scriptureBgTask)
        self.scriptureBgTask = .invalid
      }
    }
    if delay <= 0 {
      endNow()
      return
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
      endNow()
    }
  }

  private func finishVerseGapAndAdvance(reason: String) {
    guard versePhase == "gap", isVerseWanting else { return }
    if systemInterrupted {
      log("verse gap hold systemInterrupted")
      return
    }
    versePhase = "content"
    gapTimer?.invalidate()
    gapTimer = nil
    // 先吃队列，再看 payload；后台 JS 挂起时仍能连播。
    let payloadNext = (lastVersePayload?["nextAssetUri"] as? String)?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    if let payloadNext, !payloadNext.isEmpty,
       !verseNextQueue.contains(where: { musicIdentity($0) == musicIdentity(payloadNext) }) {
      verseNextQueue.insert(payloadNext, at: 0)
    }
    if let nextUri = dequeueVerseNext() {
      var nextPayload = lastVersePayload ?? [:]
      nextPayload["assetUri"] = nextUri
      nextPayload["positionSec"] = 0
      nextPayload["playing"] = true
      nextPayload["userPlay"] = true
      nextPayload["kind"] = "verse"
      nextPayload["nextAssetUri"] = verseNextQueue.first
      nextPayload["nextNextAssetUri"] = verseNextQueue.count > 1 ? verseNextQueue[1] : nil
      lastVersePayload = nextPayload
      log("app verse gap → native next reason=\(reason) queue=\(verseNextQueue.count)")
      beginOrResumeVerse(payload: nextPayload)
      emit("ShellMediaNativeVerseAdvance", ["assetUri": nextUri, "nativeChained": true])
      endVerseBackgroundTask(after: 20)
      return
    }
    tearDownVersePlayerKeepingWant()
    log("app verse gap finished → advance reason=\(reason) queue=0")
    emit("ShellMediaNativeVerseAdvance", [:])
    endVerseBackgroundTask(after: 20)
  }

  private func beginVerseGap(silenceURL: URL, gapSec: Double) {
    versePhase = "gap"
    gapTimer?.invalidate()
    beginVerseBackgroundTask()
    tearDownVersePlayerKeepingWant()
    activateSession(force: true)
    let item = AVPlayerItem(url: silenceURL)
    item.preferredForwardBufferDuration = 5
    let next = AVPlayer(playerItem: item)
    next.automaticallyWaitsToMinimizeStalling = false
    if #available(iOS 15.0, *) {
      next.audiovisualBackgroundPlaybackPolicy = .continuesIfPossible
    }
    verseEndObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      // 间隔以墙钟 timer 为准；静音轨结束不重复 advance。
      self?.log("app verse gap silence ended (timer owns advance)")
    }
    versePlayer = next
    verseAssetUri = silenceURL.absoluteString
    next.play()
    syncMusicDuckForVerse()
    publishNowPlaying(playing: isPlaying || isVersePlaying, lightweight: true)
    let t = Timer(timeInterval: gapSec, repeats: false) { [weak self] _ in
      self?.finishVerseGapAndAdvance(reason: "timer")
    }
    RunLoop.main.add(t, forMode: .common)
    gapTimer = t
  }

  private func tearDownVersePlayerKeepingWant() {
    if let verseEndObserver {
      NotificationCenter.default.removeObserver(verseEndObserver)
      self.verseEndObserver = nil
    }
    versePlayer?.pause()
    versePlayer?.replaceCurrentItem(with: nil)
    versePlayer = nil
    verseAssetUri = nil
  }

  private func tearDownVersePlayer() {
    gapTimer?.invalidate()
    gapTimer = nil
    versePhase = "content"
    tearDownVersePlayerKeepingWant()
  }

  private func beginVerseBackgroundTask() {
    if verseBgTask != .invalid {
      UIApplication.shared.endBackgroundTask(verseBgTask)
      verseBgTask = .invalid
    }
    verseBgTask = UIApplication.shared.beginBackgroundTask(withName: "askbible-verse-gap") { [weak self] in
      self?.endVerseBackgroundTask(after: 0)
    }
  }

  private func endVerseBackgroundTask(after delay: TimeInterval) {
    let endNow = { [weak self] in
      guard let self else { return }
      if self.verseBgTask != .invalid {
        UIApplication.shared.endBackgroundTask(self.verseBgTask)
        self.verseBgTask = .invalid
      }
    }
    if delay <= 0 {
      endNow()
      return
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
      endNow()
    }
  }

  private func tearDownPlayerKeepingWant() {
    healthTimer?.invalidate()
    healthTimer = nil
    refreshTimer?.invalidate()
    refreshTimer = nil
    if let endObserver {
      NotificationCenter.default.removeObserver(endObserver)
      self.endObserver = nil
    }
    statusObservation?.invalidate()
    statusObservation = nil
    if let boundaryObserver, let player {
      player.removeTimeObserver(boundaryObserver)
    }
    boundaryObserver = nil
    removeScriptureProgressObserver()
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    player = nil
    assetUri = nil
  }

  private func tearDownPlayer() {
    // gapTimer 属金句轨，主轨拆除时勿清。
    tearDownPlayerKeepingWant()
  }

  // MARK: - Session / lifecycle

  private func sessionLooksWrong(_ session: AVAudioSession) -> Bool {
    if session.category != .playback { return true }
    if session.categoryOptions.contains(.mixWithOthers) { return true }
    if session.categoryOptions.contains(.duckOthers) { return true }
    if session.mode == .moviePlayback { return true }
    return false
  }

  private func bgRemainingLabel() -> String {
    let t = UIApplication.shared.backgroundTimeRemaining
    if t.isInfinite { return "inf" }
    if t > 100_000 { return "inf" }
    return String(format: "%.1f", t)
  }

  private func activateSession(force: Bool) {
    let session = AVAudioSession.sharedInstance()
    if sessionArmed && !force && !sessionLooksWrong(session) { return }
    // 前台：封面视频会把会话染成 mixWithOthers / moviePlayback；音乐/金句可容忍。
    // 读经必须独占，否则约 1s 后卡死。
    if !force && !appInBackground && contentKind != "scripture" {
      let coverVideoPollution =
        session.category == .playback
        && (session.categoryOptions.contains(.mixWithOthers) || session.mode == .moviePlayback)
      if coverVideoPollution {
        sessionArmed = true
        return
      }
    }
    do {
      try session.setCategory(.playback, mode: .default, options: [])
      try session.setActive(true, options: [])
      sessionArmed = true
      log(
        "app music session active mode=\(session.mode.rawValue) opts=\(session.categoryOptions.rawValue)"
      )
    } catch {
      sessionArmed = false
      log("app music session failed: \(error.localizedDescription)")
    }
  }

  private func registerLifecycle() {
    guard lifecycleObservers.isEmpty else { return }
    let center = NotificationCenter.default
    lifecycleObservers.append(center.addObserver(
      forName: UIApplication.didEnterBackgroundNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.appInBackground = true
      self?.log("app music lifecycle background")
      self?.prepareForBackground()
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
        guard self?.appInBackground == true else { return }
        guard self?.systemInterrupted != true else { return }
        self?.activateSession(force: self?.sessionLooksWrong(AVAudioSession.sharedInstance()) ?? true)
        if let player = self?.player, !(self?.userPaused ?? true), let self, !self.isPlayerActivelyPlaying(player) {
          self.playMain(player)
        }
        self?.log(
          "app music bg-reclaim playing=\(self?.isPlaying ?? false) t=\(self?.currentTime ?? -1) bgRemaining=\(self?.bgRemainingLabel() ?? "?")"
        )
      }
    })
    lifecycleObservers.append(center.addObserver(
      forName: UIApplication.didBecomeActiveNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self else { return }
      let wasBg = self.appInBackground
      self.appInBackground = false
      if wasBg {
        self.log(
          "app music foreground resume playing=\(self.isPlaying) t=\(self.currentTime) rssMB=\(self.residentMemoryMB())"
        )
      }
      self.healthTimer?.invalidate()
      self.healthTimer = nil
      self.refreshTimer?.invalidate()
      self.refreshTimer = nil
      self.armTimers()
      self.ensureAlive(reason: "active")
    })
    lifecycleObservers.append(center.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: nil,
      queue: .main
    ) { [weak self] note in
      guard
        let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        let type = AVAudioSession.InterruptionType(rawValue: raw)
      else { return }
      if type == .began {
        self?.sessionArmed = false
        self?.audioSessionInterrupted = true
        self?.beginSystemInterruption(reason: "audio-session")
        return
      }
      self?.audioSessionInterrupted = false
      self?.sessionArmed = false
      self?.endSystemInterruptionIfClear(reason: "audio-session-ended")
    })
    lifecycleObservers.append(center.addObserver(
      forName: AVAudioSession.mediaServicesWereResetNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.sessionArmed = false
      self?.ensureAlive(reason: "media-reset")
    })
  }

  // MARK: - Timers / Now Playing / Remote

  private func removeScriptureProgressObserver() {
    if let progressObserver, let player {
      player.removeTimeObserver(progressObserver)
    }
    progressObserver = nil
  }

  /// 读经进度：0.5s 媒体时钟（跟读高亮已关，放宽以减 JS 桥流量）。后台不装。
  private func armScriptureProgressObserver(on player: AVPlayer) {
    guard contentKind == "scripture" else {
      removeScriptureProgressObserver()
      return
    }
    if progressObserver != nil { return }
    let interval = CMTime(seconds: 0.5, preferredTimescale: 600)
    progressObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
      guard let self, !self.userPaused, !self.appInBackground, !self.seeking else { return }
      let sec = CMTimeGetSeconds(time)
      guard sec.isFinite, sec >= 0 else { return }
      self.emitProgress(playing: true, positionSec: sec)
    }
  }

  private func armTimers() {
    if appInBackground {
      // 后台零 Timer：勿再 arm watch。
      healthTimer?.invalidate()
      healthTimer = nil
      refreshTimer?.invalidate()
      refreshTimer = nil
      removeScriptureProgressObserver()
      return
    }
    if healthTimer == nil {
      let t = Timer(timeInterval: 4, repeats: true) { [weak self] _ in
        self?.heartbeat()
      }
      RunLoop.main.add(t, forMode: .common)
      healthTimer = t
      log("app music health timer armed")
    }
    if refreshTimer == nil {
      let t = Timer(timeInterval: 2, repeats: true) { [weak self] _ in
        guard let self, !self.userPaused, self.isPlaying else { return }
        if self.appInBackground { return }
        self.publishNowPlaying(playing: true)
        self.persist(self.currentTime)
        self.emitProgress(playing: true)
      }
      RunLoop.main.add(t, forMode: .common)
      refreshTimer = t
    }
    if let player {
      armScriptureProgressObserver(on: player)
    }
  }

  private func heartbeat() {
    guard isWantingPlayback, !userPaused, !systemInterrupted else { return }
    guard let player else {
      log("app music heartbeat missing player")
      if let payload = lastPayload, boolValue(payload["playing"]) || boolValue(payload["userPlay"]) {
        beginOrResume(payload: payload)
      }
      return
    }
    let playing = isPlayerActivelyPlaying(player)
    let t = currentTime
    let session = AVAudioSession.sharedInstance()
    if sessionLooksWrong(session) {
      // 前台封面视频会设 mixWithOthers / moviePlayback；音乐/金句勿抢回，读经必须抢回。
      // 进后台由 prepareForBackground + 卸槽后再抢 exclusive playback。
      let coverVideoPollution =
        session.categoryOptions.contains(.mixWithOthers) || session.mode == .moviePlayback
      if appInBackground || !coverVideoPollution || contentKind == "scripture" {
        log("app music heartbeat session polluted → reclaim opts=\(session.categoryOptions.rawValue) mode=\(session.mode.rawValue) kind=\(contentKind)")
        activateSession(force: true)
        if !userPaused { playMain(player) }
      } else {
        log("app music heartbeat allow cover mix opts=\(session.categoryOptions.rawValue) mode=\(session.mode.rawValue)")
      }
    } else if appInBackground, !userPaused, !playing {
      activateSession(force: true)
      playMain(player)
    }

    if appInBackground {
      let now = CFAbsoluteTimeGetCurrent()
      if now - lastBgLogAt >= 8 {
        lastBgLogAt = now
        log(
          "app music heartbeat playing=\(isPlayerActivelyPlaying(player)) t=\(currentTime) engine=AVPlayer bgRemaining=\(bgRemainingLabel()) opts=\(session.categoryOptions.rawValue)"
        )
      }
      if !userPaused {
        if !isPlayerActivelyPlaying(player) {
          log("app music heartbeat dead → restart (bg)")
          activateSession(force: true)
          playMain(player)
        }
        persist(currentTime)
        publishNowPlaying(playing: isPlayerActivelyPlaying(player), lightweight: true)
      }
      return
    }

    log(
      "app music heartbeat playing=\(playing) t=\(t) engine=AVPlayer bgRemaining=\(bgRemainingLabel()) opts=\(session.categoryOptions.rawValue)"
    )
    if !userPaused, !playing {
      log("app music heartbeat dead → restart")
      activateSession(force: true)
      playMain(player)
      if !isPlayerActivelyPlaying(player) {
        let uri = assetUri
        let pos = t
        tearDownPlayer()
        if var payload = lastPayload {
          payload["assetUri"] = uri ?? payload["assetUri"]
          payload["positionSec"] = pos
          payload["playing"] = true
          beginOrResume(payload: payload)
        }
      }
      if !isPlaying {
        log("app music heartbeat restart failed")
        emit("ShellMediaNativeStopped", ["reason": "heartbeat-dead"])
      }
    } else if playing {
      persist(t)
      publishNowPlaying(playing: true, lightweight: false)
      emitProgress(playing: true)
    }
  }

  private func emitProgress(playing: Bool, positionSec: Double? = nil) {
    if seeking { return }
    emit("ShellMediaNativeProgress", [
      "positionSec": positionSec ?? currentTime,
      "durationSec": duration,
      "playing": playing,
      "kind": contentKind,
      "rate": contentKind == "scripture" ? scriptureRate : 1.0,
    ])
  }

  private func probeFileDuration(_ url: URL) -> Double? {
    let asset = AVURLAsset(url: url)
    let d = CMTimeGetSeconds(asset.duration)
    guard d.isFinite, d > 0 else { return nil }
    return d
  }

  private func refreshDurationIntoPayload() {
    let fromPlayer: Double = {
      if let item = player?.currentItem {
        let d = CMTimeGetSeconds(item.duration)
        if d.isFinite, d > 0 { return d }
        let ad = CMTimeGetSeconds(item.asset.duration)
        if ad.isFinite, ad > 0 { return ad }
      }
      return 0
    }()
    var dur = fromPlayer
    if dur <= 0, let uri = assetUri, let url = resolveLocalFileURL(uri) {
      dur = probeFileDuration(url) ?? 0
    }
    guard dur > 1 else { return }
    if var payload = lastPayload {
      let old = doubleValue(payload["durationSec"]) ?? 0
      if old < 1 || abs(old - dur) > 0.5 {
        payload["durationSec"] = dur
        lastPayload = payload
      }
    }
  }

  private func publishNowPlaying(playing: Bool, lightweight: Bool = false) {
    guard let payload = lastPayload else { return }
    let center = MPNowPlayingInfoCenter.default()
    let existingDur = (center.nowPlayingInfo?[MPMediaItemPropertyPlaybackDuration] as? NSNumber)?.doubleValue ?? 0
    // 已有会话但缺时长：强制全量刷新，勿只改 elapsed。
    if lightweight, existingDur <= 1 {
      refreshDurationIntoPayload()
      if duration > 1 {
        publishNowPlaying(playing: playing, lightweight: false)
        return
      }
    }
    if lightweight, var info = center.nowPlayingInfo, !info.isEmpty {
      info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
      info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
      center.nowPlayingInfo = info
      if #available(iOS 13.0, *) {
        center.playbackState = playing ? .playing : .paused
      }
      return
    }

    var info: [String: Any] = [:]
    let title = (payload["title"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "AskBible.me"
    info[MPMediaItemPropertyTitle] = title
    if let artist = payload["artist"] as? String, !artist.isEmpty {
      info[MPMediaItemPropertyArtist] = artist
    }
    if let album = payload["album"] as? String, !album.isEmpty {
      info[MPMediaItemPropertyAlbumTitle] = album
    }
    let dur = duration
    if dur > 0 {
      info[MPMediaItemPropertyPlaybackDuration] = dur
    }
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentTime
    info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
    info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0
    if #available(iOS 13.0, *) {
      info[MPNowPlayingInfoPropertyMediaType] = MPNowPlayingInfoMediaType.audio.rawValue
    }
    info[MPNowPlayingInfoPropertyIsLiveStream] = false
    info[MPNowPlayingInfoPropertyServiceIdentifier] = "me.askbible"
    if let art = payload["artworkUri"] as? String, !art.isEmpty {
      if cachedArtworkUri != art {
        cachedArtworkUri = art
        if let image = loadImage(art) {
          let copy = image
          cachedArtwork = MPMediaItemArtwork(boundsSize: copy.size) { _ in copy }
        } else {
          cachedArtwork = nil
        }
      }
      if let cachedArtwork {
        info[MPMediaItemPropertyArtwork] = cachedArtwork
      }
    }
    center.nowPlayingInfo = info
    if #available(iOS 13.0, *) {
      center.playbackState = playing ? .playing : .paused
    }
  }

  private func ensureRemoteCommands() {
    guard !remoteRegistered else { return }
    remoteRegistered = true
    UIApplication.shared.beginReceivingRemoteControlEvents()
    let c = MPRemoteCommandCenter.shared()
    c.playCommand.isEnabled = true
    c.pauseCommand.isEnabled = true
    c.togglePlayPauseCommand.isEnabled = true
    c.nextTrackCommand.isEnabled = true
    c.previousTrackCommand.isEnabled = true
    c.playCommand.addTarget { [weak self] _ in
      if self?.player != nil || self?.wantPlaying == true {
        self?.resume(userInitiated: true)
      }
      self?.emit("RemotePlay", [:])
      return .success
    }
    c.pauseCommand.addTarget { [weak self] _ in
      if self?.player != nil {
        self?.pause(userInitiated: true)
      }
      self?.emit("RemotePause", [:])
      return .success
    }
    c.togglePlayPauseCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      if self.player != nil {
        if self.isPlaying {
          self.pause(userInitiated: true)
        } else {
          self.resume(userInitiated: true)
        }
      }
      self.emit("RemoteToggle", [:])
      return .success
    }
    c.nextTrackCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      // 金句在独立轨：contentKind 常仍是 music，须用 verse want/playing 判断。
      if self.isVerseWanting || self.isVersePlaying {
        self.gapTimer?.invalidate()
        self.gapTimer = nil
        self.emit("ShellMediaNativeVerseAdvance", [:])
      } else if self.contentKind == "scripture" {
        self.emit("ShellMediaNativeScriptureEnded", [
          "positionSec": self.currentTime,
          "durationSec": self.duration,
          "skip": true,
        ])
      } else {
        self.emit("RemoteNext", [:])
      }
      return .success
    }
    c.previousTrackCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      if self.isVerseWanting || self.isVersePlaying {
        self.emit("ShellMediaNativeVerseRestart", [:])
      } else {
        self.emit("RemotePrevious", [:])
      }
      return .success
    }
  }

  // MARK: - Helpers

  private func emit(_ name: String, _ body: [String: Any]) {
    NotificationCenter.default.post(
      name: .askBibleMusicEvent,
      object: nil,
      userInfo: ["name": name, "body": body]
    )
  }

  private func persist(_ position: Double) {
    UserDefaults.standard.set(position, forKey: posKey)
    if let assetUri, !assetUri.isEmpty {
      UserDefaults.standard.set(assetUri, forKey: uriKey)
    }
  }

  private func resolveLocalFileURL(_ assetUri: String) -> URL? {
    let trimmed = assetUri.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    if let url = URL(string: trimmed), let scheme = url.scheme?.lowercased(), !scheme.isEmpty {
      if scheme == "http" || scheme == "https" { return nil }
      if url.isFileURL || scheme == "file" { return url.standardizedFileURL }
      return nil
    }
    if trimmed.hasPrefix("/") { return URL(fileURLWithPath: trimmed).standardizedFileURL }
    return nil
  }

  /** 金句 / 音乐非首曲：本地 file 或 TEMP R2 HTTPS。 */
  private func resolvePlayableMediaURL(_ assetUri: String) -> URL? {
    let trimmed = assetUri.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    if let url = URL(string: trimmed), let scheme = url.scheme?.lowercased(), !scheme.isEmpty {
      if scheme == "https" || scheme == "http" { return url }
      if url.isFileURL || scheme == "file" { return url.standardizedFileURL }
      return nil
    }
    if trimmed.hasPrefix("/") { return URL(fileURLWithPath: trimmed).standardizedFileURL }
    return nil
  }

  private func isRemoteMediaURL(_ url: URL) -> Bool {
    let scheme = url.scheme?.lowercased() ?? ""
    return scheme == "http" || scheme == "https"
  }

  private func musicIdentity(_ uri: String) -> String? {
    let trimmed = uri.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    // HTTPS 金句：文件名唯一（GEN-1-1-32kbps.mp3），勿因域名/query 误判换轨。
    if let url = URL(string: trimmed), let scheme = url.scheme?.lowercased(),
       scheme == "http" || scheme == "https"
    {
      let name = url.lastPathComponent.lowercased()
      return name.isEmpty ? url.absoluteString.lowercased() : name
    }
    guard let url = resolveLocalFileURL(uri) else { return nil }
    var path = url.path
    if path.hasPrefix("/private/") { path = String(path.dropFirst("/private".count)) }
    // 金句：点播抽条与整包解压路径不同，但文件名唯一；用文件名避免同句被当成换轨。
    let lower = path.lowercased()
    if lower.contains("golden-verse") {
      return url.lastPathComponent.lowercased()
    }
    return path
  }

  private func loadImage(_ uri: String) -> UIImage? {
    var path = uri
    if uri.hasPrefix("file://"), let url = URL(string: uri) { path = url.path }
    guard !path.isEmpty else { return nil }
    return UIImage(contentsOfFile: path)
  }

  private func boolValue(_ value: Any?) -> Bool {
    switch value {
    case let b as Bool: return b
    case let n as NSNumber: return n.boolValue
    default: return false
    }
  }

  private func doubleValue(_ value: Any?) -> Double? {
    switch value {
    case let n as Double: return n
    case let n as Float: return Double(n)
    case let n as Int: return Double(n)
    case let n as NSNumber: return n.doubleValue
    default: return nil
    }
  }

  private func log(_ message: String) {
    NSLog("[askbible-shell-media] %@", message)
    let line = "[\(ISO8601DateFormatter().string(from: Date()))] \(message)\n"
    guard let data = line.data(using: .utf8) else { return }
    do {
      let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent(logName)
      if FileManager.default.fileExists(atPath: url.path) {
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        try handle.seekToEnd()
        try handle.write(contentsOf: data)
      } else {
        try data.write(to: url, options: .atomic)
      }
    } catch {}
  }

  private func beginSystemInterruption(reason: String) {
    pause(userInitiated: false)
    pauseVerse(userInitiated: false)
    emit("AudioSessionInterruptionBegan", ["reason": reason])
    log("app music system interrupt begin reason=\(reason) call=\(phoneCallActive) session=\(audioSessionInterrupted)")
  }

  private func endSystemInterruptionIfClear(reason: String) {
    guard !systemInterrupted else {
      log("app music system interrupt still held reason=\(reason) call=\(phoneCallActive) session=\(audioSessionInterrupted)")
      return
    }
    log("app music system interrupt end reason=\(reason)")
    emit("AudioSessionInterruptionEnded", ["shouldResume": !userPaused])
    guard !userPaused else { return }
    ensureAlive(reason: reason)
  }
}

extension AskBibleMusicService: CXCallObserverDelegate {
  func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
    let hasActive = callObserver.calls.contains { !$0.hasEnded }
    if hasActive == phoneCallActive { return }
    phoneCallActive = hasActive
    if hasActive {
      beginSystemInterruption(reason: "phone-call")
    } else {
      endSystemInterruptionIfClear(reason: "phone-call-ended")
    }
  }
}
