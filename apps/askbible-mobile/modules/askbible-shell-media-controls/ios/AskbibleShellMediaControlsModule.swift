import AVFoundation
import ExpoModulesCore
import MediaPlayer
import UIKit

public class AskbibleShellMediaControlsModule: Module {
  private var remoteCommandsRegistered = false
  private var lastPayload: [String: Any]?
  private var lastPublishTimestamp: CFAbsoluteTime = 0
  private var refreshTimer: Timer?
  private var lifecycleObservers: [NSObjectProtocol] = []
  private static let debugLogFileName = "askbible-shell-media.log"

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

    Events("RemotePlay", "RemotePause", "RemoteToggle", "RemoteNext", "RemotePrevious")

    Function("updateSession") { (json: String) in
      DispatchQueue.main.async {
        self.handleUpdateSession(json: json)
      }
    }

    Function("clearSession") {
      DispatchQueue.main.async {
        self.clearNowPlaying()
      }
    }

    OnCreate {
      DispatchQueue.main.async {
        self.log("module create")
        UIApplication.shared.beginReceivingRemoteControlEvents()
        self.activatePlaybackSessionIfNeeded()
        self.becomePlaybackFirstResponderIfNeeded()
        self.registerLifecycleObserversIfNeeded()
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.unregisterLifecycleObservers()
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
    guard !remoteCommandsRegistered else { return }
    remoteCommandsRegistered = true

    log("register remote commands")
    UIApplication.shared.beginReceivingRemoteControlEvents()
    activatePlaybackSessionIfNeeded()
    becomePlaybackFirstResponderIfNeeded()

    let center = MPRemoteCommandCenter.shared()
    center.playCommand.isEnabled = true
    center.pauseCommand.isEnabled = true
    center.togglePlayPauseCommand.isEnabled = true
    center.nextTrackCommand.isEnabled = true
    center.previousTrackCommand.isEnabled = true
    center.skipForwardCommand.isEnabled = false
    center.skipBackwardCommand.isEnabled = false

    center.playCommand.addTarget { [weak self] _ in
      self?.sendEvent("RemotePlay")
      return .success
    }
    center.pauseCommand.addTarget { [weak self] _ in
      self?.sendEvent("RemotePause")
      return .success
    }
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      self?.sendEvent("RemoteToggle")
      return .success
    }
    center.nextTrackCommand.addTarget { [weak self] _ in
      self?.sendEvent("RemoteNext")
      return .success
    }
    center.previousTrackCommand.addTarget { [weak self] _ in
      self?.sendEvent("RemotePrevious")
      return .success
    }
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

  private func activatePlaybackSessionIfNeeded() {
    let session = AVAudioSession.sharedInstance()
    do {
      if #available(iOS 13.0, *) {
        if session.category != .playback || session.routeSharingPolicy != .longFormAudio {
          try session.setCategory(
            .playback,
            mode: .default,
            policy: .longFormAudio,
            options: [.allowBluetooth, .allowAirPlay]
          )
        }
      } else if session.category != .playback {
        try session.setCategory(
          .playback,
          mode: .default,
          options: [.allowBluetooth, .allowAirPlay]
        )
      }
      try session.setActive(true, options: [])
      if #available(iOS 13.0, *) {
        log("audio session active category=\(session.category.rawValue) policy=\(session.routeSharingPolicy.rawValue)")
      } else {
        log("audio session active category=\(session.category.rawValue)")
      }
    } catch {
      log("audio session activate failed: \(error.localizedDescription)")
    }
  }

  private func publishNowPlaying(from payload: [String: Any]) {
    lastPayload = payload
    lastPublishTimestamp = CFAbsoluteTimeGetCurrent()

    let playing = jsonBool(payload["playing"])
    log("publish playing=\(playing)")
    startRefreshTimerIfPlaying(playing)
    publishNowPlayingInternal(payload: payload, advanceElapsed: false)
  }

  private func registerLifecycleObserversIfNeeded() {
    guard lifecycleObservers.isEmpty else { return }

    let center = NotificationCenter.default
    lifecycleObservers.append(
      center.addObserver(
        forName: UIApplication.didBecomeActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.handleAppLifecycleRefresh()
      }
    )
    lifecycleObservers.append(
      center.addObserver(
        forName: UIApplication.didEnterBackgroundNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.handleAppLifecycleRefresh()
      }
    )
    lifecycleObservers.append(
      center.addObserver(
        forName: AVAudioSession.mediaServicesWereResetNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.log("media services reset")
        self?.handleAppLifecycleRefresh()
      }
    )
    lifecycleObservers.append(
      center.addObserver(
        forName: AVAudioSession.interruptionNotification,
        object: nil,
        queue: .main
      ) { [weak self] notification in
        guard
          let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          AVAudioSession.InterruptionType(rawValue: rawType) == .ended
        else {
          return
        }
        self?.log("audio interruption ended")
        self?.handleAppLifecycleRefresh()
      }
    )
  }

  private func unregisterLifecycleObservers() {
    let center = NotificationCenter.default
    for observer in lifecycleObservers {
      center.removeObserver(observer)
    }
    lifecycleObservers.removeAll()
  }

  private func handleAppLifecycleRefresh() {
    activatePlaybackSessionIfNeeded()
    becomePlaybackFirstResponderIfNeeded()
    guard let payload = lastPayload else { return }
    publishNowPlayingInternal(payload: payload, advanceElapsed: false)
  }

  private func startRefreshTimerIfPlaying(_ playing: Bool) {
    refreshTimer?.invalidate()
    refreshTimer = nil
    guard playing else { return }

    refreshTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
      guard let self, let payload = self.lastPayload else { return }
      self.publishNowPlayingInternal(payload: payload, advanceElapsed: true)
    }
  }

  private func publishNowPlayingInternal(payload: [String: Any], advanceElapsed: Bool) {
    activatePlaybackSessionIfNeeded()
    becomePlaybackFirstResponderIfNeeded()

    let title = payload["title"] as? String
    let artist = payload["artist"] as? String
    let album = payload["album"] as? String
    let assetUri = payload["assetUri"] as? String
    let durationSec = jsonDouble(payload["durationSec"])
    let positionSec = jsonDouble(payload["positionSec"]) ?? 0
    let playing = jsonBool(payload["playing"])
    let artworkUri = payload["artworkUri"] as? String

    var elapsed = positionSec
    if advanceElapsed, playing, lastPublishTimestamp > 0 {
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
    log(
      "nowPlaying set title=\(resolvedTitle) playing=\(playing) duration=\(durationSec ?? 0) position=\(elapsed) assetUri=\(assetUri ?? "")"
    )
  }

  private func clearNowPlaying() {
    refreshTimer?.invalidate()
    refreshTimer = nil
    lastPayload = nil
    lastPublishTimestamp = 0
    log("clear nowPlaying")

    let center = MPNowPlayingInfoCenter.default()
    center.nowPlayingInfo = nil
    if #available(iOS 13.0, *) {
      center.playbackState = .stopped
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
