import Foundation
import WebKit
import WidgetKit

/// 亲儿子极薄原生底座桥（DECISIONS D-44，参考 JoshBox）：
/// 1. `askbible-pack://` 本地离线协议处理器（内置 Bundle + PackStore 热更目录 0ms 秒开，严防路径穿越，断网永不白屏）；
/// 2. `window.askbibleNative` 消息桥：将三路后台音频（读经 / 音乐 / 金句）、睡眠定时、每日读经提醒与桌面小组件能力暴露给本地静态内容层；
/// 3. 锁死橡皮筋露白与系统默认长按菜单，保持纯正羊皮卷原生质感。
final class LocalPackURLSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "askbible-pack"

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

        let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
            "Content-Type": Self.mimeType(for: fileURL.pathExtension),
            "Content-Length": "\(data.count)",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
        ])!
        urlSchemeTask.didReceive(resp)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}

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

@MainActor
final class NativeMediaBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "askbibleNative"

    weak var chapterAudio: ChapterAudioPlayer?
    weak var musicPlayer: MusicPlayer?
    weak var homeController: HomeVerseController?
    weak var ambientPlayer: AmbientPlayer?
    var onSetSleepTimer: ((Int) -> Void)?

    /// 构造锁定橡皮筋露白、禁用系统默认长按菜单并注入 `window.askbibleNative` 的 WKWebViewConfiguration
    func makeWebViewConfiguration() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalPackURLSchemeHandler(), forURLScheme: LocalPackURLSchemeHandler.scheme)
        let ucc = WKUserContentController()
        ucc.add(self, name: Self.handlerName)
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

    /// 配置 WKWebView 滚动与背景：透明羊皮卷底 + 禁止回弹露白
    static func hardenWebView(_ webView: WKWebView) {
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false
        webView.allowsLinkPreview = false
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.handlerName,
              let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }
        let payload = (body["payload"] as? [String: Any]) ?? [:]

        switch action {
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
