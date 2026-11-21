import Foundation
import WebKit
import WidgetKit

/// 亲儿子极薄原生底座桥（DECISIONS D-44，参考 JoshBox）：
/// 1. `askbible-pack://` 本地离线协议处理器（内存零拷贝直出 `PackStore.loadWebPackFiles()` + 内置 Bundle/SQLite 回退，严防路径穿越）；
/// 2. `window.askbibleNative` 双向消息桥：读经跳转 / 继续阅读 / bootHealthy 健康心跳 / 三路后台音频 / 睡眠定时 / 提醒 / 小组件；
/// 3. 锁死橡皮筋露白与系统默认长按菜单，并内置 3 秒热更健康看门狗（超时自动拉黑坏包并瞬切内置包）。
final class LocalPackURLSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "askbible-pack"
    static let baseOrigin = "askbible-pack://app"

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        let rawPath = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard !rawPath.isEmpty, !rawPath.contains(".."), !rawPath.contains("\\") else {
            urlSchemeTask.didFailWithError(URLError(.noPermissionsToReadFile))
            return
        }

        // 优先从 PackStore 内存胶囊 0ms 零拷贝直出（index.html / app.css / app.js）
        if let snapshot = PackStore.loadWebPackFiles(),
           let data = snapshot.files[rawPath] {
            let ext = (rawPath as NSString).pathExtension
            respondOK(urlSchemeTask: urlSchemeTask, url: url, data: data, ext: ext)
            return
        }

        let resolved: URL? = resolveLocalAsset(relativePath: rawPath)
        guard let fileURL = resolved, let data = try? Data(contentsOf: fileURL) else {
            let resp = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: [
                "Content-Type": "text/plain; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
            ])!
            urlSchemeTask.didReceive(resp)
            urlSchemeTask.didReceive(Data("Not Found".utf8))
            urlSchemeTask.didFinish()
            return
        }

        respondOK(urlSchemeTask: urlSchemeTask, url: url, data: data, ext: fileURL.pathExtension)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

    private func respondOK(urlSchemeTask: WKURLSchemeTask, url: URL, data: Data, ext: String) {
        let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
            "Content-Type": Self.mimeType(for: ext),
            "Content-Length": "\(data.count)",
            "Cache-Control": "no-cache",
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

    private static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "sqlite": return "application/vnd.sqlite3"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "mp3": return "audio/mpeg"
        case "m4a": return "audio/mp4"
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
    static let watchdogTimeoutSec: TimeInterval = 3.0

    weak var chapterAudio: ChapterAudioPlayer?
    weak var musicPlayer: MusicPlayer?
    weak var homeController: HomeVerseController?
    weak var ambientPlayer: AmbientPlayer?
    var onSetSleepTimer: ((Int) -> Void)?
    var onOpenChapter: ((String, Int) -> Void)?
    var onResumeReading: (() -> Void)?
    var onBootHealthy: (() -> Void)?

    private weak var observedWebView: WKWebView?
    private var watchdogURL: URL?
    private var watchdogWorkItem: DispatchWorkItem?
    private var bootHealthyReceived = false

    /// 构造锁定橡皮筋露白、禁用系统默认长按菜单并注入 `window.askbibleNative` 的 WKWebViewConfiguration
    func makeWebViewConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalPackURLSchemeHandler(), forURLScheme: LocalPackURLSchemeHandler.scheme)
        let ucc = WKUserContentController()
        ucc.add(WeakScriptMessageProxy(self), name: Self.handlerName)
        let bootstrapJS = """
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
        })();
        """
        ucc.addUserScript(WKUserScript(source: bootstrapJS, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        config.userContentController = ucc
        return config
    }

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

    /// 加载本地胶囊并启动 3 秒防变砖健康看门狗（仅当加载热更胶囊时启用）
    func loadLocalPack(in webView: WKWebView, url: URL) {
        observedWebView = webView
        watchdogURL = url
        beginWatchdogIfHotPack()
        webView.load(URLRequest(url: url))
    }

    private func beginWatchdogIfHotPack() {
        cancelWatchdog()
        bootHealthyReceived = false
        guard PackStore.loadWebPackFiles()?.isHotPack == true else { return }

        let item = DispatchWorkItem { [weak self] in
            guard let self, !self.bootHealthyReceived else { return }
            PackStore.rollbackHotWebPack()
            if let wv = self.observedWebView, let url = self.watchdogURL {
                wv.load(URLRequest(url: url))
            }
        }
        watchdogWorkItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.watchdogTimeoutSec, execute: item)
    }

    func cancelWatchdog() {
        watchdogWorkItem?.cancel()
        watchdogWorkItem = nil
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
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
