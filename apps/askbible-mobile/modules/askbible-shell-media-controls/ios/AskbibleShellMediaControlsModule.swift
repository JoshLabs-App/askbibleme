import AVFoundation
import ExpoModulesCore
import MediaPlayer
import UIKit

public class AskbibleShellMediaControlsModule: Module {
  private var remoteCommandsRegistered = false
  private var lastPayload: [String: Any]?
  private var lastPublishTimestamp: CFAbsoluteTime = 0
  private var refreshTimer: Timer?

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
        UIApplication.shared.beginReceivingRemoteControlEvents()
        self.becomePlaybackFirstResponderIfNeeded()
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
    ensureRemoteCommands()
    publishNowPlaying(from: obj)
  }

  private func ensureRemoteCommands() {
    guard !remoteCommandsRegistered else { return }
    remoteCommandsRegistered = true

    UIApplication.shared.beginReceivingRemoteControlEvents()
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
      if session.category != .playback {
        try session.setCategory(
          .playback,
          mode: .default,
          options: [.allowBluetooth, .allowAirPlay]
        )
      }
      try session.setActive(true, options: [])
    } catch {
      /* expo-av 已激活时会成功；失败不阻断 Now Playing 元数据写入 */
    }
  }

  private func publishNowPlaying(from payload: [String: Any]) {
    lastPayload = payload
    lastPublishTimestamp = CFAbsoluteTimeGetCurrent()

    let playing = jsonBool(payload["playing"])
    startRefreshTimerIfPlaying(playing)
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

    if let artworkUri, let image = loadArtwork(from: artworkUri) {
      let itemArtwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
      info[MPMediaItemPropertyArtwork] = itemArtwork
    }

    let center = MPNowPlayingInfoCenter.default()
    if #available(iOS 13.0, *) {
      center.playbackState = playing ? .playing : .paused
    }
    center.nowPlayingInfo = info
  }

  private func clearNowPlaying() {
    refreshTimer?.invalidate()
    refreshTimer = nil
    lastPayload = nil
    lastPublishTimestamp = 0

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
