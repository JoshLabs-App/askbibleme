import UIKit

/// 方向闸：整个 App 默认只竖屏；只有 iPhone 首页（风景 + 金句）临时放开横屏观影。
/// Info.plist 声明了横屏（否则系统不让转），真正放不放由这里的 mask 决定。
enum OrientationGate {
    nonisolated(unsafe) private(set) static var mask: UIInterfaceOrientationMask = .portrait

    @MainActor
    static func allowLandscape(_ allow: Bool) {
        let next: UIInterfaceOrientationMask = (allow && UIDevice.current.userInterfaceIdiom == .phone) ? .allButUpsideDown : .portrait
        guard next != mask else { return }
        mask = next
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
            for window in scene.windows { window.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations() }
            // 离开首页时手机还横着：主动转回竖屏，别的页面不做横屏版面
            if next == .portrait, scene.interfaceOrientation.isLandscape {
                scene.requestGeometryUpdate(.iOS(interfaceOrientations: .portrait)) { _ in }
            }
        }
    }
}

final class OrientationAppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        OrientationGate.mask
    }
}
