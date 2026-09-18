import SwiftUI

/// 语义材质层。DECISIONS「Paper = Scripture，Glass = Interface」（2026-09-15）：
/// **玻璃只属于操作，不属于内容** —— 羊皮纸页面本身永远不玻璃化，只有浮在内容之上的控件用玻璃。
///
/// 页面里不要直接写 `.glassEffect(...)`：一套设计、两套 renderer，版本分叉只允许出现在这个文件里。
/// iOS 26+ 走真 Liquid Glass（折射 / 边缘高光 / 形变），iOS 17–25 退化成 `.ultraThinMaterial` + hairline 描边，
/// 尺寸、圆角、padding、层级、交互路径完全一致，差别只有材质本身。
enum AskGlassTone {
    /// 浮在照片 / 视频上的控件（首页齿轮、底栏胶囊）—— 暗色调玻璃，图标用白
    case dark
    /// 浮在羊皮纸上的控件（读经坞）—— 中性玻璃，图标用墨色
    case light
}

/// 圆角 token。以后调圆角改这里，不要在页面里散写数字（DECISIONS 2026-09-15 的 Corner token）。
enum AskCorner {
    /// 控件：玻璃胶囊 / 工具簇
    static let control: CGFloat = 26
    /// 卡片：弹层、列表卡（= 原来 parchmentCard 的默认值）
    static let card: CGFloat = 16
    /// 大面板：抽屉、sheet
    static let sheet: CGFloat = 34
}

/// 层级 token。DECISIONS 2026-09-15：层次由材质承担，影子只用来把浮起控件与内容拉开一个深度，
/// 不再拿一堆 shadow 去硬造前后关系（旧的 `shellIconShadow()` 两层黑影就是那个做法）。
enum AskElevation {
    /// 贴在内容平面上：不投影
    case content
    /// 浮在内容之上的控件（玻璃胶囊、玻璃圆钮）
    case floating
    /// 盖住内容的浮层（抽屉、弹层）
    case overlay

    var radius: CGFloat {
        switch self {
        case .content: return 0
        case .floating: return 18
        case .overlay: return 28
        }
    }

    var opacity: Double {
        switch self {
        case .content: return 0
        case .floating: return 0.22
        case .overlay: return 0.30
        }
    }

    var yOffset: CGFloat {
        switch self {
        case .content: return 0
        case .floating: return 6
        case .overlay: return 10
        }
    }
}

enum AskGlassMetrics {
    /// 控件胶囊圆角。保留这个名字是为了不动已有调用点，值来自 `AskCorner.control`
    static let controlRadius: CGFloat = AskCorner.control
    static let floatingShadowRadius: CGFloat = AskElevation.floating.radius
    /// 玻璃胶囊与屏幕左右边的距离
    static let capsuleInset: CGFloat = 10
}

/// 玻璃表面。`shape` 给具体形状，`tone` 决定退化路径下的底色偏向。
private struct AskGlassSurface<S: InsettableShape>: ViewModifier {
    let shape: S
    let tone: AskGlassTone
    /// 交互式玻璃（按下有形变高光）。只给真正可点的整块控件用，容器不要开。
    let interactive: Bool

    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            // **不加 tint**。Josh 2026-09-16：「这些不是我们效果图里的玻璃的样子，我还是要原生的」——
            // 之前为了压住白图标给玻璃着了一层色（暗 0.18 / 浅 0.12），那层正是让它看着像灰塑料板的原因：
            // 着了色就挡住了 Liquid Glass 自己的折射与边缘高光。现在交给系统原样渲染，
            // 图标的可读性改由图标自己那层极轻的阴影（askGlassIconShadow）负责。
            //
            // 照片 / 视频上用 `.clear`：更透，能看见背景在玻璃里折射（效果图里就是这个质感）；
            // 羊皮纸上用 `.regular`：纸本身对比低，需要系统那层自适应的提亮把控件托起来。
            // 一律 `.clear`：`.regular` 那档磨砂把背后压得太狠，在羊皮这种低对比底上
            // 看起来和一块底色没差别（Josh 2026-09-16 真机连看两轮都说「还是平的」）。
            // `.clear` 更透、折射更明显，代价是前景要自己补对比 —— 坞与工具簇的图标字重已相应加粗。
            let base: Glass = .clear
            content.glassEffect(interactive ? base.interactive() : base, in: shape)
        } else {
            // 退化：ultraThinMaterial 给模糊，底色补 tone 的偏向（26 的玻璃自带这层），
            // hairline 描边替代 Liquid Glass 的边缘高光。
            content
                .background(legacyTint, in: shape)
                .background(.ultraThinMaterial, in: shape)
                .overlay(shape.strokeBorder(legacyEdge, lineWidth: 0.5))
        }
    }

    private var legacyTint: Color {
        switch tone {
        case .dark: return Color(rgb: 0x1c1410, opacity: 0.28)
        case .light: return Color(rgb: 0xfffcf5, opacity: 0.22)
        }
    }

    private var legacyEdge: Color {
        switch tone {
        case .dark: return Color.white.opacity(0.22)
        case .light: return Color(rgb: 0x78350f, opacity: 0.20)
        }
    }
}

extension View {
    /// 玻璃胶囊（底栏、读经坞、工具簇）
    func askGlassCapsule(tone: AskGlassTone, interactive: Bool = false) -> some View {
        modifier(AskGlassSurface(shape: Capsule(), tone: tone, interactive: interactive))
    }

    /// 玻璃圆角矩形（弹层上的控制簇）
    func askGlassRect(tone: AskGlassTone,
                      radius: CGFloat = AskGlassMetrics.controlRadius,
                      interactive: Bool = false) -> some View {
        modifier(AskGlassSurface(shape: RoundedRectangle(cornerRadius: radius, style: .continuous),
                                 tone: tone, interactive: interactive))
    }

    /// 浮起控件的落影。玻璃自己不投影，靠这层把它与内容拉开一个深度。
    /// 比旧的 `shellIconShadow()` 轻得多 —— 层次由材质承担，不再靠影子硬造。
    func askFloatingShadow(_ level: AskElevation = .floating) -> some View {
        shadow(color: .black.opacity(level.opacity), radius: level.radius, x: 0, y: level.yOffset)
    }

    /// 玻璃上的图标不再需要双层黑影（材质已经提供对比），只留极轻一层压住高光处
    func askGlassIconShadow() -> some View {
        shadow(color: .black.opacity(0.28), radius: 3, x: 0, y: 1)
    }
}

extension View {
    /// 玻璃形变身份。iOS 26 下同一 `AskGlassGroup` 内带 ID 的玻璃在出现 / 消失时会互相融合与形变
    /// （展开工具簇时那种「从一颗钮长出来」的效果）；低版本下什么都不做。
    @ViewBuilder
    func askGlassID(_ id: String, in namespace: Namespace.ID) -> some View {
        if #available(iOS 26, *) {
            self.glassEffectID(id, in: namespace)
        } else {
            self
        }
    }
}

extension View {
    /// 关掉系统在滚动内容底缘自动铺的那层渐进模糊（iOS 26 scroll edge effect）。
    ///
    /// Josh 2026-09-16：「内页是不是因为下面还多了一层底档住文字，所以看不出玻璃效果」——
    /// 正是它。系统默认在内容贴到底栏时糊一层，经文先被系统糊掉，玻璃再去折射一片糊掉的东西，
    /// 结果两层模糊叠在一起，看起来就是一块平底色。关掉它，经文清清楚楚滚到玻璃后面，
    /// 折射才有东西可折。
    @ViewBuilder
    func askNoScrollEdgeBlur(_ edges: Edge.Set = .bottom) -> some View {
        if #available(iOS 26, *) {
            self.scrollEdgeEffectHidden(true, for: edges)
        } else {
            self
        }
    }
}

/// Liquid Glass 是否真的在渲染。辅助功能开了「降低透明度」时，系统会把所有玻璃换成不透明平色，
/// 表现就是「怎么调都是一块底色」—— 排查玻璃观感问题时先看这个，别去调材质参数。
enum AskGlassDiagnostics {
    static var reduceTransparency: Bool { UIAccessibility.isReduceTransparencyEnabled }
    static var reduceMotion: Bool { UIAccessibility.isReduceMotionEnabled }

    /// 给抽屉底部那行版本号后面附的诊断串；一切正常时是空串（不打扰用户）
    static var badge: String {
        var flags: [String] = []
        if reduceTransparency { flags.append("降低透明度 已开 → 玻璃被系统换成平色") }
        if reduceMotion { flags.append("降低动效 已开") }
        return flags.isEmpty ? "" : " · " + flags.joined(separator: " · ")
    }
}

/// 玻璃组容器。iOS 26 下同一容器内的多块玻璃会互相感知（间距足够近时融合、切换时形变过渡）；
/// 低版本下就是个透明壳，不改变布局。
struct AskGlassGroup<Content: View>: View {
    var spacing: CGFloat = 12
    @ViewBuilder var content: () -> Content

    var body: some View {
        if #available(iOS 26, *) {
            GlassEffectContainer(spacing: spacing) { content() }
        } else {
            content()
        }
    }
}
