import Combine
import Foundation
import UIKit
import WebKit
import WidgetKit

/// D-47 `window.AskBibleBridge` 5 组最小双向协议分发器。
///
/// 覆盖协议：
/// - audio：`audio.intent`, `audio.state`（实现位于 `AskBibleBridgeAudio.swift`）
/// - shell：`shell.setTab`, `shell.setTheme`, `shell.haptic`, `shell.tabSelected`, `shell.backPressed`
/// - pack：`pack.status`, `pack.checkNow`, `pack.downloadTranslation`, `pack.readyToSwap`, `pack.commitSwap`
/// - sys：`auth.signIn`, `auth.getSession`, `auth.signOut`, `sys.setReminder`, `sys.syncWidget`, `sys.shareImage`
@MainActor
final class AskBibleBridgeDispatcher {
    weak var webView: WKWebView?
    weak var chapterAudio: ChapterAudioPlayer?
    weak var musicPlayer: MusicPlayer?
    weak var homeController: HomeVerseController?
    weak var ambientPlayer: AmbientPlayer?
    weak var authStore: MemberAuthStore?
    weak var scriptureStore: ScriptureStore?

    var onSetTab: ((String) -> Void)?
    var onSetTheme: ((String) -> Void)?
    var onBack: (() -> Void)?
    var onOpenChapter: ((String, Int) -> Void)?
    var onLoadChapterAudio: ((String, Int, Bool) -> Void)?
    var onSetSleepTimer: ((Int) -> Void)?
    var onOpenAuth: (() -> Void)?
    var onSignOut: (() async -> Void)?

    var cancellables: Set<AnyCancellable> = []
    var audioEmitScheduled = false
    private var appPackObserverToken: NSObjectProtocol?

    func attach(to webView: WKWebView) {
        self.webView = webView
        observeAudioStreams()
        registerAppPackObserver()
    }

    func detach() {
        cancellables.removeAll()
        if let token = appPackObserverToken {
            NotificationCenter.default.removeObserver(token)
            appPackObserverToken = nil
        }
        webView = nil
    }

    // MARK: - 原生主动推送（__askbibleEmit）

    func emit(event: String, payload: [String: Any]) {
        guard let webView,
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        let safeEvent = event.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
        let js = "window.__askbibleEmit && window.__askbibleEmit('\(safeEvent)', \(json));"
        webView.evaluateJavaScript(js)
    }

    func emitTabSelected(tab: String) {
        emit(event: "shell.tabSelected", payload: ["tab": tab])
    }

    func emitBackPressed() {
        emit(event: "shell.backPressed", payload: [:])
    }

    func emitKeyboardHeight(_ height: CGFloat) {
        let px = max(0, Int(height.rounded()))
        emit(event: "shell.keyboardHeight", payload: ["height": px])
        webView?.evaluateJavaScript("document.documentElement.style.setProperty('--askbible-keyboard-height', '\(px)px');")
    }

    func emitAudioState() {
        emit(event: "audio.state", payload: currentAudioSnapshot())
    }

    // MARK: - RPC 分发（window.AskBibleBridge.call）

    func handleBridgeMessage(_ body: [String: Any]) {
        guard let id = body["id"] as? String,
              let method = body["method"] as? String else { return }
        let params = (body["params"] as? [String: Any]) ?? [:]

        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                let result = try await self.dispatch(method: method, params: params)
                self.resolve(id: id, ok: true, payload: result)
            } catch {
                self.resolve(id: id, ok: false, payload: ["message": error.localizedDescription])
            }
        }
    }

    private func resolve(id: String, ok: Bool, payload: [String: Any]) {
        guard let webView,
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        let safeId = id.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
        let js = "window.__askbibleResolve && window.__askbibleResolve('\(safeId)', \(ok ? "true" : "false"), \(json));"
        webView.evaluateJavaScript(js)
    }

    private func dispatch(method: String, params: [String: Any]) async throws -> [String: Any] {
        switch method {
        case "audio.intent":
            return handleAudioIntent(params)
        case "audio.state":
            return currentAudioSnapshot()

        case "shell.setTab":
            let tab = (params["tab"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !tab.isEmpty { onSetTab?(tab) }
            return ["ok": true, "tab": tab]

        case "shell.setTheme":
            let mode = (params["mode"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? "system"
            let normalized = (mode == "light" || mode == "dark") ? mode : "system"
            UserDefaults.standard.set(normalized, forKey: "askbible.appearance")
            onSetTheme?(normalized)
            return ["ok": true, "mode": normalized]

        case "shell.haptic":
            let style = (params["style"] as? String)?.lowercased() ?? "light"
            triggerHaptic(style: style)
            return ["ok": true, "style": style]

        case "shell.back", "shell.goBack":
            onBack?()
            return ["ok": true]

        case "bible.openChapter", "shell.openChapter", "reader.openChapter":
            let bookId = (params["bookId"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let chapter = max(1, (params["chapter"] as? NSNumber)?.intValue ?? 1)
            guard !bookId.isEmpty else {
                return ["ok": false, "error": "missing_book_id"]
            }
            onOpenChapter?(bookId, chapter)
            return ["ok": true, "bookId": bookId, "chapter": chapter]

        case "pack.status":
            var dict = AppPackStore.shared.statusDictionary()
            dict["ok"] = true
            return dict

        case "pack.checkNow":
            let outcome = await AppPackStore.shared.refreshIfNeeded(force: true)
            _ = await PackStore.refreshInstalledPacksIfNeeded(force: true)
            var dict = AppPackStore.shared.statusDictionary()
            dict["ok"] = true
            switch outcome {
            case .readyToSwap(let bundleId): dict["outcome"] = "readyToSwap"; dict["readyBundleId"] = bundleId
            case .upToDate: dict["outcome"] = "upToDate"
            case .throttled: dict["outcome"] = "throttled"
            case .unreachable: dict["outcome"] = "unreachable"
            case .failed(let msg): dict["outcome"] = "failed"; dict["error"] = msg
            }
            return dict

        case "pack.downloadTranslation":
            return await handleDownloadTranslation(params)

        case "pack.commitSwap":
            let res = AppPackStore.shared.commitPendingSwap()
            var dict: [String: Any] = ["ok": res.swapped]
            if let bundleId = res.bundleId { dict["bundleId"] = bundleId }
            if let activatedAt = res.activatedAt { dict["activatedAt"] = activatedAt }
            if let reason = res.reason { dict["reason"] = reason }
            return dict

        case "auth.signIn":
            return await handleAuthSignIn(params)

        case "auth.getSession":
            return currentSessionDictionary()

        case "auth.signOut":
            if let onSignOut { await onSignOut() } else { authStore?.signOut() }
            return ["ok": true]

        case "sys.setReminder":
            let enabled = (params["enabled"] as? Bool) ?? false
            let hour = (params["hour"] as? NSNumber)?.intValue ?? ReadingReminder.shared.hour
            let minute = (params["minute"] as? NSNumber)?.intValue ?? ReadingReminder.shared.minute
            await ReadingReminder.shared.apply(enabled: enabled, hour: hour, minute: minute, locale: AppLocale.current)
            return [
                "ok": !ReadingReminder.shared.denied,
                "enabled": ReadingReminder.shared.enabled,
                "hour": ReadingReminder.shared.hour,
                "minute": ReadingReminder.shared.minute,
                "denied": ReadingReminder.shared.denied,
            ]

        case "sys.syncWidget":
            return handleSyncWidget(params)

        case "sys.shareImage":
            return handleShareImage(params)

        default:
            throw NSError(domain: "AskBibleBridge", code: 404, userInfo: [
                NSLocalizedDescriptionKey: "unsupported_method:\(method)",
            ])
        }
    }

    private func registerAppPackObserver() {
        guard appPackObserverToken == nil else { return }
        appPackObserverToken = NotificationCenter.default.addObserver(
            forName: AppPackStore.readyToSwapNotification,
            object: AppPackStore.shared,
            queue: .main
        ) { [weak self] note in
            guard let bundleId = note.userInfo?["bundleId"] as? String else { return }
            Task { @MainActor [weak self] in
                self?.emit(event: "pack.readyToSwap", payload: ["bundleId": bundleId])
            }
        }
    }

    // MARK: - 系统与账号处理器

    private func triggerHaptic(style: String) {
        switch style {
        case "success":
            let gen = UINotificationFeedbackGenerator(); gen.prepare(); gen.notificationOccurred(.success)
        case "warning":
            let gen = UINotificationFeedbackGenerator(); gen.prepare(); gen.notificationOccurred(.warning)
        case "error":
            let gen = UINotificationFeedbackGenerator(); gen.prepare(); gen.notificationOccurred(.error)
        case "medium":
            let gen = UIImpactFeedbackGenerator(style: .medium); gen.prepare(); gen.impactOccurred()
        case "heavy":
            let gen = UIImpactFeedbackGenerator(style: .heavy); gen.prepare(); gen.impactOccurred()
        case "selection":
            let gen = UISelectionFeedbackGenerator(); gen.prepare(); gen.selectionChanged()
        default:
            let gen = UIImpactFeedbackGenerator(style: .light); gen.prepare(); gen.impactOccurred()
        }
    }

    private func handleDownloadTranslation(_ params: [String: Any]) async -> [String: Any] {
        let id = (params["id"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !id.isEmpty, let t = ScriptureTranslation.find(id) else {
            return ["ok": false, "error": "translation_not_found", "id": id]
        }
        if t.delivery == .bundled || ScriptureDatabase.isInstalled(id) {
            return ["ok": true, "id": id, "installed": true]
        }
        guard t.delivery == .download else {
            return ["ok": false, "error": "translation_not_downloadable", "id": id]
        }
        let downloader = scriptureStore?.downloader ?? TranslationDownloader()
        let ok = await downloader.ensure(t)
        if ok { LocalDBRouter.shared.invalidate(translationId: id) }
        return ["ok": ok, "id": id, "installed": ok]
    }

    private func handleAuthSignIn(_ params: [String: Any]) async -> [String: Any] {
        let provider = (params["provider"] as? String)?.lowercased() ?? "apple"
        let locale = (params["locale"] as? String) ?? AppLocale.current.rawValue
        guard let authStore else {
            onOpenAuth?()
            return ["ok": false, "error": "auth_store_unavailable"]
        }
        switch provider {
        case "apple":
            switch await authStore.signInWithApple(locale: locale) {
            case .done: return currentSessionDictionary(ok: true)
            case .cancelled: return ["ok": false, "cancelled": true]
            case .failed(let message): return ["ok": false, "error": message]
            }
        case "email":
            let email = (params["email"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let code = (params["code"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if email.isEmpty {
                onOpenAuth?()
                return ["ok": true, "openedNativeAuth": true]
            }
            if code.isEmpty {
                let err = await authStore.sendOtp(email: email, locale: locale)
                return ["ok": err == nil, "step": "otp_sent", "error": err ?? NSNull()]
            }
            let err = await authStore.verifyOtp(email: email, code: code, name: params["name"] as? String, locale: locale)
            return err == nil ? currentSessionDictionary(ok: true) : ["ok": false, "error": err ?? "auth_failed"]
        default:
            onOpenAuth?()
            return ["ok": false, "openedNativeAuth": true, "error": "provider_uses_native_sheet"]
        }
    }

    private func currentSessionDictionary(ok: Bool = true) -> [String: Any] {
        guard let authStore, let user = authStore.user else {
            return ["ok": ok, "signedIn": false, "user": NSNull()]
        }
        var userDict: [String: Any] = [
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "isAdmin": authStore.isAdmin,
        ]
        if let locale = user.locale { userDict["locale"] = locale }
        if let createdAt = user.createdAt { userDict["createdAt"] = createdAt }
        var out: [String: Any] = ["ok": ok, "signedIn": true, "user": userDict]
        if let token = authStore.sessionToken { out["sessionToken"] = token }
        return out
    }

    private func handleSyncWidget(_ params: [String: Any]) -> [String: Any] {
        let verseObj = (params["verse"] as? [String: Any]) ?? params
        let text = (verseObj["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let reference = (verseObj["reference"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? (verseObj["ref"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let key = (verseObj["key"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? (verseObj["verseKey"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if !text.isEmpty || !reference.isEmpty || !key.isEmpty {
            let ud = UserDefaults(suiteName: "group.me.askbible.native")
            if !text.isEmpty { ud?.set(text, forKey: "widget-verse-v1-text") }
            if !reference.isEmpty { ud?.set(reference, forKey: "widget-verse-v1-ref") }
            if !key.isEmpty { ud?.set(key, forKey: "widget-verse-v1-key") }
        }
        WidgetCenter.shared.reloadAllTimelines()
        return ["ok": true]
    }

    private func handleShareImage(_ params: [String: Any]) -> [String: Any] {
        let rawDataUrl = (params["dataUrl"] as? String) ?? ""
        let text = (params["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        var items: [Any] = []
        if !rawDataUrl.isEmpty, let image = Self.decodeDataUrlImage(rawDataUrl) { items.append(image) }
        if !text.isEmpty { items.append(text) }
        guard !items.isEmpty else { return ["ok": false, "error": "empty_share_payload"] }
        guard let presenter = Self.topViewController() else { return ["ok": false, "error": "no_presenter"] }

        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let pop = sheet.popoverPresentationController {
            pop.sourceView = presenter.view
            pop.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
        }
        presenter.present(sheet, animated: true)
        return ["ok": true]
    }

    private static func decodeDataUrlImage(_ dataUrl: String) -> UIImage? {
        let base64Part = dataUrl.firstIndex(of: ",").map { String(dataUrl[dataUrl.index(after: $0)...]) } ?? dataUrl
        guard let data = Data(base64Encoded: base64Part, options: .ignoreUnknownCharacters) else { return nil }
        return UIImage(data: data)
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let root = scenes.flatMap(\.windows).first(where: \.isKeyWindow)?.rootViewController
            ?? scenes.first?.windows.first?.rootViewController
        var current = root
        while let presented = current?.presentedViewController { current = presented }
        return current
    }
}
