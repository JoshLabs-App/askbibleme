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

  private func activateShellPlaybackSession(_ application: UIApplication) {
    application.beginReceivingRemoteControlEvents()
    do {
      let session = AVAudioSession.sharedInstance()
      if #available(iOS 13.0, *) {
        try session.setCategory(
          .playback,
          mode: .default,
          policy: .longFormAudio,
          options: [.allowBluetooth, .allowAirPlay]
        )
      } else {
        try session.setCategory(
          .playback,
          mode: .default,
          options: [.allowBluetooth, .allowAirPlay]
        )
      }
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
    activateShellPlaybackSession(application)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public override func applicationDidBecomeActive(_ application: UIApplication) {
    super.applicationDidBecomeActive(application)
#if os(iOS) || os(tvOS)
    activateShellPlaybackSession(application)
#endif
  }

  public override func applicationDidEnterBackground(_ application: UIApplication) {
    super.applicationDidEnterBackground(application)
#if os(iOS) || os(tvOS)
    activateShellPlaybackSession(application)
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
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
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
