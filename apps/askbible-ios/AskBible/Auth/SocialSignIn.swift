import AuthenticationServices
import SwiftUI
import UIKit

/// 第三方登录的系统入口（RN expo-web-browser.openAuthSessionAsync / expo-apple-authentication）。
/// 纯规则在 Model/MemberOAuth.swift；这里只负责拉起系统 UI 并把结果交回 MemberAuthStore。

private func keyWindowAnchor() -> ASPresentationAnchor {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? scenes.first?.windows.first ?? ASPresentationAnchor()
}

/// RN openAuthSessionAsync：Safari 登录页 → askbible://auth/callback 回来；关掉即取消（nil）。
/// RN 传 preferEphemeralSession: true（无痕），原生这里**故意不用无痕**：Josh 2026-09-09 真 iPhone 实测，无痕会话不带 Safari 里已登录的
/// Google 帐户，Google 要他重输邮箱密码、还当成新设备走了一遍「恢复帐户」验证；共用 Safari 会话就能直接选帐户（RN iOS 平时走原生 Google SDK，也是共用 Safari 会话）。
final class WebAuthSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    @MainActor
    static func run(url: String, callbackScheme: String) async -> String? {
        guard let u = URL(string: url) else { return nil }
        let holder = WebAuthSession()
        return await withCheckedContinuation { (cont: CheckedContinuation<String?, Never>) in
            var resumed = false
            let s = ASWebAuthenticationSession(url: u, callbackURLScheme: callbackScheme) { callback, _ in
                guard !resumed else { return }
                resumed = true
                holder.session = nil
                cont.resume(returning: callback?.absoluteString)
            }
            s.prefersEphemeralWebBrowserSession = false
            s.presentationContextProvider = holder
            holder.session = s
            if !s.start() {
                resumed = true
                holder.session = nil
                cont.resume(returning: nil)
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { keyWindowAnchor() }
}

/// RN signInWithAppleNative：要 fullName + email，nonce 传 SHA-256；identityToken 交给 Supabase
final class AppleSignInCoordinator: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    enum Outcome {
        case ok(idToken: String, name: String?)
        case cancelled
        case failed(code: String)
    }

    static let shared = AppleSignInCoordinator()
    private var continuation: CheckedContinuation<Outcome, Never>?
    private var controller: ASAuthorizationController?

    @MainActor
    func signIn(hashedNonce: String) async -> Outcome {
        if continuation != nil { return .failed(code: "apple_in_progress") }
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = hashedNonce
        let c = ASAuthorizationController(authorizationRequests: [request])
        c.delegate = self
        c.presentationContextProvider = self
        controller = c
        return await withCheckedContinuation { cont in
            continuation = cont
            c.performRequests()
        }
    }

    private func finish(_ outcome: Outcome) {
        let cont = continuation
        continuation = nil
        controller = nil
        cont?.resume(returning: outcome)
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = cred.identityToken, let token = String(data: data, encoding: .utf8), !token.isEmpty else {
            finish(.failed(code: "apple_no_token")); return
        }
        finish(.ok(idToken: token, name: MemberOAuthRules.appleFullName(given: cred.fullName?.givenName, family: cred.fullName?.familyName)))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let e = error as? ASAuthorizationError, e.code == .canceled { finish(.cancelled) } else { finish(.failed(code: "apple_failed")) }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor { keyWindowAnchor() }
}

// MARK: - 品牌标（RN OAuthBrandIcons：Google 官方四色 G；Apple 用系统 apple.logo）

/// 极简 SVG path 解析（M L H V C S Z 及其小写相对形式），够画 RN oauth-brand-icon-paths 的 G
enum SVGPathParser {
    static func path(_ d: String, viewBox: CGFloat, size: CGFloat) -> Path {
        let k = size / viewBox
        var p = Path()
        var tokens: [String] = []
        var num = ""
        func flushNum() { if !num.isEmpty { tokens.append(num); num = "" } }
        for ch in d {
            if ch.isLetter { flushNum(); tokens.append(String(ch)) }
            else if ch == "," || ch == " " { flushNum() }
            else if ch == "-" { flushNum(); num = "-" }
            else if ch == "." && num.contains(".") { flushNum(); num = "." }
            else { num.append(ch) }
        }
        flushNum()
        var i = 0
        var cmd = "M"
        var cur = CGPoint.zero, start = CGPoint.zero, lastCtrl = CGPoint.zero
        func n() -> CGFloat { defer { i += 1 }; return CGFloat(Double(tokens[i]) ?? 0) * k }
        func pt(_ rel: Bool) -> CGPoint { let x = n(), y = n(); return rel ? CGPoint(x: cur.x + x, y: cur.y + y) : CGPoint(x: x, y: y) }
        while i < tokens.count {
            if let c = tokens[i].first, c.isLetter { cmd = tokens[i]; i += 1 }
            let rel = cmd == cmd.lowercased()
            switch cmd.uppercased() {
            case "M": cur = pt(rel); start = cur; p.move(to: cur); cmd = rel ? "l" : "L"; lastCtrl = cur
            case "L": cur = pt(rel); p.addLine(to: cur); lastCtrl = cur
            case "H": let x = n(); cur = CGPoint(x: rel ? cur.x + x : x, y: cur.y); p.addLine(to: cur); lastCtrl = cur
            case "V": let y = n(); cur = CGPoint(x: cur.x, y: rel ? cur.y + y : y); p.addLine(to: cur); lastCtrl = cur
            case "C": let c1 = pt(rel), c2 = pt(rel), e = pt(rel); p.addCurve(to: e, control1: c1, control2: c2); lastCtrl = c2; cur = e
            case "S":
                let c1 = CGPoint(x: 2 * cur.x - lastCtrl.x, y: 2 * cur.y - lastCtrl.y)
                let c2 = pt(rel), e = pt(rel); p.addCurve(to: e, control1: c1, control2: c2); lastCtrl = c2; cur = e
            case "Z": p.closeSubpath(); cur = start; lastCtrl = cur
            default: i = tokens.count
            }
        }
        return p
    }
}

/// RN GOOGLE_G_PATHS（viewBox 48，渲染 18）
struct GoogleBrandMark: View {
    var size: CGFloat = 18
    private static let segments: [(fill: Color, d: String)] = [
        (Color(rgb: 0xEA4335), "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"),
        (Color(rgb: 0x4285F4), "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"),
        (Color(rgb: 0xFBBC05), "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"),
        (Color(rgb: 0x34A853), "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"),
    ]
    var body: some View {
        ZStack {
            ForEach(Array(Self.segments.enumerated()), id: \.offset) { _, seg in
                SVGPathParser.path(seg.d, viewBox: 48, size: size).fill(seg.fill)
            }
        }
        .frame(width: size, height: size)
    }
}

/// RN AppleBrandIcon（18×22，ink 色）：系统  符号
struct AppleBrandMark: View {
    var color: Color
    var body: some View {
        Image(systemName: "apple.logo").resizable().scaledToFit().foregroundStyle(color).frame(width: 18, height: 22)
    }
}
