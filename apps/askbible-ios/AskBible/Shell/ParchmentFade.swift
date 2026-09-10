import SwiftUI

/// 羊皮卷滚动页的顶 / 底渐隐。逐值搬自 RN `readParchmentScrollMask.tsx`：
/// - tabbar（目录 / 探索等主 Tab 页）：顶 70、底 120，贴近底栏 80 处只剩 3% —— 正文从透明的底栏下面滑过去，看不到硬边；
/// - chapter（章页正文）：只保留顶部 70 的渐隐，底部由播放坞遮挡（坞后面铺的是与页面同一张、钉在屏幕底的羊皮图）。
/// 内容要按 RN `readParchmentFadeSafePadding` 多留顶 70 / 底 120 的边，免得头尾被淡掉。
enum ParchmentFadePreset {
    case tabbar, chapter

    var edgeFadeTop: CGFloat { 70 }
    var edgeFadeBottom: CGFloat { self == .tabbar ? 120 : 0 }
    var tabNear: CGFloat { self == .tabbar ? 80 : 0 }
    var topTabNear: CGFloat { 30 }
    var tabMaskOpacity: Double { 0.03 }

    /// RN maskStops：按视口高度算出的渐变停靠点（0 = 顶）
    func stops(viewportHeight h0: CGFloat) -> [Gradient.Stop] {
        let h = max(h0, 1)
        let topTab = min(0.4, topTabNear / h)
        let topEnd = min(0.48, max(topTab + 0.02, edgeFadeTop / h))
        let topBlend = topTab + (topEnd - topTab) * 0.45
        let top: [Gradient.Stop] = [
            .init(color: .black.opacity(0), location: 0),
            .init(color: .black.opacity(tabMaskOpacity), location: topTab),
            .init(color: .black.opacity(0.42), location: topBlend),
            .init(color: .black, location: topEnd),
        ]
        if edgeFadeBottom <= 0 { return top + [.init(color: .black, location: 1)] }
        let fadeStart = max(topEnd + 0.02, 1 - edgeFadeBottom / h)
        let tabNearLoc = min(0.999, max(fadeStart + 0.02, 1 - tabNear / h))
        let bottomBlend = fadeStart + (tabNearLoc - fadeStart) * 0.45
        return top + [
            .init(color: .black, location: fadeStart),
            .init(color: .black.opacity(0.42), location: bottomBlend),
            .init(color: .black.opacity(tabMaskOpacity), location: tabNearLoc),
            .init(color: .black.opacity(0), location: 1),
        ]
    }
}

struct ParchmentFadeModifier: ViewModifier {
    let preset: ParchmentFadePreset

    func body(content: Content) -> some View {
        content.mask {
            GeometryReader { geo in
                LinearGradient(stops: preset.stops(viewportHeight: geo.size.height), startPoint: .top, endPoint: .bottom)
            }
        }
    }
}

extension View {
    func parchmentFade(_ preset: ParchmentFadePreset) -> some View { modifier(ParchmentFadeModifier(preset: preset)) }
}

extension ShellMetrics {
    /// RN SHELL_TAB_BAR_CLEARANCE：主 Tab 滚动页内容底部至少留这么多给底栏（再加安全区与渐隐区）
    static let tabBarClearance: CGFloat = 72
}

/// 坞 + 底栏后面的羊皮底：与页面同一张羊皮图、按整屏尺寸钉在屏幕底再裁到宿主高度，
/// 像素与页面底图完全重合，所以看不出接缝（RN `scriptureDockParchmentHost` + `ReadParchmentFillLayer pinBottom`）。
struct ParchmentPinnedBottom: View {
    var theme: Parchment = .light

    var body: some View {
        Color.clear
            .overlay(alignment: .bottom) {
                ParchmentBackground(theme: theme)
                    .frame(width: UIScreen.main.bounds.width, height: UIScreen.main.bounds.height)
            }
            .clipped()
            // clipped 只裁画面不裁点击：整屏大的 overlay 会把上面所有页面的触摸吃掉（实测目录页点不动），纯装饰层不参与命中
            .allowsHitTesting(false)
    }
}
