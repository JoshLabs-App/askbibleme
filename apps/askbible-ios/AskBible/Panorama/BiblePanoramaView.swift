import SwiftUI
import WebKit

/// 救赎全景（D-44 同源离线胶囊宿主）：
/// 底层使用 `ParchmentBackground` 羊皮纸真材实底，上层挂载 `NativeMediaBridge` + `PackStore` 驱动的
/// 单文件本地离线胶囊（`askbible-pack://app/index.html`），0ms 秒开，支持 SHA-256 热更与 3 秒看门狗自动回退。
struct BiblePanoramaView: View {
    let locale: AppLocale
    let currentBook: String?
    let currentChapter: Int
    let locateRequest: Int
    var onResume: () -> Void
    var onRead: (String, Int) -> Void

    @Environment(\.parchment) private var theme

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ParchmentBackground(theme: theme)
                    .ignoresSafeArea()

                if PackStore.loadWebPackFiles() != nil {
                    PanoramaPackWebView(
                        locale: locale,
                        isDark: theme.isDark,
                        currentBook: currentBook,
                        currentChapter: currentChapter,
                        locateRequest: locateRequest,
                        topInset: Double(geo.safeAreaInsets.top),
                        bottomInset: Double(geo.safeAreaInsets.bottom + ShellMetrics.tabRowHeight + ShellMetrics.tabBarDockGap + 56),
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
