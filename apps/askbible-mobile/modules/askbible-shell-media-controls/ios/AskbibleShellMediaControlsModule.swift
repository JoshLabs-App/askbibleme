import AVFoundation
import CallKit
import ExpoModulesCore
import MediaPlayer
import UIKit

public class AskbibleShellMediaControlsModule: Module {
  private var remoteCommandsRegistered = false
  private var pulseTimer: Timer?
  /// 播放器与会话状态放进程单例：Expo module 重建后仍续播。
  private static var sharedHealthTimer: Timer?
  private static var sharedRefreshTimer: Timer?
  private static var sharedUserPaused = false
  private static var sharedLastMusicPayload: [String: Any]?
  private static var sharedLastPayload: [String: Any]?
  private static var sharedLastPublishTimestamp: CFAbsoluteTime = 0
  private static var sharedSessionArmed = false
  private static weak var sharedEventSink: AskbibleShellMediaControlsModule?
  private static var sleepTimerWork: DispatchWorkItem?
  private static var rebindAt: CFAbsoluteTime = 0
  private static var sharedLifecycleObservers: [NSObjectProtocol] = []
  private static var sharedLifecycleRegistered = false
  private static var sharedAppIsBackground = false
  private static var backgroundKeepAliveTask: UIBackgroundTaskIdentifier = .invalid
  private static let debugLogFileName = "askbible-shell-media.log"
  private static let wantPlayingDefaultsKey = "askbible.nativeMusicWantPlaying"
  private static let positionDefaultsKey = "askbible.nativeMusicPositionSec"
  private static let uriDefaultsKey = "askbible.nativeMusicUri"

  private var musicEngine: NativeMusicEngine { NativeMusicEngine.shared }
  private var nativeUri: String? {
    get { NativeMusicEngine.shared.assetUri }
    set { /* assetUri 由 engine.start 写入 */ }
  }
  private var nativeHealthTimer: Timer? {
    get { Self.sharedHealthTimer }
    set { Self.sharedHealthTimer = newValue }
  }
  private var refreshTimer: Timer? {
    get { Self.sharedRefreshTimer }
    set { Self.sharedRefreshTimer = newValue }
  }
  private var nativeUserPaused: Bool {
    get { Self.sharedUserPaused }
    set { Self.sharedUserPaused = newValue }
  }
  private var lastMusicPayload: [String: Any]? {
    get { Self.sharedLastMusicPayload }
    set { Self.sharedLastMusicPayload = newValue }
  }
  private var lastPayload: [String: Any]? {
    get { Self.sharedLastPayload }
    set { Self.sharedLastPayload = newValue }
  }
  private var lastPublishTimestamp: CFAbsoluteTime {
    get { Self.sharedLastPublishTimestamp }
    set { Self.sharedLastPublishTimestamp = newValue }
  }
  private var appIsBackground: Bool {
    get { Self.sharedAppIsBackground }
    set { Self.sharedAppIsBackground = newValue }
  }
  private var sessionArmed: Bool {
    get { Self.sharedSessionArmed }
    set { Self.sharedSessionArmed = newValue }
  }

  private func log(_ message: String) {
    NSLog("[askbible-shell-media] %@", message)
    appendDebugLine(message)
  }

  private func appendDebugLine(_ message: String) {
    let timestamp = ISO8601DateFormatter().string(from: Date())
    let line = "[\(timestamp)] \(message)\n"
    guard let data = line.data(using: .utf8) else { return }
    do {
      let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent(Self.debugLogFileName)
      if FileManager.default.fileExists(atPath: url.path) {
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        try handle.seekToEnd()
        try handle.write(contentsOf: data)
      } else {
        try data.write(to: url, options: .atomic)
      }
    } catch {
      // Diagnostics should never affect playback.
    }
  }

  public func definition() -> ModuleDefinition {
    Name("AskBibleShellMediaControls")

    Events(
      "RemotePlay",
      "RemotePause",
      "RemoteToggle",
      "RemoteNext",
      "RemotePrevious",
      "AudioSessionInterruptionBegan",
      "AudioSessionInterruptionEnded",
      "ShellMediaPlaybackPulse",
      "ShellMediaNativeTakeover",
      "ShellMediaNativeRelease",
      "ShellMediaNativeStopped",
      "ShellMediaNativeProgress",
      "ShellMediaNativeVerseAdvance",
      "ShellMediaNativeVerseRestart",
      "ShellMediaNativeScriptureEnded",
      "ShellMediaSleepTimerFired"
    )

    Function("updateSession") { (json: String) in
      DispatchQueue.main.async {
        self.handleUpdateSession(json: json)
      }
    }

    Function("setPlaybackRate") { (rate: Double) in
      DispatchQueue.main.async {
        self.log("setPlaybackRate \(rate)")
        NotificationCenter.default.post(
          name: Notification.Name("me.askbible.music.setRate"),
          object: nil,
          userInfo: ["rate": rate]
        )
      }
    }

    Function("setMusicVolume") { (volume: Double) in
      DispatchQueue.main.async {
        NotificationCenter.default.post(
          name: Notification.Name("me.askbible.music.setVolume"),
          object: nil,
          userInfo: ["volume": volume]
        )
      }
    }

    Function("seekTo") { (positionSec: Double) in
      DispatchQueue.main.async {
        self.log("seekTo \(positionSec)")
        NotificationCenter.default.post(
          name: Notification.Name("me.askbible.music.seek"),
          object: nil,
          userInfo: ["positionSec": positionSec]
        )
      }
    }

    Function("clearSession") { (reason: String?) in
      DispatchQueue.main.async {
        let why = reason ?? "unspecified"
        // js-null-payload / 非用户解散：永不 stop。仅当用户仍 wantPlaying 时才续播。
        if why != "user-dismissed", why != "user-dismiss" {
          let want = UserDefaults.standard.bool(forKey: Self.wantPlayingDefaultsKey)
          self.log("refuse clear reason=\(why) wantPlaying=\(want)")
          if want {
            if let music = Self.sharedLastMusicPayload {
              var restored = music
              restored["playing"] = true
              NotificationCenter.default.post(
                name: Notification.Name("me.askbible.music.apply"),
                object: nil,
                userInfo: restored
              )
            } else {
              NotificationCenter.default.post(name: Notification.Name("me.askbible.music.resume"), object: nil)
            }
          }
          return
        }
        self.log("clear nowPlaying reason=\(why)")
        NotificationCenter.default.post(
          name: Notification.Name("me.askbible.music.stop"),
          object: nil,
          userInfo: ["reason": why]
        )
        self.clearNowPlaying()
      }
    }

    Function("setSleepTimerDeadlineMs") { (deadlineMs: Double) in
      DispatchQueue.main.async {
        Self.armSleepTimer(deadlineMs: deadlineMs)
      }
    }

    Function("pauseAppMusic") {
      DispatchQueue.main.async {
        self.log("pauseAppMusic (user)")
        Self.sharedUserPaused = true
        // 只暂停当前原生引擎（音乐/金句/读经）。勿把 lastPayload 改成「上一首音乐」，
        // 否则读经暂停后再 resume 会误开音乐。
        if var last = Self.sharedLastPayload {
          last["playing"] = false
          Self.sharedLastPayload = last
          if Self.payloadKindStatic(last) == "music" {
            Self.sharedLastMusicPayload = last
            UserDefaults.standard.set(false, forKey: Self.wantPlayingDefaultsKey)
          }
        } else {
          UserDefaults.standard.set(false, forKey: Self.wantPlayingDefaultsKey)
        }
        NotificationCenter.default.post(name: Notification.Name("me.askbible.music.pause"), object: nil)
      }
    }

    Function("resumeAppMusic") {
      DispatchQueue.main.async {
        self.log("resumeAppMusic (user)")
        Self.sharedUserPaused = false
        // 续播当前 kind（读经/金句/音乐），绝不要强行 apply 上一首音乐 payload。
        if let last = Self.sharedLastPayload, Self.payloadKindStatic(last) == "music" {
          UserDefaults.standard.set(true, forKey: Self.wantPlayingDefaultsKey)
        }
        NotificationCenter.default.post(
          name: Notification.Name("me.askbible.music.resume"),
          object: nil,
          userInfo: ["userInitiated": true]
        )
      }
    }

    Function("minimizeAppToBackground") {
      DispatchQueue.main.async {
        // 与 AppDelegate 同一路径，确保挂件开播后能回桌面。
        UIApplication.shared.perform(NSSelectorFromString("suspend"))
      }
    }

    OnCreate {
      DispatchQueue.main.async {
        Self.sharedEventSink = self
        self.log("module create")
        UIApplication.shared.beginReceivingRemoteControlEvents()
        self.activatePlaybackSessionIfNeeded()
        self.becomePlaybackFirstResponderIfNeeded()
        self.registerLifecycleObserversIfNeeded()
        self.registerAppMusicEventBridgeIfNeeded()
        // 勿因 UserDefaults wantPlaying 冷启动自动续播；仅用户点播 / 遥控 Play。
        self.log("module create (no auto-resume)")
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        if Self.sharedEventSink === self {
          Self.sharedEventSink = nil
        }
        // 勿停 sharedPlayer，也勿卸生命周期观察者：module 重建时必须续播与后台自愈。
      }
    }
  }

  private func handleUpdateSession(json: String) {
    guard
      let data = json.data(using: .utf8),
      let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      return
    }
    log("updateSession")
    ensureRemoteCommands()
    publishNowPlaying(from: obj)
  }

  private func ensureRemoteCommands() {
    // 锁屏遥控由 App 主工程 AskBibleMusicService 注册；避免双 handler 互掐。
    guard !remoteCommandsRegistered else { return }
    remoteCommandsRegistered = true
    log("remote commands owned by app music service")
  }

  private func becomePlaybackFirstResponderIfNeeded() {
    guard let responder = activeKeyWindow()?.rootViewController else { return }
    if !responder.isFirstResponder {
      _ = responder.becomeFirstResponder()
    }
  }

  private func activeKeyWindow() -> UIWindow? {
    for scene in UIApplication.shared.connectedScenes {
      guard let windowScene = scene as? UIWindowScene else { continue }
      if let key = windowScene.windows.first(where: { $0.isKeyWindow }) {
        return key
      }
    }
    return nil
  }

  private func activatePlaybackSessionIfNeeded(force: Bool = false) {
    // 原生音乐独占时由 AskBibleMusicService 管会话，module 勿再 setCategory。
    if UserDefaults.standard.bool(forKey: Self.wantPlayingDefaultsKey) { return }
    if sessionArmed && !force { return }
    let session = AVAudioSession.sharedInstance()
    // 封面视频 mixWithOthers / moviePlayback：勿抢 exclusive。
    // 否则 setCategory 成功、setActive 失败（OSStatus -50），会话半死，AVPlayer 空转无声。
    let coverMix =
      session.categoryOptions.contains(.mixWithOthers) || session.mode == .moviePlayback
    if coverMix {
      sessionArmed = true
      return
    }
    do {
      if force || session.category != .playback || session.categoryOptions.contains(.mixWithOthers) {
        try session.setCategory(.playback, mode: .default, options: [])
      }
      try session.setActive(true, options: [])
      sessionArmed = true
      log("audio session active category=\(session.category.rawValue) opts=\(session.categoryOptions.rawValue)")
    } catch {
      sessionArmed = false
      log("audio session activate failed: \(error.localizedDescription)")
    }
  }

  private func publishNowPlaying(from payload: [String: Any]) {
    var payload = payload
    var playing = jsonBool(payload["playing"])
    let kind = payloadKind(payload)

    // 金句 / 读经：走 App 主工程（金句独立轨可与音乐混播；读经仍占主轨）。
    if kind == "verse" || kind == "scripture" {
      lastPayload = payload
      lastPublishTimestamp = CFAbsoluteTimeGetCurrent()
      refreshTimer?.invalidate()
      refreshTimer = nil
      startPulseTimerIfPlaying(false)
      let userPause = jsonBool(payload["userPause"])
      if !playing {
        // 金句 pause 勿标 nativeUserPaused（那是音乐用户暂停位），否则会挡读经/音乐续播。
        if kind == "scripture", userPause || nativeUserPaused {
          nativeUserPaused = true
        }
        // 一律 apply playing=false：金句 pause 不能误 pause 音乐主轨。
        log("publish pause → app \(kind) apply user=\(userPause)")
        NotificationCenter.default.post(
          name: Notification.Name("me.askbible.music.apply"),
          object: nil,
          userInfo: payload
        )
        return
      }
      nativeUserPaused = false
      if kind == "scripture" {
        UserDefaults.standard.set(false, forKey: Self.wantPlayingDefaultsKey)
      }
      log("publish playing=\(playing) kind=\(kind) → app music service")
      NotificationCenter.default.post(
        name: Notification.Name("me.askbible.music.apply"),
        object: nil,
        userInfo: payload
      )
      return
    }

    // 非音乐（读经/环境音）：可与原生音乐同播，但锁屏标题仍归音乐，避免系统栏来回跳。
    if kind != "music" {
      var musicOwnsNowPlaying = false
      if let music = lastMusicPayload,
         payloadKind(music) == "music",
         (jsonBool(music["playing"]) || UserDefaults.standard.bool(forKey: Self.wantPlayingDefaultsKey)),
         !nativeUserPaused {
        musicOwnsNowPlaying = true
      }
      if musicOwnsNowPlaying {
        log("ignore non-music nowPlaying while music active kind=\(kind)")
        NotificationCenter.default.post(name: Notification.Name("me.askbible.music.resume"), object: nil)
        return
      }
      lastPayload = payload
      lastPublishTimestamp = CFAbsoluteTimeGetCurrent()
      log("publish playing=\(playing) kind=\(kind)")
      activatePlaybackSessionIfNeeded()
      // 后台勿 1s Timer（CPU/jetsam）；前台才轻量刷 Now Playing。
      if playing && kind != "ambient" && UIApplication.shared.applicationState == .active {
        startRefreshTimerIfPlaying(true)
      } else {
        refreshTimer?.invalidate()
        refreshTimer = nil
      }
      startPulseTimerIfPlaying(false)
      publishNowPlayingInternal(payload: payload, advanceElapsed: false, touchSession: false)
      return
    }

    // 音乐：全部交给 App 主工程 AskBibleMusicService（与 Expo module 生命周期解耦）。
    lastPayload = payload
    lastPublishTimestamp = CFAbsoluteTimeGetCurrent()
    lastMusicPayload = payload
    let userPause = jsonBool(payload["userPause"])
    let userPlay = jsonBool(payload["userPlay"])
    if !playing {
      if userPause || nativeUserPaused {
        nativeUserPaused = true
        UserDefaults.standard.set(false, forKey: Self.wantPlayingDefaultsKey)
        log("publish pause → app music pause user=\(userPause)")
        NotificationCenter.default.post(name: Notification.Name("me.askbible.music.pause"), object: nil)
        return
      }
      log("publish playing=false kind=music → app music service")
      NotificationCenter.default.post(
        name: Notification.Name("me.askbible.music.apply"),
        object: nil,
        userInfo: payload
      )
      return
    }
    // 用户点停后，勿被 JS sync 的 playing=true 清掉 paused / wantPlaying。
    if nativeUserPaused && !userPlay {
      log("ignore publish play while userPaused")
      return
    }
    nativeUserPaused = false
    UserDefaults.standard.set(true, forKey: Self.wantPlayingDefaultsKey)
    log("publish playing=\(playing) kind=music → app music service")
    NotificationCenter.default.post(
      name: Notification.Name("me.askbible.music.apply"),
      object: nil,
      userInfo: payload
    )
  }

  private func handleAppLifecycleRefresh(forceSession: Bool) {
    if forceSession {
      activatePlaybackSessionIfNeeded(force: true)
    }
    becomePlaybackFirstResponderIfNeeded()
    guard let payload = lastPayload else { return }
    publishNowPlayingInternal(payload: payload, advanceElapsed: false, touchSession: false)
    if let music = lastMusicPayload,
       payloadKind(music) == "music",
       jsonBool(music["playing"]),
       !nativeUserPaused {
      beginNativeMusicIfNeeded()
    }
  }

  private func startRefreshTimerIfPlaying(_ playing: Bool) {
    if !playing {
      refreshTimer?.invalidate()
      refreshTimer = nil
      return
    }
    // 已有定时器就别重建：JS 每 2.5s updateSession 会把 1s/8s 定时器掐死，锁屏后约 1 分钟被系统杀后台。
    if refreshTimer != nil { return }

    let timer = Timer(timeInterval: 1.0, repeats: true) { _ in
      guard !Self.sharedUserPaused else { return }
      guard var payload = Self.sharedLastMusicPayload ?? Self.sharedLastPayload else { return }
      let engine = NativeMusicEngine.shared
      guard Self.jsonBoolStatic(payload["playing"]) || engine.isPlaying else { return }
      let sink = Self.sharedEventSink
      if engine.player != nil {
        if !engine.isPlaying {
          engine.play()
        }
        if engine.isPlaying {
          payload["positionSec"] = engine.currentTime
          payload["playing"] = true
          Self.sharedLastPayload = payload
          if Self.payloadKindStatic(Self.sharedLastMusicPayload) == "music" {
            Self.sharedLastMusicPayload = payload
          }
          Self.sharedLastPublishTimestamp = CFAbsoluteTimeGetCurrent()
          sink?.publishNowPlayingInternal(payload: payload, advanceElapsed: false, touchSession: false)
          sink?.sendEvent("ShellMediaNativeProgress", [
            "positionSec": engine.currentTime,
            "durationSec": engine.duration,
            "playing": true,
            "kind": "music",
          ])
          return
        }
      }
      sink?.beginNativeMusicIfNeeded()
    }
    RunLoop.main.add(timer, forMode: .common)
    refreshTimer = timer
  }

  private func startPulseTimerIfPlaying(_ playing: Bool) {
    pulseTimer?.invalidate()
    pulseTimer = nil
    guard playing else { return }
    let timer = Timer(timeInterval: 4.0, repeats: true) { [weak self] _ in
      self?.sendEvent("ShellMediaPlaybackPulse", ["playing": true])
    }
    RunLoop.main.add(timer, forMode: .common)
    pulseTimer = timer
  }

  private func publishNowPlayingInternal(payload: [String: Any], advanceElapsed: Bool, touchSession: Bool) {
    if touchSession {
      activatePlaybackSessionIfNeeded()
      becomePlaybackFirstResponderIfNeeded()
    }

    let title = payload["title"] as? String
    let artist = payload["artist"] as? String
    let album = payload["album"] as? String
    let assetUri = payload["assetUri"] as? String
    let durationSec = jsonDouble(payload["durationSec"])
    let positionSec = jsonDouble(payload["positionSec"]) ?? 0
    let playing = jsonBool(payload["playing"])
    let artworkUri = payload["artworkUri"] as? String

    var elapsed = positionSec
    if payloadKind(payload) == "music", musicEngine.player != nil {
      elapsed = musicEngine.currentTime
    } else if advanceElapsed, playing, lastPublishTimestamp > 0 {
      elapsed += CFAbsoluteTimeGetCurrent() - lastPublishTimestamp
    }

    var info = [String: Any]()
    let resolvedTitle = (title?.isEmpty == false) ? title! : "AskBible.me"
    info[MPMediaItemPropertyTitle] = resolvedTitle
    if let artist, !artist.isEmpty {
      info[MPMediaItemPropertyArtist] = artist
    }
    if let album, !album.isEmpty {
      info[MPMediaItemPropertyAlbumTitle] = album
    }
    if let durationSec, durationSec > 0 {
      info[MPMediaItemPropertyPlaybackDuration] = durationSec
      elapsed = min(elapsed, durationSec)
    }
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = max(0, elapsed)
    info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
    info[MPNowPlayingInfoPropertyDefaultPlaybackRate] = 1.0
    if #available(iOS 13.0, *) {
      info[MPNowPlayingInfoPropertyMediaType] = MPNowPlayingInfoMediaType.audio.rawValue
    }
    info[MPNowPlayingInfoPropertyIsLiveStream] = false
    info[MPNowPlayingInfoPropertyPlaybackQueueCount] = 1
    info[MPNowPlayingInfoPropertyPlaybackQueueIndex] = 0
    info[MPNowPlayingInfoPropertyServiceIdentifier] = "me.askbible"
    if let assetUri, let url = URL(string: assetUri) {
      info[MPNowPlayingInfoPropertyAssetURL] = url
      info[MPNowPlayingInfoPropertyExternalContentIdentifier] = assetUri
    } else {
      info[MPNowPlayingInfoPropertyExternalContentIdentifier] = resolvedTitle
    }

    if let artworkUri, let image = loadArtwork(from: artworkUri) {
      let itemArtwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
      info[MPMediaItemPropertyArtwork] = itemArtwork
    }

    let center = MPNowPlayingInfoCenter.default()
    center.nowPlayingInfo = info
    if #available(iOS 13.0, *) {
      center.playbackState = playing ? .playing : .paused
    }
    // 仅 touchSession 路径打日志；1s 进度刷新勿刷盘（后台 IO 无益）。
    if touchSession {
      log(
        "nowPlaying set title=\(resolvedTitle) playing=\(playing) duration=\(durationSec ?? 0) position=\(elapsed) assetUri=\(assetUri ?? "")"
      )
    }
  }

  private func persistNativeMusicProgress(_ position: Double, uri: String?) {
    let defaults = UserDefaults.standard
    defaults.set(position, forKey: Self.positionDefaultsKey)
    if let uri, !uri.isEmpty {
      defaults.set(uri, forKey: Self.uriDefaultsKey)
    }
  }

  private func restorePersistedPosition(for assetUri: String, fallback: Double) -> Double {
    let defaults = UserDefaults.standard
    let savedUri = defaults.string(forKey: Self.uriDefaultsKey) ?? ""
    let savedPos = defaults.double(forKey: Self.positionDefaultsKey)
    let same =
      musicFileIdentity(assetUri) != nil &&
      musicFileIdentity(assetUri) == musicFileIdentity(savedUri)
    if same, savedPos > 1 {
      return savedPos
    }
    return fallback
  }

  private func keepAliveBackgroundIfNeeded() {
    if Self.backgroundKeepAliveTask != .invalid { return }
    Self.backgroundKeepAliveTask = UIApplication.shared.beginBackgroundTask(withName: "askbible-music") {
      if Self.backgroundKeepAliveTask != .invalid {
        UIApplication.shared.endBackgroundTask(Self.backgroundKeepAliveTask)
        Self.backgroundKeepAliveTask = .invalid
      }
    }
  }

  private func endBackgroundKeepAlive() {
    if Self.backgroundKeepAliveTask != .invalid {
      UIApplication.shared.endBackgroundTask(Self.backgroundKeepAliveTask)
      Self.backgroundKeepAliveTask = .invalid
    }
  }

  private func forceNativeMusicAlive(reason: String) {
    guard !nativeUserPaused else { return }
    if !CXCallObserver().calls.filter({ !$0.hasEnded }).isEmpty { return }
    guard payloadKind(lastMusicPayload) == "music" else { return }
    guard jsonBool(lastMusicPayload?["playing"]) || UserDefaults.standard.bool(forKey: Self.wantPlayingDefaultsKey)
    else { return }
    log("force native alive reason=\(reason) → app music service")
    if let music = lastMusicPayload {
      var restored = music
      restored["playing"] = true
      NotificationCenter.default.post(
        name: Notification.Name("me.askbible.music.apply"),
        object: nil,
        userInfo: restored
      )
    } else {
      NotificationCenter.default.post(name: Notification.Name("me.askbible.music.resume"), object: nil)
    }
  }

  private func registerLifecycleObserversIfNeeded() {
    guard !Self.sharedLifecycleRegistered else { return }
    Self.sharedLifecycleRegistered = true

    let center = NotificationCenter.default
    let sink: () -> AskbibleShellMediaControlsModule? = { Self.sharedEventSink }

    Self.sharedLifecycleObservers.append(
      center.addObserver(
        forName: UIApplication.didBecomeActiveNotification,
        object: nil,
        queue: .main
      ) { _ in
        guard let self = sink() else { return }
        self.appIsBackground = false
        self.endBackgroundKeepAlive()
        self.log("lifecycle active")
        // 回前台：原生音乐由 App 主工程 ensureAlive；勿 force 误开播。
        self.handleAppLifecycleRefresh(forceSession: false)
      }
    )
    Self.sharedLifecycleObservers.append(
      center.addObserver(
        forName: UIApplication.didEnterBackgroundNotification,
        object: nil,
        queue: .main
      ) { _ in
        guard let self = sink() else {
          // module 暂时无实例时仍尽量保住会话与播放器。
          NotificationCenter.default.post(name: Notification.Name("me.askbible.music.resume"), object: nil)
          return
        }
        self.appIsBackground = true
        self.log("lifecycle background")
        // 续播只由 App 主工程 AskBibleMusicService.prepareForBackground 负责。
        // 勿 beginBackgroundTask / 连环 forceNativeMusicAlive（易被当成普通后台任务 ~60s 挂起）。
      }
    )
    Self.sharedLifecycleObservers.append(
      center.addObserver(
        forName: AVAudioSession.mediaServicesWereResetNotification,
        object: nil,
        queue: .main
      ) { _ in
        guard let self = sink() else { return }
        self.log("media services reset")
        self.sessionArmed = false
        self.handleAppLifecycleRefresh(forceSession: true)
        self.forceNativeMusicAlive(reason: "media-services-reset")
      }
    )
    Self.sharedLifecycleObservers.append(
      center.addObserver(
        forName: AVAudioSession.interruptionNotification,
        object: nil,
        queue: .main
      ) { notification in
        guard
          let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: rawType)
        else {
          return
        }
        guard let self = sink() else { return }
        if type == .began {
          self.sessionArmed = false
          self.musicEngine.pause()
          self.log("audio interruption began")
          self.sendEvent("AudioSessionInterruptionBegan", ["reason": "audio-session"])
          return
        }
        guard type == .ended else { return }
        var shouldResume = true
        if let optsRaw = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt {
          shouldResume = AVAudioSession.InterruptionOptions(rawValue: optsRaw).contains(.shouldResume)
        }
        self.log("audio interruption ended shouldResume=\(shouldResume)")
        // 来电未结束时勿抢回。其它打断（环境音/视频）仍按用户意图续播。
        let callHeld = !CXCallObserver().calls.filter { !$0.hasEnded }.isEmpty
        if callHeld {
          self.log("audio interruption ended skipped (phone call)")
          return
        }
        let musicWant =
          !self.nativeUserPaused &&
          (Self.jsonBoolStatic(Self.sharedLastMusicPayload?["playing"]) ||
            UserDefaults.standard.bool(forKey: Self.wantPlayingDefaultsKey))
        if shouldResume || musicWant {
          self.nativeUserPaused = false
          self.sessionArmed = false
          self.forceNativeMusicAlive(reason: "interruption-ended")
        }
        self.handleAppLifecycleRefresh(forceSession: true)
        self.sendEvent("AudioSessionInterruptionEnded", ["shouldResume": shouldResume || musicWant])
      }
    )
  }

  private func unregisterLifecycleObservers() {
    let center = NotificationCenter.default
    for observer in Self.sharedLifecycleObservers {
      center.removeObserver(observer)
    }
    Self.sharedLifecycleObservers.removeAll()
    Self.sharedLifecycleRegistered = false
  }

  private func clearNowPlaying() {
    refreshTimer?.invalidate()
    refreshTimer = nil
    pulseTimer?.invalidate()
    pulseTimer = nil
    endNativeMusic(resumeJs: false, reason: "clear")
    lastPayload = nil
    lastMusicPayload = nil
    lastPublishTimestamp = 0

    let center = MPNowPlayingInfoCenter.default()
    center.nowPlayingInfo = nil
    if #available(iOS 13.0, *) {
      center.playbackState = .stopped
    }
  }

  private func payloadKind(_ payload: [String: Any]?) -> String {
    guard let raw = payload?["kind"] as? String, !raw.isEmpty else {
      // 旧 payload 无 kind：有长时长资产视为 music，避免误伤。
      let dur = jsonDouble(payload?["durationSec"]) ?? 0
      if dur >= 60 { return "music" }
      return "other"
    }
    return raw
  }

  /// Metro Debug 的 http(s) 资源不能给 AVPlayer；仅本地 file 才接管。
  private func resolveLocalMusicFileURL(_ assetUri: String) -> URL? {
    let trimmed = assetUri.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    if let url = URL(string: trimmed), let scheme = url.scheme?.lowercased(), !scheme.isEmpty {
      if scheme == "http" || scheme == "https" {
        return nil
      }
      if url.isFileURL || scheme == "file" {
        return url.standardizedFileURL
      }
      return nil
    }
    if trimmed.hasPrefix("/") {
      return URL(fileURLWithPath: trimmed).standardizedFileURL
    }
    return nil
  }

  /// `/private/var/...` 与 `/var/...` 是同一文件；用标准化 path 比较，避免反复 switch-track。
  private func musicFileIdentity(_ assetUri: String) -> String? {
    guard let url = resolveLocalMusicFileURL(assetUri) else { return nil }
    var path = url.path
    if path.hasPrefix("/private/") {
      path = String(path.dropFirst("/private".count))
    }
    return path
  }

  private static var appMusicEventObserver: NSObjectProtocol?

  private func registerAppMusicEventBridgeIfNeeded() {
    if Self.appMusicEventObserver != nil { return }
    Self.appMusicEventObserver = NotificationCenter.default.addObserver(
      forName: Notification.Name("me.askbible.music.event"),
      object: nil,
      queue: .main
    ) { note in
      guard
        let name = note.userInfo?["name"] as? String,
        let body = note.userInfo?["body"] as? [String: Any]
      else { return }
      // 后台勿把高频 Progress 丢进 JS 桥（易拖死主线程，约 60s 后整进程停）。
      if name == "ShellMediaNativeProgress",
         UIApplication.shared.applicationState != .active {
        return
      }
      Self.sharedEventSink?.sendEvent(name, body)
    }
  }

  /// 音乐播放已迁到 App 主工程；此处只 ping 服务。
  private func beginNativeMusicIfNeeded() {
    guard let payload = lastMusicPayload, payloadKind(payload) == "music" else { return }
    NotificationCenter.default.post(
      name: Notification.Name("me.askbible.music.apply"),
      object: nil,
      userInfo: payload
    )
  }

  private func endNativeMusic(resumeJs: Bool, reason: String) {
    guard musicEngine.player != nil || musicEngine.assetUri != nil else { return }
    tearDownNativePlayer(emitRelease: resumeJs, reason: reason)
  }

  private func tearDownNativePlayer(emitRelease: Bool, reason: String) {
    nativeHealthTimer?.invalidate()
    nativeHealthTimer = nil
    let position = musicEngine.stopAndClear()
    if emitRelease {
      sendEvent("ShellMediaNativeRelease", ["positionSec": position, "reason": reason])
      if var latest = lastPayload {
        latest["positionSec"] = position
        lastPayload = latest
        lastPublishTimestamp = CFAbsoluteTimeGetCurrent()
      }
    }
    log("native music ended resumeJs=\(emitRelease) reason=\(reason) pos=\(position)")
  }

  private func startNativeHealthTimer() {
    // 勿在每次 updateSession 时 invalidate：8s 心跳会被 2.5s JS 刷新永远推迟。
    if nativeHealthTimer != nil { return }
    let timer = Timer(timeInterval: 8.0, repeats: true) { _ in
      let sink = Self.sharedEventSink
      guard Self.payloadKindStatic(Self.sharedLastMusicPayload) == "music" else { return }
      let engine = NativeMusicEngine.shared
      guard engine.player != nil else {
        sink?.log("native heartbeat missing player")
        sink?.beginNativeMusicIfNeeded()
        return
      }
      let playing = engine.isPlaying
      let t = engine.currentTime
      let line = "native heartbeat playing=\(playing) t=\(t)"
      if let sink {
        sink.log(line)
      } else {
        NSLog("[askbible-shell-media] %@", line)
      }
      if !Self.sharedUserPaused,
         Self.jsonBoolStatic(Self.sharedLastMusicPayload?["playing"]),
         !playing {
        sink?.log("native heartbeat dead → restart")
        engine.play()
        if !engine.isPlaying {
          _ = engine.stopAndClear()
          sink?.beginNativeMusicIfNeeded()
        }
        if !NativeMusicEngine.shared.isPlaying {
          sink?.log("native heartbeat restart failed")
          sink?.sendEvent("ShellMediaNativeStopped", ["reason": "heartbeat-dead"])
        }
      } else if playing {
        if var music = Self.sharedLastMusicPayload {
          music["positionSec"] = t
          music["playing"] = true
          Self.sharedLastMusicPayload = music
          Self.sharedLastPayload = music
          sink?.persistNativeMusicProgress(t, uri: engine.assetUri)
          sink?.publishNowPlayingInternal(payload: music, advanceElapsed: false, touchSession: false)
        }
        sink?.sendEvent("ShellMediaNativeProgress", [
          "positionSec": t,
          "durationSec": engine.duration,
          "playing": true,
          "kind": "music",
        ])
      }
    }
    RunLoop.main.add(timer, forMode: .common)
    nativeHealthTimer = timer
    log("native health timer armed")
  }

  private static func armSleepTimer(deadlineMs: Double) {
    sleepTimerWork?.cancel()
    sleepTimerWork = nil
    guard deadlineMs > 0 else {
      NSLog("[askbible-shell-media] %@", "sleep timer cleared")
      return
    }
    let delay = deadlineMs / 1000.0 - Date().timeIntervalSince1970
    let work = DispatchWorkItem {
      Self.fireSleepTimer()
    }
    sleepTimerWork = work
    if delay <= 0 {
      DispatchQueue.main.async(execute: work)
      return
    }
    DispatchQueue.main.asyncAfter(wallDeadline: .now() + delay, execute: work)
    NSLog("[askbible-shell-media] %@", "sleep timer armed delay=\(String(format: "%.1f", delay))s")
  }

  private static func fireSleepTimer() {
    sleepTimerWork = nil
    sharedUserPaused = true
    if var last = sharedLastPayload {
      last["playing"] = false
      sharedLastPayload = last
      if payloadKindStatic(last) == "music" {
        sharedLastMusicPayload = last
      }
    }
    UserDefaults.standard.set(false, forKey: wantPlayingDefaultsKey)
    NotificationCenter.default.post(name: Notification.Name("me.askbible.music.sleepTimer"), object: nil)
    do {
      try AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
      sharedSessionArmed = false
    } catch {
      NSLog("[askbible-shell-media] %@", "sleep timer deactivate failed: \(error.localizedDescription)")
    }
    sharedEventSink?.sendEvent("ShellMediaSleepTimerFired", [:] as [String: Any])
    NSLog("[askbible-shell-media] %@", "sleep timer fired")
  }

  private static func payloadKindStatic(_ payload: [String: Any]?) -> String {
    guard let raw = payload?["kind"] as? String, !raw.isEmpty else {
      let dur: Double
      switch payload?["durationSec"] {
      case let n as Double: dur = n
      case let n as NSNumber: dur = n.doubleValue
      default: dur = 0
      }
      if dur >= 60 { return "music" }
      return "other"
    }
    return raw
  }

  private static func jsonBoolStatic(_ value: Any?) -> Bool {
    switch value {
    case let b as Bool:
      return b
    case let n as NSNumber:
      return n.boolValue
    default:
      return false
    }
  }

  private func loadArtwork(from uri: String) -> UIImage? {
    var path = uri
    if uri.hasPrefix("file://"), let url = URL(string: uri) {
      path = url.path
    }
    guard !path.isEmpty else { return nil }
    return UIImage(contentsOfFile: path)
  }

  private func jsonDouble(_ value: Any?) -> Double? {
    switch value {
    case let n as Double:
      return n
    case let n as Float:
      return Double(n)
    case let n as Int:
      return Double(n)
    case let n as NSNumber:
      return n.doubleValue
    default:
      return nil
    }
  }

  private func jsonBool(_ value: Any?) -> Bool {
    switch value {
    case let b as Bool:
      return b
    case let n as NSNumber:
      return n.boolValue
    default:
      return false
    }
  }
}

import AVFoundation
import Foundation

/// 壳层音乐唯一声源：AVPlayer（比 AVAudioPlayer 更稳的后台续播）。
/// 进程单例，Expo module 重建后仍续播。
final class NativeMusicEngine {
  static let shared = NativeMusicEngine()

  private(set) var player: AVPlayer?
  private(set) var assetUri: String?
  private var endObserver: NSObjectProtocol?
  private var failObserver: NSObjectProtocol?
  private var statusObservation: NSKeyValueObservation?

  var onFinished: (() -> Void)?
  var onFailed: ((String) -> Void)?

  private init() {}

  var isPlaying: Bool {
    guard let player else { return false }
    if player.timeControlStatus == .playing { return true }
    return player.rate > 0.01
  }

  var currentTime: Double {
    guard let seconds = player?.currentTime().seconds, seconds.isFinite, !seconds.isNaN else {
      return 0
    }
    return max(0, seconds)
  }

  var duration: Double {
    guard let item = player?.currentItem else { return 0 }
    let d = item.duration.seconds
    if d.isFinite, !d.isNaN, d > 0 { return d }
    let assetDur = item.asset.duration.seconds
    if assetDur.isFinite, !assetDur.isNaN, assetDur > 0 { return assetDur }
    return 0
  }

  var fileURL: URL? {
    (player?.currentItem?.asset as? AVURLAsset)?.url
  }

  func play() {
    player?.play()
  }

  func pause() {
    player?.pause()
  }

  @discardableResult
  func stopAndClear() -> Double {
    let pos = currentTime
    tearDown()
    return pos
  }

  func start(fileURL: URL, assetUri: String, position: Double) {
    tearDown()
    let item = AVPlayerItem(url: fileURL)
    let next = AVPlayer(playerItem: item)
    next.automaticallyWaitsToMinimizeStalling = false
    if #available(iOS 15.0, *) {
      next.audiovisualBackgroundPlaybackPolicy = .continuesIfPossible
    }
    player = next
    self.assetUri = assetUri

    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] _ in
      self?.onFinished?()
    }
    failObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemFailedToPlayToEndTime,
      object: item,
      queue: .main
    ) { [weak self] note in
      let message =
        (note.userInfo?[AVPlayerItemFailedToPlayToEndTimeErrorKey] as? Error)?
        .localizedDescription ?? "failed-to-end"
      self?.onFailed?(message)
    }
    statusObservation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
      guard item.status == .failed else { return }
      self?.onFailed?(item.error?.localizedDescription ?? "item-failed")
    }

    let seekTime = CMTime(seconds: max(0, position), preferredTimescale: 600)
    if position > 0.05 {
      next.seek(to: seekTime, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
        self?.player?.play()
      }
    }
    // 本地文件立刻 play；seek 完成后再补一次，避免只等回调导致短暂无声被系统判定非媒体。
    next.play()
  }

  private func tearDown() {
    if let endObserver {
      NotificationCenter.default.removeObserver(endObserver)
      self.endObserver = nil
    }
    if let failObserver {
      NotificationCenter.default.removeObserver(failObserver)
      self.failObserver = nil
    }
    statusObservation?.invalidate()
    statusObservation = nil
    player?.pause()
    player?.replaceCurrentItem(with: nil)
    player = nil
    assetUri = nil
  }
}

