import Foundation
import UIKit
import WebKit
import WidgetKit

/// 亲儿子极薄原生底座桥（DECISIONS D-44 / D-47）：
/// 1. `askbible-pack://app/` 同源离线协议处理器：优先 `AppPackStore`（`pack-manifest.json` 增量包）与 `/local-db/*` SQLite 直查，兼容 `PackStore.loadWebPackFiles()`，响应强制 `Cache-Control: no-store, no-cache`；
/// 2. `window.AskBibleBridge` 5 组最小双向协议（委派给 `AskBibleBridgeDispatcher`）并保留 `window.askbibleNative` 向后兼容；
/// 3. 锁死橡皮筋露白与长按菜单、软键盘高度托底与 3 秒热更健康看门狗。
final class LocalPackURLSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "askbible-pack"
    static let baseOrigin = "askbible-pack://app"
    static let noCacheHeader = "no-store, no-cache"

    private let appPackStore: AppPackStore
    private let localDBRouter: LocalDBRouter
    private let stoppedLock = NSLock()
    private var stoppedTasks: Set<ObjectIdentifier> = []

    init(appPackStore: AppPackStore = .shared, localDBRouter: LocalDBRouter = .shared) {
        self.appPackStore = appPackStore
        self.localDBRouter = localDBRouter
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        let rawPath = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !rawPath.contains(".."), !rawPath.contains("\\") else {
            urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
            return
        }

        // 1) D-47 本地 SQLite 直查路由：/local-db/chapter, /local-db/search, /local-db/translations
        if localDBRouter.canHandle(path: url.path) {
            let res = localDBRouter.handle(url: url)
            deliver(urlSchemeTask: urlSchemeTask, url: url, statusCode: res.statusCode, contentType: "application/json; charset=utf-8", data: res.body)
            return
        }

        // 2) D-47 文件级静态内核（active 沙盒 -> builtin app-pack/）
        if let resolved = appPackStore.resolveFile(relativePath: rawPath) {
            let ext = (resolved.resolvedPath as NSString).pathExtension
            deliver(urlSchemeTask: urlSchemeTask, url: url, statusCode: 200, contentType: Self.mimeType(for: ext), data: resolved.data)
            return
        }

        let targetPath = rawPath.isEmpty ? "index.html" : rawPath

        // 3) 兼容 D-44 单文件离线胶囊（web-pack.json）
        if let snapshot = PackStore.loadWebPackFiles(),
           let data = snapshot.files[targetPath] {
            let ext = (targetPath as NSString).pathExtension
            deliver(urlSchemeTask: urlSchemeTask, url: url, statusCode: 200, contentType: Self.mimeType(for: ext), data: data)
            return
        }

        // 4) 本地资源 / SQLite 文件兜底
        if let fileURL = resolveLocalAsset(relativePath: targetPath),
           let data = try? Data(contentsOf: fileURL) {
            deliver(urlSchemeTask: urlSchemeTask, url: url, statusCode: 200, contentType: Self.mimeType(for: fileURL.pathExtension), data: data)
            return
        }

        // 5) SPA history 路由无扩展名回退到入口 HTML
        let ext = (targetPath as NSString).pathExtension
        if ext.isEmpty,
           let entry = appPackStore.resolveFile(relativePath: appPackStore.activeEntryPath()) {
            deliver(urlSchemeTask: urlSchemeTask, url: url, statusCode: 200, contentType: "text/html; charset=utf-8", data: entry.data)
            return
        }

        deliver(urlSchemeTask: urlSchemeTask, url: url, statusCode: 404, contentType: "text/plain; charset=utf-8", data: Data("Not Found".utf8))
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        stoppedLock.lock()
        stoppedTasks.insert(ObjectIdentifier(urlSchemeTask as AnyObject))
        stoppedLock.unlock()
    }

    private func deliver(urlSchemeTask: WKURLSchemeTask, url: URL, statusCode: Int, contentType: String, data: Data) {
        let key = ObjectIdentifier(urlSchemeTask as AnyObject)
        stoppedLock.lock()
        let cancelled = stoppedTasks.remove(key) != nil
        stoppedLock.unlock()
        if cancelled { return }

        let resp = HTTPURLResponse(url: url, statusCode: statusCode, httpVersion: "HTTP/1.1", headerFields: [
            "Content-Type": contentType,
            "Content-Length": "\(data.count)",
            "Cache-Control": Self.noCacheHeader,
            "Access-Control-Allow-Origin": "*",
        ])!
        urlSchemeTask.didReceive(resp)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    private func resolveLocalAsset(relativePath: String) -> URL? {
        let fm = FileManager.default
        let fileName = (relativePath as NSString).lastPathComponent
        let baseName = (fileName as NSString).deletingPathExtension
        let ext = (fileName as NSString).pathExtension

        if ext == "sqlite" {
            if baseName == "info-edition", fm.fileExists(atPath: InfoEditionDownloader.localFileURL.path) {
                return InfoEditionDownloader.localFileURL
            }
            if ScriptureDatabase.isInstalled(baseName) {
                return ScriptureDatabase.installedFile(baseName)
            }
        }
        let appSupportWeb = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("web-pack", isDirectory: true)
            .appendingPathComponent(relativePath)
        if fm.fileExists(atPath: appSupportWeb.path) {
            return appSupportWeb
        }
        return Bundle.main.url(forResource: baseName, withExtension: ext.isEmpty ? nil : ext)
    }

    static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest", "map": return "application/json; charset=utf-8"
        case "sqlite": return "application/vnd.sqlite3"
        case "wasm": return "application/wasm"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "mp3": return "audio/mpeg"
        case "m4a": return "audio/mp4"
        case "txt": return "text/plain; charset=utf-8"
        default: return "application/octet-stream"
        }
    }
}

private final class WeakScriptMessageProxy: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

@MainActor
final class NativeMediaBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "askbibleNative"
    static let bridgeHandlerName = "askbibleBridge"
    static let watchdogTimeoutSec: TimeInterval = 3.0

    let dispatcher = AskBibleBridgeDispatcher()

    weak var chapterAudio: ChapterAudioPlayer? {
        didSet { dispatcher.chapterAudio = chapterAudio }
    }
    weak var musicPlayer: MusicPlayer? {
        didSet { dispatcher.musicPlayer = musicPlayer }
    }
    weak var homeController: HomeVerseController? {
        didSet { dispatcher.homeController = homeController }
    }
    weak var ambientPlayer: AmbientPlayer? {
        didSet { dispatcher.ambientPlayer = ambientPlayer }
    }
    weak var authStore: MemberAuthStore? {
        didSet { dispatcher.authStore = authStore }
    }
    weak var scriptureStore: ScriptureStore? {
        didSet { dispatcher.scriptureStore = scriptureStore }
    }

    var onSetSleepTimer: ((Int) -> Void)? {
        didSet { dispatcher.onSetSleepTimer = onSetSleepTimer }
    }
    var onOpenChapter: ((String, Int) -> Void)? {
        didSet { dispatcher.onOpenChapter = onOpenChapter }
    }
    var onLoadChapterAudio: ((String, Int, Bool) -> Void)? {
        didSet { dispatcher.onLoadChapterAudio = onLoadChapterAudio }
    }
    var onSetTab: ((String) -> Void)? {
        didSet { dispatcher.onSetTab = onSetTab }
    }
    var onSetTheme: ((String) -> Void)? {
        didSet { dispatcher.onSetTheme = onSetTheme }
    }
    var onOpenAuth: (() -> Void)? {
        didSet { dispatcher.onOpenAuth = onOpenAuth }
    }
    var onSignOut: (() async -> Void)? {
        didSet { dispatcher.onSignOut = onSignOut }
    }
    var onResumeReading: (() -> Void)?
    var onBootHealthy: (() -> Void)?

    private weak var observedWebView: WKWebView?
    private var watchdogURL: URL?
    private var watchdogWorkItem: DispatchWorkItem?
    private var watchdogInitStateJSON: String?
    private var bootHealthyReceived = false
    private var keyboardObservers: [NSObjectProtocol] = []

    deinit {
        for token in keyboardObservers {
            NotificationCenter.default.removeObserver(token)
        }
    }

    /// 构造锁定橡皮筋露白、禁用系统默认长按菜单并注入 `window.AskBibleBridge` 与 `window.askbibleNative` 的 WKWebViewConfiguration
    func makeWebViewConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalPackURLSchemeHandler(), forURLScheme: LocalPackURLSchemeHandler.scheme)
        let ucc = WKUserContentController()
        let proxy = WeakScriptMessageProxy(self)
        ucc.add(proxy, name: Self.handlerName)
        ucc.add(proxy, name: Self.bridgeHandlerName)
        ucc.addUserScript(WKUserScript(source: Self.bootstrapJS, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        config.userContentController = ucc
        return config
    }

    private static let bootstrapJS = """
    (function(){
      document.documentElement.style.overscrollBehavior = 'none';
      document.documentElement.style.webkitTouchCallout = 'none';
      document.addEventListener('contextmenu', function(e){ e.preventDefault(); }, { passive: false });
      window.askbibleNative = {
        platform: 'ios',
        send: function(action, payload) {
          if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.askbibleNative) {
            window.webkit.messageHandlers.askbibleNative.postMessage({ action: action, payload: payload || {} });
          }
        }
      };
      if (!window.__askbiblePending) window.__askbiblePending = Object.create(null);
      if (!window.__askbibleListeners) window.__askbibleListeners = Object.create(null);
      var seq = 1;
      window.__askbibleResolve = function(id, ok, payload) {
        var entry = window.__askbiblePending[id];
        if (!entry) return;
        delete window.__askbiblePending[id];
        if (ok) entry.resolve(payload);
        else entry.reject(new Error((payload && payload.message) || String(payload || 'bridge_error')));
      };
      window.__askbibleEmit = function(event, payload) {
        var set = window.__askbibleListeners[event];
        if (set) {
          set.forEach(function(fn) {
            try { fn(payload); } catch (_) {}
          });
        }
        window.dispatchEvent(new CustomEvent('askbible:' + event, { detail: payload }));
      };
      window.AskBibleBridge = {
        platform: 'ios',
        origin: 'askbible-pack://app',
        call: function(method, params) {
          return new Promise(function(resolve, reject) {
            var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.askbibleBridge;
            if (!handler) {
              reject(new Error('askbibleBridge_unavailable'));
              return;
            }
            var id = String(seq++);
            window.__askbiblePending[id] = { resolve: resolve, reject: reject };
            handler.postMessage({ id: id, method: method, params: params || {} });
          });
        },
        on: function(event, fn) {
          if (!window.__askbibleListeners[event]) window.__askbibleListeners[event] = new Set();
          window.__askbibleListeners[event].add(fn);
          return function() {
            if (window.__askbibleListeners[event]) window.__askbibleListeners[event].delete(fn);
          };
        }
      };
    })();
    """

    /// 配置 WKWebView 滚动与背景：透明羊皮卷底 + 禁止回弹露白 + 关掉系统自动 inset 偏移
    static func hardenWebView(_ webView: WKWebView) {
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.scrollView.showsHorizontalScrollIndicator = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
    }

    func attach(to webView: WKWebView) {
        observedWebView = webView
        dispatcher.attach(to: webView)
        installKeyboardObservers()
    }

    func detach(from webView: WKWebView) {
        cancelWatchdog()
        dispatcher.detach()
        removeKeyboardObservers()
        webView.configuration.userContentController.removeScriptMessageHandler(forName: Self.handlerName)
        webView.configuration.userContentController.removeScriptMessageHandler(forName: Self.bridgeHandlerName)
    }

    /// 加载 D-47 同源静态内核入口（`askbible-pack://app/<entry>`）
    func loadAppPack(in webView: WKWebView, route: String? = nil) {
        attach(to: webView)
        let entry = AppPackStore.shared.activeEntryPath()
        let base = "\(LocalPackURLSchemeHandler.baseOrigin)/\(entry)"
        var url = URL(string: base)!
        if let route, !route.isEmpty, var comps = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            comps.queryItems = [URLQueryItem(name: "route", value: route)]
            if let next = comps.url { url = next }
        }
        watchdogURL = url
        watchdogInitStateJSON = nil
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    /// 直接以内存自包含 HTML 加载胶囊（零子请求等待、0ms 秒开）并启动 3 秒看门狗
    @discardableResult
    func loadInlinePack(in webView: WKWebView, initialStateJSON: String) -> Bool {
        guard let snap = PackStore.loadWebPackFiles(),
              let htmlData = snap.files["index.html"],
              var html = String(data: htmlData, encoding: .utf8) else {
            return false
        }
        if let cssData = snap.files["app.css"], let css = String(data: cssData, encoding: .utf8),
           html.contains("<link rel='stylesheet' href='app.css'>") {
            html = html.replacingOccurrences(of: "<link rel='stylesheet' href='app.css'>", with: "<style>\(css)</style>")
        }
        if let jsData = snap.files["app.js"], let js = String(data: jsData, encoding: .utf8),
           html.contains("<script src='app.js'></script>") {
            html = html.replacingOccurrences(of: "<script src='app.js'></script>", with: "<script>\(js)</script>")
        }
        let initScript = "<script>window.__ASKBIBLE_INIT__=\(initialStateJSON);</script>"
        if html.contains("<!--__ASKBIBLE_INIT_SLOT__-->") {
            html = html.replacingOccurrences(of: "<!--__ASKBIBLE_INIT_SLOT__-->", with: initScript)
        } else {
            html = html.replacingOccurrences(of: "</head>", with: "\(initScript)</head>")
        }
        attach(to: webView)
        watchdogURL = nil
        watchdogInitStateJSON = initialStateJSON
        beginWatchdogIfHotPack()
        webView.loadHTMLString(html, baseURL: URL(string: "\(LocalPackURLSchemeHandler.baseOrigin)/"))
        return true
    }

    /// 加载本地胶囊并启动 3 秒防变砖健康看门狗（仅当加载热更胶囊时启用）
    func loadLocalPack(in webView: WKWebView, url: URL) {
        attach(to: webView)
        watchdogURL = url
        watchdogInitStateJSON = nil
        beginWatchdogIfHotPack()
        webView.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    private func beginWatchdogIfHotPack() {
        cancelWatchdog()
        bootHealthyReceived = false
        guard PackStore.loadWebPackFiles()?.isHotPack == true else { return }

        let item = DispatchWorkItem { [weak self] in
            guard let self, !self.bootHealthyReceived else { return }
            PackStore.rollbackHotWebPack()
            if let wv = self.observedWebView {
                if let initJSON = self.watchdogInitStateJSON {
                    self.loadInlinePack(in: wv, initialStateJSON: initJSON)
                } else if let url = self.watchdogURL {
                    wv.load(URLRequest(url: url))
                }
            }
        }
        watchdogWorkItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.watchdogTimeoutSec, execute: item)
    }

    func cancelWatchdog() {
        watchdogWorkItem?.cancel()
        watchdogWorkItem = nil
    }

    private func installKeyboardObservers() {
        guard keyboardObservers.isEmpty else { return }
        let nc = NotificationCenter.default
        let willChange = nc.addObserver(forName: UIResponder.keyboardWillChangeFrameNotification, object: nil, queue: .main) { [weak self] note in
            Task { @MainActor [weak self] in
                guard let self, let webView = self.observedWebView,
                      let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect,
                      let window = webView.window else { return }
                let localWebFrame = webView.convert(webView.bounds, to: window)
                let overlap = max(0, localWebFrame.maxY - frame.minY)
                self.dispatcher.emitKeyboardHeight(overlap)
            }
        }
        let willHide = nc.addObserver(forName: UIResponder.keyboardWillHideNotification, object: nil, queue: .main) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.dispatcher.emitKeyboardHeight(0)
            }
        }
        keyboardObservers = [willChange, willHide]
    }

    private func removeKeyboardObservers() {
        for token in keyboardObservers {
            NotificationCenter.default.removeObserver(token)
        }
        keyboardObservers.removeAll()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == Self.bridgeHandlerName {
            if let body = message.body as? [String: Any] {
                dispatcher.handleBridgeMessage(body)
            }
            return
        }

        guard message.name == Self.handlerName,
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        let payload = (body["payload"] as? [String: Any]) ?? [:]

        switch action {
        case "bootHealthy":
            bootHealthyReceived = true
            cancelWatchdog()
            onBootHealthy?()
        case "openChapter":
            let bookId = (payload["bookId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let chapter = max(1, (payload["chapter"] as? NSNumber)?.intValue ?? 1)
            if !bookId.isEmpty {
                onOpenChapter?(bookId, chapter)
            }
        case "resumeReading":
            onResumeReading?()
        case "pauseChapter":
            chapterAudio?.pause()
        case "resumeChapter":
            chapterAudio?.resume()
        case "seekChapter":
            if let sec = (payload["seconds"] as? NSNumber)?.doubleValue {
                chapterAudio?.seek(to: sec)
            }
        case "toggleMusic":
            musicPlayer?.toggle()
        case "pauseMusic":
            musicPlayer?.pause()
        case "stopGoldenVerse":
            homeController?.stopVoice()
        case "stopAmbient":
            ambientPlayer?.stop()
        case "setSleepTimer":
            let mins = (payload["minutes"] as? NSNumber)?.intValue ?? 0
            onSetSleepTimer?(max(0, mins))
        case "refreshWidget":
            WidgetCenter.shared.reloadAllTimelines()
        case "setReminder":
            let enabled = (payload["enabled"] as? Bool) ?? false
            let hour = (payload["hour"] as? NSNumber)?.intValue ?? ReadingReminder.shared.hour
            let minute = (payload["minute"] as? NSNumber)?.intValue ?? ReadingReminder.shared.minute
            Task {
                await ReadingReminder.shared.apply(enabled: enabled, hour: hour, minute: minute, locale: AppLocale.current)
            }
        default:
            break
        }
    }
}
