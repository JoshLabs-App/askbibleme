import SwiftUI
import UIKit
import WebKit

/// D-47 可复用 10% 原生轻壳容器（`askbible-pack://app/index.html?route=<encoded>`）。
///
/// 职责：
/// - 挂载 `LocalPackURLSchemeHandler` + `AskBibleBridge` 的透明 `WKWebView`；
/// - 底层锁定 `ParchmentBackground` 羊皮卷实底防首帧闪白，并禁止橡皮筋露白；
/// - 同步当前深浅色、语言与安全区边距，接通 `onOpenChapter` / `onSelectTab` / `onBack` 与 `pack.readyToSwap`；
/// - 当 `AppPackStore` 尚无可用静态包时，`isAvailable == false` 供调用方无缝回退旧兜底。
struct AppPackWebView: View {
    let initialRoute: String
    let locale: AppLocale
    var topInset: Double = 0
    var bottomInset: Double = 0
    var extraState: [String: Any] = [:]
    var appPackStore: AppPackStore = .shared
    var onOpenChapter: (String, Int) -> Void = { _, _ in }
    var onSelectTab: (String) -> Void = { _ in }
    var onBack: () -> Void = {}
    var onResumeReading: () -> Void = {}

    @Environment(\.parchment) private var theme

    static var isAvailable: Bool {
        AppPackStore.shared.hasAvailablePack()
    }

    var isAvailable: Bool {
        appPackStore.hasAvailablePack()
    }

    var body: some View {
        if isAvailable {
            ZStack {
                ParchmentBackground(theme: theme)
                    .ignoresSafeArea()

                AppPackWebViewRepresentable(
                    initialRoute: Self.normalizedRoute(initialRoute),
                    locale: locale,
                    isDark: theme.isDark,
                    underPageColor: UIColor(theme.canvas),
                    topInset: topInset,
                    bottomInset: bottomInset,
                    extraState: extraState,
                    appPackStore: appPackStore,
                    onOpenChapter: onOpenChapter,
                    onSelectTab: onSelectTab,
                    onBack: onBack,
                    onResumeReading: onResumeReading
                )
                .ignoresSafeArea()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    static func normalizedRoute(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "/" }
        return trimmed.hasPrefix("/") ? trimmed : "/\(trimmed)"
    }
}

private struct AppPackWebViewRepresentable: UIViewRepresentable {
    let initialRoute: String
    let locale: AppLocale
    let isDark: Bool
    let underPageColor: UIColor
    let topInset: Double
    let bottomInset: Double
    let extraState: [String: Any]
    let appPackStore: AppPackStore
    let onOpenChapter: (String, Int) -> Void
    let onSelectTab: (String) -> Void
    let onBack: () -> Void
    let onResumeReading: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(
            appPackStore: appPackStore,
            onOpenChapter: onOpenChapter,
            onSelectTab: onSelectTab,
            onBack: onBack,
            onResumeReading: onResumeReading
        )
    }

    func makeUIView(context: Context) -> WKWebView {
        let coord = context.coordinator
        let config = coord.bridge.makeWebViewConfiguration()
        config.setURLSchemeHandler(
            LocalPackURLSchemeHandler(appPackStore: appPackStore),
            forURLScheme: LocalPackURLSchemeHandler.scheme
        )

        let stateJSON = encodeStateJSON()
        coord.lastStateJSON = stateJSON
        coord.lastLocale = locale
        coord.lastIsDark = isDark

        let preloadJS = Self.makeSyncScript(stateJSON: stateJSON, locale: locale.rawValue, isDark: isDark)
        config.userContentController.addUserScript(
            WKUserScript(source: preloadJS, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        )

        let webView = WKWebView(frame: .zero, configuration: config)
        NativeMediaBridge.hardenWebView(webView)
        webView.underPageBackgroundColor = underPageColor
        webView.navigationDelegate = coord
        coord.webView = webView

        let queryItems = [
            URLQueryItem(name: "locale", value: locale.rawValue),
            URLQueryItem(name: "theme", value: isDark ? "dark" : "light"),
            URLQueryItem(name: "dark", value: isDark ? "1" : "0"),
            URLQueryItem(name: "embedded", value: "1"),
        ]
        coord.bridge.loadAppPack(in: webView, route: initialRoute, queryItems: queryItems)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let coord = context.coordinator
        coord.onOpenChapter = onOpenChapter
        coord.onSelectTab = onSelectTab
        coord.onBack = onBack
        coord.onResumeReading = onResumeReading
        webView.underPageBackgroundColor = underPageColor

        let stateJSON = encodeStateJSON()
        let changed = stateJSON != coord.lastStateJSON
            || locale != coord.lastLocale
            || isDark != coord.lastIsDark
        guard changed else { return }

        coord.lastStateJSON = stateJSON
        coord.lastLocale = locale
        coord.lastIsDark = isDark
        if coord.didFinishInitialLoad {
            coord.pushStateToWeb(webView, stateJSON: stateJSON, locale: locale.rawValue, isDark: isDark)
        }
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.teardown(webView: webView)
    }

    private func encodeStateJSON() -> String {
        var dict = extraState
        dict["route"] = initialRoute
        dict["locale"] = locale.rawValue
        dict["theme"] = isDark ? "dark" : "light"
        dict["dark"] = isDark
        dict["topInset"] = Int(topInset.rounded())
        dict["bottomInset"] = Int(bottomInset.rounded())
        guard JSONSerialization.isValidJSONObject(dict),
              let data = try? JSONSerialization.data(withJSONObject: dict, options: [.sortedKeys]),
              let json = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return json
    }

    private static func makeSyncScript(stateJSON: String, locale: String, isDark: Bool) -> String {
        let safeLocale = locale.replacingOccurrences(of: "'", with: "\\'")
        let themeMode = isDark ? "dark" : "light"
        return """
        (function(){
          var root = document.documentElement;
          if (root) {
            root.dataset.theme = '\(themeMode)';
            root.lang = '\(safeLocale)';
            root.style.colorScheme = '\(themeMode)';
            root.style.backgroundColor = 'transparent';
          }
          window.__ASKBIBLE_INIT__ = \(stateJSON);
        })();
        """
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let bridge = NativeMediaBridge()
        let appPackStore: AppPackStore
        weak var webView: WKWebView?
        var onOpenChapter: (String, Int) -> Void
        var onSelectTab: (String) -> Void
        var onBack: () -> Void
        var onResumeReading: () -> Void
        var lastStateJSON = "{}"
        var lastLocale: AppLocale = .zhCN
        var lastIsDark = false
        var didFinishInitialLoad = false
        private var customStoreObserver: NSObjectProtocol?

        init(
            appPackStore: AppPackStore,
            onOpenChapter: @escaping (String, Int) -> Void,
            onSelectTab: @escaping (String) -> Void,
            onBack: @escaping () -> Void,
            onResumeReading: @escaping () -> Void
        ) {
            self.appPackStore = appPackStore
            self.onOpenChapter = onOpenChapter
            self.onSelectTab = onSelectTab
            self.onBack = onBack
            self.onResumeReading = onResumeReading
            super.init()

            bridge.onOpenChapter = { [weak self] bookId, chapter in self?.onOpenChapter(bookId, chapter) }
            bridge.onSetTab = { [weak self] tab in self?.onSelectTab(tab) }
            bridge.onBack = { [weak self] in self?.onBack() }
            bridge.onResumeReading = { [weak self] in self?.onResumeReading() }

            if appPackStore !== AppPackStore.shared {
                customStoreObserver = NotificationCenter.default.addObserver(
                    forName: AppPackStore.readyToSwapNotification,
                    object: appPackStore,
                    queue: .main
                ) { [weak self] note in
                    guard let bundleId = note.userInfo?["bundleId"] as? String else { return }
                    Task { @MainActor [weak self] in
                        self?.bridge.dispatcher.emit(event: "pack.readyToSwap", payload: ["bundleId": bundleId])
                    }
                }
            }
        }

        func teardown(webView: WKWebView) {
            if let token = customStoreObserver {
                NotificationCenter.default.removeObserver(token)
                customStoreObserver = nil
            }
            bridge.detach(from: webView)
            webView.navigationDelegate = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            didFinishInitialLoad = true
            pushStateToWeb(webView, stateJSON: lastStateJSON, locale: lastLocale.rawValue, isDark: lastIsDark)
            if let pendingBundleId = appPackStore.status().pendingBundleId, !pendingBundleId.isEmpty {
                bridge.dispatcher.emit(event: "pack.readyToSwap", payload: ["bundleId": pendingBundleId])
            }
        }

        func pushStateToWeb(_ webView: WKWebView, stateJSON: String, locale: String, isDark: Bool) {
            let safeLocale = locale.replacingOccurrences(of: "'", with: "\\'")
            let themeMode = isDark ? "dark" : "light"
            let js = """
            (function(){
              var root = document.documentElement;
              if (root) {
                root.dataset.theme = '\(themeMode)';
                root.lang = '\(safeLocale)';
                root.style.colorScheme = '\(themeMode)';
              }
              var next = \(stateJSON);
              window.__ASKBIBLE_INIT__ = next;
              if (window.askbibleUpdateState) window.askbibleUpdateState(next);
              if (window.__askbibleEmit) window.__askbibleEmit('shell.stateChanged', next);
            })();
            """
            webView.evaluateJavaScript(js)
        }
    }
}
