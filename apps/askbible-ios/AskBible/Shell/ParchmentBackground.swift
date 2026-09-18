import SwiftUI

/// 羊皮卷底。对应 RN 版 `ReadParchmentFillLayer`：canvas 实色打底，羊皮 JPG **整张实图**按屏幕尺寸
/// `resizeMode="stretch"` 铺满（不是半透明叠纹）。之前这里用 multiply 叠 42%，纹理被压得太淡，
/// Josh 特别指出羊皮卷是重要的底纹 —— 改回与 RN 一样的实图铺法。
///
/// 不自带 ignoresSafeArea：作为整屏底时由调用方加，作为底栏 background 时必须不加 ——
/// 否则它会向上铺满整个屏幕，把滚动内容盖掉。
struct ParchmentBackground: View {
    var theme: Parchment = .light
    /// 纸张材质层（边缘晕暗 + 暖调不均）。DECISIONS 2026-09-15「羊皮从 UI 皮肤升级成真 substrate」。
    /// 极小的贴片（芯片、徽标）关掉它 —— 在几十点宽的容器里晕暗会变成一圈脏边。
    var substrate: Bool = true

    var body: some View {
        ZStack {
            theme.canvas
            if let image = BundleImage.load("parchment", ext: "jpg") {
                // 只 resizable、不 scaledToFill：保持宽高比会撑大容器，
                // 这个组件常被用作 background，撑大就会盖住整屏内容。纸纹拉伸无所谓（RN 也是 stretch）。
                if theme.isDark {
                    // 深色：羊皮图是一整张不透明的浅色纸，直接铺就把深色底整片盖回亮的。
                    // 改成柔光叠在深底上 —— 只取纸的纹理明暗，不取它的亮度。底纹保留（Josh 要求羊皮底纹一直在）。
                    Image(uiImage: image)
                        .resizable()
                        .blendMode(.softLight)
                        .opacity(0.55)
                } else {
                    Image(uiImage: image)
                        .resizable()
                }
            }
            if substrate { ParchmentSubstrate(theme: theme) }
        }
        .clipped()
    }
}

/// 纸张材质：一层极轻的边缘晕暗（纸被翻久了边上先旧）+ 一道斜向暖光（纸面色温不均）。
/// 两层都很淡 —— 目的是让纸看着有厚度，不是做旧特效。数值再往上加就会变成「Bible-themed skin」。
private struct ParchmentSubstrate: View {
    let theme: Parchment

    /// 深色模式下纸本身已经很暗，晕暗要更克制，否则四角发死
    private var vignetteOpacity: Double { theme.isDark ? 0.16 : 0.13 }

    var body: some View {
        GeometryReader { geo in
            let maxSide = max(geo.size.width, geo.size.height)
            ZStack {
                // 边缘晕暗：中间 55% 完全干净，只在最外圈压暖棕
                RadialGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .clear, location: 0.55),
                        .init(color: Color(rgb: 0x3a2412, opacity: vignetteOpacity), location: 1),
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: maxSide * 0.78
                )
                // 暖调不均：左上偏暖、右下偏冷，幅度只有 5%
                LinearGradient(
                    colors: [
                        Color(parchment: 0xfff3d8, opacity: 0.05),
                        .clear,
                        Color(parchment: 0x6b4a2a, opacity: 0.05),
                    ],
                    startPoint: .topLeading, endPoint: .bottomTrailing
                )
            }
            .allowsHitTesting(false)
        }
    }
}

/// 弹层 / 卡片羊皮底。对应 RN `ParchmentModalCard` / `ReadParchmentBackgroundImage`：
/// 羊皮 JPG 按**整屏尺寸**铺、由圆角卡片裁切（卡片露出的是整图左上角那一块，纹理与页面连续），
/// 外加 hairline 的 border 描边。设置面板 / 章节选择 / 串珠 / 环境音 / 定时器等弹层都用它，不要再写纯色底。
struct ParchmentCardModifier: ViewModifier {
    /// nil = 跟随环境（深浅色）。原来默认 .light，调用点都没传，深色模式下弹层会是一块亮纸
    var theme: Parchment? = nil
    @Environment(\.parchment) private var envTheme
    var cornerRadius: CGFloat = 16
    /// 背景是否允许接收触点。划重点模式下 HighlightBar 设为 false，
    /// 背景纹理穿透给下层 FlowTextView，按钮本身仍可响应点击。
    var backgroundHitTesting: Bool = true

    func body(content: Content) -> some View {
        let theme = self.theme ?? envTheme
        let shape = RoundedRectangle(cornerRadius: cornerRadius)
        content
            .background {
                ZStack(alignment: .topLeading) {
                    theme.canvas
                    if let image = BundleImage.load("parchment", ext: "jpg") {
                        Image(uiImage: image)
                            .resizable()
                            .frame(width: UIScreen.main.bounds.width, height: UIScreen.main.bounds.height)
                            // 深色同 ParchmentBackground：只取纹理不取亮度
                            .blendMode(theme.isDark ? .softLight : .normal)
                            .opacity(theme.isDark ? 0.55 : 1)
                    }
                }
                .clipShape(shape)
                .allowsHitTesting(backgroundHitTesting)
            }
            .overlay(shape.strokeBorder(theme.border, lineWidth: 1 / UIScreen.main.scale))
            .clipShape(shape)
    }
}

extension View {
    func parchmentCard(cornerRadius: CGFloat = AskCorner.card, theme: Parchment? = nil,
                       backgroundHitTesting: Bool = true) -> some View {
        modifier(ParchmentCardModifier(theme: theme, cornerRadius: cornerRadius,
                                       backgroundHitTesting: backgroundHitTesting))
    }
}

/// 直接从 bundle 读图 —— 工程用文件系统同步组，图片以普通资源进包，
/// 不走 asset catalog，所以按文件名取。
enum BundleImage {
    private static var cache: [String: UIImage] = [:]

    static func load(_ name: String, ext: String) -> UIImage? {
        let key = "\(name).\(ext)"
        if let hit = cache[key] { return hit }
        guard let url = Bundle.main.url(forResource: name, withExtension: ext),
              let image = UIImage(contentsOfFile: url.path) else { return nil }
        cache[key] = image
        return image
    }
}
