import SwiftUI

/// 羊皮卷底。对应 RN 版 `ReadParchmentFillLayer`：canvas 实色打底，羊皮 JPG **整张实图**按屏幕尺寸
/// `resizeMode="stretch"` 铺满（不是半透明叠纹）。之前这里用 multiply 叠 42%，纹理被压得太淡，
/// Josh 特别指出羊皮卷是重要的底纹 —— 改回与 RN 一样的实图铺法。
///
/// 不自带 ignoresSafeArea：作为整屏底时由调用方加，作为底栏 background 时必须不加 ——
/// 否则它会向上铺满整个屏幕，把滚动内容盖掉。
struct ParchmentBackground: View {
    var theme: Parchment = .light

    var body: some View {
        ZStack {
            theme.canvas
            if let image = BundleImage.load("parchment", ext: "jpg") {
                // 只 resizable、不 scaledToFill：保持宽高比会撑大容器，
                // 这个组件常被用作 background，撑大就会盖住整屏内容。纸纹拉伸无所谓（RN 也是 stretch）。
                Image(uiImage: image)
                    .resizable()
            }
        }
        .clipped()
    }
}

/// 弹层 / 卡片羊皮底。对应 RN `ParchmentModalCard` / `ReadParchmentBackgroundImage`：
/// 羊皮 JPG 按**整屏尺寸**铺、由圆角卡片裁切（卡片露出的是整图左上角那一块，纹理与页面连续），
/// 外加 hairline 的 border 描边。设置面板 / 章节选择 / 串珠 / 环境音 / 定时器等弹层都用它，不要再写纯色底。
struct ParchmentCardModifier: ViewModifier {
    var theme: Parchment = .light
    var cornerRadius: CGFloat = 16

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: cornerRadius)
        content
            .background {
                ZStack(alignment: .topLeading) {
                    theme.canvas
                    if let image = BundleImage.load("parchment", ext: "jpg") {
                        Image(uiImage: image)
                            .resizable()
                            .frame(width: UIScreen.main.bounds.width, height: UIScreen.main.bounds.height)
                    }
                }
                .clipShape(shape)
            }
            .overlay(shape.strokeBorder(theme.border, lineWidth: 1 / UIScreen.main.scale))
            .clipShape(shape)
    }
}

extension View {
    func parchmentCard(cornerRadius: CGFloat = 16, theme: Parchment = .light) -> some View {
        modifier(ParchmentCardModifier(theme: theme, cornerRadius: cornerRadius))
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
