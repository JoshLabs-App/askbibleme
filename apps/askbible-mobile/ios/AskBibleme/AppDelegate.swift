import Expo
import EXNotifications
import React
import ReactAppDependencyProvider
import AVFoundation

private final class ReadingAlarmNotificationDelegate: NSObject, NotificationDelegate {
  static let shared = ReadingAlarmNotificationDelegate()

  func didReceive(
    _ response: UNNotificationResponse,
    completionHandler: @escaping () -> Void
  ) -> Bool {
    let kind = response.notification.request.content.userInfo["kind"] as? String
    guard kind == "reading-reminder" || kind == "reading-alarm-auto-continue" else {
      return false
    }
    AskBibleReadingAlarmBridge.handleNotificationWake()
    return false
  }
}

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  private static let debugLogFileName = "askbible-shell-media.log"

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
      // Diagnostics should never affect startup.
    }
  }

  private func activateShellPlaybackSession(_ application: UIApplication, forceReconfigure: Bool = false) {
    application.beginReceivingRemoteControlEvents()
    let session = AVAudioSession.sharedInstance()
    // 封面视频 mixWithOthers / moviePlayback：勿抢 exclusive，否则 OSStatus -50 把会话弄死、音乐空转无声。
    if session.categoryOptions.contains(.mixWithOthers) || session.mode == .moviePlayback {
      DispatchQueue.main.async { [weak window] in
        window?.rootViewController?.becomeFirstResponder()
      }
      return
    }
    // 普通 playback + options=[]。勿 longFormAudio；勿 allowAirPlay（playback 下 OSStatus -50）。
    if !forceReconfigure,
       session.category == .playback,
       !session.categoryOptions.contains(.mixWithOthers),
       session.mode != .moviePlayback {
      DispatchQueue.main.async { [weak window] in
        window?.rootViewController?.becomeFirstResponder()
      }
      return
    }
    do {
      try session.setCategory(.playback, mode: .default, options: [])
      try session.setActive(true)
      NSLog("[askbible-shell-media] app delegate audio session active")
      appendDebugLine("app delegate audio session active")
    } catch {
      NSLog("[askbible-shell-media] app delegate audio session failed: %@", error.localizedDescription)
      appendDebugLine("app delegate audio session failed: \(error.localizedDescription)")
    }

    DispatchQueue.main.async { [weak window] in
      window?.rootViewController?.becomeFirstResponder()
    }
  }

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
    NotificationCenterManager.shared.addDelegate(ReadingAlarmNotificationDelegate.shared)
    // 音乐引擎在 App 主工程：与 Expo module 生命周期解耦。
    AskBibleMusicService.shared.bootstrap()
    activateShellPlaybackSession(application, forceReconfigure: true)
    if let url = launchOptions?[.url] as? URL, Self.isWidgetPlaybackURL(url) {
      appendDebugLine("widget playback cold launch → schedule return home")
      Self.scheduleReturnToHomeAfterWidgetPlayback()
    }
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
#if os(iOS) || os(tvOS)
    // 回前台：仅补 remote control；ensureAlive 只在本会话已开播时续，不因冷启动 UserDefaults 误播。
    activateShellPlaybackSession(application, forceReconfigure: false)
    AskBibleMusicService.shared.ensureAlive(reason: "appdelegate-active")
#endif
  }

  public override func applicationDidEnterBackground(_ application: UIApplication) {
    super.applicationDidEnterBackground(application)
#if os(iOS) || os(tvOS)
    application.beginReceivingRemoteControlEvents()
    // 同步抢回 playback + 续播，勿等 JS 卸视频（否则 ~60s 被当普通后台挂起）。
    AskBibleMusicService.shared.prepareForBackground()
#endif
  }

  public override func remoteControlReceived(with event: UIEvent?) {
    super.remoteControlReceived(with: event)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if Self.isWidgetPlaybackURL(url) {
      appendDebugLine("widget playback url open → schedule return home")
      Self.scheduleReturnToHomeAfterWidgetPlayback()
    }
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
       let url = userActivity.webpageURL,
       Self.isWidgetPlaybackURL(url) {
      Self.scheduleReturnToHomeAfterWidgetPlayback()
    }
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }

  /// 挂件深链：iOS 必须短暂拉起 App 才能开播；随后短延迟回桌面（可取消，避免普通打开被旧链误 suspend）。
  private static func isWidgetPlaybackURL(_ url: URL?) -> Bool {
    guard let url else { return false }
    let raw = url.absoluteString.lowercased()
    return raw.contains("askbible:") && raw.contains("widget/play")
  }

  private static var returnHomeWorkItems: [DispatchWorkItem] = []
  private static var returnHomeGeneration = 0

  static func suspendAppToHome() {
    // 无公开 API；与常见播放类 App 一样用 suspend 回 SpringBoard。
    UIApplication.shared.perform(NSSelectorFromString("suspend"))
  }

  static func cancelReturnToHomeAfterWidgetPlayback() {
    returnHomeGeneration += 1
    for item in returnHomeWorkItems {
      item.cancel()
    }
    returnHomeWorkItems.removeAll()
  }

  static func scheduleReturnToHomeAfterWidgetPlayback() {
    cancelReturnToHomeAfterWidgetPlayback()
    let generation = returnHomeGeneration
    // 2–3 次短延迟即可；过长会在用户已留在 App 内时仍被踢回桌面。
    let delays: [TimeInterval] = [0.8, 1.8, 3.2]
    for delay in delays {
      let item = DispatchWorkItem {
        guard generation == returnHomeGeneration else { return }
        suspendAppToHome()
      }
      returnHomeWorkItems.append(item)
      DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: item)
    }
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  private static let metroEntryRoot = ".expo/.virtual-metro-entry"
  private static let deviceMetroBundle =
    "http://127.0.0.1:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false"

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bundleURL()
  }

  override func bundleURL() -> URL? {
#if EXPO_CONFIGURATION_DEBUG
    if let url = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: Self.metroEntryRoot) {
      return url
    }
    // USB 真机 + iproxy：Metro 在 Mac，手机经 127.0.0.1:8081 转发。
    return URL(string: Self.deviceMetroBundle)
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
