import SwiftUI
import WebKit

/// 救赎全景（D-47 统一静态内核优先 + D-44 单文件离线胶囊无缝回退）：
/// 底层使用 `ParchmentBackground` 羊皮纸真材实底：
/// - 优先检测 `AppPackStore.shared.hasAvailablePack()`，有则通过 `AppPackWebView(initialRoute: "/panorama", ...)` 渲染；
/// - 尚无 `app-pack` 时回退 `PackStore.loadWebPackFiles()`（`web-pack.json`）或原生入口兜底。
struct BiblePanoramaView: View {
    let locale: AppLocale
    let currentBook: String?
    let currentChapter: Int
    let locateRequest: Int
    var onResume: () -> Void
    var onRead: (String, Int) -> Void
    var onSelectTab: ((String) -> Void)? = nil
    var onBack: (() -> Void)? = nil

    @Environment(\.parchment) private var theme

    var body: some View {
        GeometryReader { geo in
            let topInset = Double(geo.safeAreaInsets.top)
            let bottomInset = Double(geo.safeAreaInsets.bottom + ShellMetrics.tabRowHeight + ShellMetrics.tabBarDockGap + 56)

            ZStack {
                ParchmentBackground(theme: theme)
                    .ignoresSafeArea()

                if AppPackStore.shared.hasAvailablePack() {
                    AppPackWebView(
                        initialRoute: "/panorama",
                        locale: locale,
                        topInset: topInset,
                        bottomInset: bottomInset,
                        extraState: [
                            "book": currentBook ?? "",
                            "ch": max(1, currentChapter),
                            "hasHistory": currentBook != nil,
                            "locateRequest": locateRequest,
                        ],
                        onOpenChapter: onRead,
                        onSelectTab: { tab in
                            if let onSelectTab {
                                onSelectTab(tab)
                            } else if tab == "read" || tab == "home" {
                                onResume()
                            }
                        },
                        onBack: { onBack?() },
                        onResumeReading: onResume
                    )
                    .ignoresSafeArea()
                } else if PackStore.loadWebPackFiles() != nil {
                    PanoramaPackWebView(
                        locale: locale,
                        isDark: theme.isDark,
                        currentBook: currentBook,
                        currentChapter: currentChapter,
                        locateRequest: locateRequest,
                        topInset: topInset,
                        bottomInset: bottomInset,
                        onResume: onResume,
                        onRead: onRead
                    )
                    .ignoresSafeArea()
                } else {
                    fallbackView
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var fallbackView: some View {
        VStack(spacing: 14) {
            Text(AppLocale.pick("救赎全景", "Redemption Story", locale))
                .askFont(size: 24, weight: .bold)
                .foregroundStyle(theme.ink)
            Button {
                if currentBook != nil {
                    onResume()
                } else {
                    onRead("GEN", 1)
                }
            } label: {
                Text(currentBook != nil
                    ? AppLocale.pick("继续阅读", "Continue Reading", locale)
                    : AppLocale.pick("从创世记第 1 章开始", "Begin from Genesis 1", locale))
                    .askFont(size: 14, weight: .semibold)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(theme.accentOt))
            }
            .buttonStyle(.plain)
        }
        .padding(24)
    }
}

private struct PanoramaPackWebView: UIViewRepresentable {
    let locale: AppLocale
    let isDark: Bool
    let currentBook: String?
    let currentChapter: Int
    let locateRequest: Int
    let topInset: Double
    let bottomInset: Double
    let onResume: () -> Void
    let onRead: (String, Int) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onResume: onResume, onRead: onRead)
    }

    func makeUIView(context: Context) -> WKWebView {
        let coord = context.coordinator
        let webView = WKWebView(frame: .zero, configuration: coord.bridge.makeWebViewConfiguration())
        NativeMediaBridge.hardenWebView(webView)
        webView.navigationDelegate = coord
        coord.webView = webView

        let initialJSON = encodeStateJSON()
        coord.lastStateJSON = initialJSON
        coord.bridge.loadInlinePack(in: webView, initialStateJSON: initialJSON)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let coord = context.coordinator
        coord.onResume = onResume
        coord.onRead = onRead

        let stateJSON = encodeStateJSON()
        guard stateJSON != coord.lastStateJSON else { return }
        coord.lastStateJSON = stateJSON
        if coord.didFinishInitialLoad {
            webView.evaluateJavaScript("window.askbibleUpdateState && window.askbibleUpdateState(\(stateJSON));")
        }
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        coordinator.bridge.detach(from: webView)
        webView.navigationDelegate = nil
    }

    private func makeInitialURL() -> URL? {
        var comps = URLComponents(string: "\(LocalPackURLSchemeHandler.baseOrigin)/index.html")
        comps?.queryItems = [
            URLQueryItem(name: "route", value: "panorama"),
            URLQueryItem(name: "locale", value: locale.rawValue),
            URLQueryItem(name: "dark", value: isDark ? "1" : "0"),
            URLQueryItem(name: "scale", value: "1"),
            URLQueryItem(name: "book", value: currentBook ?? ""),
            URLQueryItem(name: "ch", value: "\(max(1, currentChapter))"),
            URLQueryItem(name: "hasHistory", value: currentBook != nil ? "1" : "0"),
            URLQueryItem(name: "locateRequest", value: "\(locateRequest)"),
            URLQueryItem(name: "topInset", value: "\(Int(topInset.rounded()))"),
            URLQueryItem(name: "bottomInset", value: "\(Int(bottomInset.rounded()))"),
            URLQueryItem(name: "embedded", value: "1"),
        ]
        return comps?.url
    }

    private func encodeStateJSON() -> String {
        let dict: [String: Any] = [
            "locale": locale.rawValue,
            "dark": isDark,
            "scale": 1,
            "book": currentBook ?? "",
            "ch": max(1, currentChapter),
            "hasHistory": currentBook != nil,
            "locateRequest": locateRequest,
            "topInset": Int(topInset.rounded()),
            "bottomInset": Int(bottomInset.rounded()),
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let json = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return json
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let bridge = NativeMediaBridge()
        weak var webView: WKWebView?
        var onResume: () -> Void
        var onRead: (String, Int) -> Void
        var lastStateJSON = ""
        var didFinishInitialLoad = false

        init(onResume: @escaping () -> Void, onRead: @escaping (String, Int) -> Void) {
            self.onResume = onResume
            self.onRead = onRead
            super.init()
            bridge.onResumeReading = { [weak self] in self?.onResume() }
            bridge.onOpenChapter = { [weak self] bookId, chapter in self?.onRead(bookId, chapter) }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            didFinishInitialLoad = true
            if !lastStateJSON.isEmpty {
                webView.evaluateJavaScript("window.askbibleUpdateState && window.askbibleUpdateState(\(lastStateJSON));")
            }
        }
    }
}
