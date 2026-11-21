import AuthenticationServices
import SwiftUI
import UIKit

/// 系统原生 Apple 登录入口（DECISIONS D-44：去除浏览器 OAuth 跳转会话，只保留原生 ASAuthorizationController）。
private func keyWindowAnchor() -> ASPresentationAnchor {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? scenes.first?.windows.first ?? ASPresentationAnchor()
}

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

struct AppleBrandMark: View {
    var color: Color
    var body: some View {
        Image(systemName: "apple.logo").resizable().scaledToFit().foregroundStyle(color).frame(width: 18, height: 22)
    }
}
