import SwiftUI

/// 音乐页专辑舞台（RN MusicHomeBackdrop + MusicHomeUpperDecor）：整屏「渐变 + 光球」底，再叠该专辑自己的动画层：
/// 安静 = 鱼群漩涡 + 呼吸环；下午茶 = 咖啡杯 + 咖啡豆环；睡眠 = 星 + 流星 + 月亮；专注工作 = 行星；钢琴 / 赞美诗 = 只有渐变。
/// `active` = 音乐在播（RN albumDecorMotionActive）；停下时画面定格，不空转。
struct MusicAlbumStage: View {
    let album: String
    let active: Bool
    @State private var start = Date()

    var body: some View {
        GeometryReader { geo in
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !active)) { tl in
                let tMs = tl.date.timeIntervalSince(start) * 1000
                let scene = MusicVisuals.scene(album)
                ZStack {
                    MusicGlowBackdrop(album: album, scene: scene, tMs: tMs, size: geo.size)
                    if scene.fish { FishSwarmLayer(tMs: tMs, size: geo.size) }
                    if scene.breathRing { BreathingRingLayer(tMs: tMs, size: geo.size) }
                    if scene.coffee { CoffeeSceneLayer(tMs: tMs, size: geo.size) }
                    if scene.sleepSky { SleepSkyLayer(tMs: tMs, size: geo.size) }
                    if scene.planets { WorkPlanetsLayer(tMs: tMs, size: geo.size) }
                }
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

private func rgb(_ hex: UInt32, _ opacity: Double = 1) -> Color { Color(rgb: hex, opacity: opacity) }
private func rgba(_ r: Double, _ g: Double, _ b: Double, _ a: Double) -> Color { Color(red: r / 255, green: g / 255, blue: b / 255, opacity: a) }

/// 渐变 + 三个呼吸光球（RN MusicEnergyGlow / MusicEnergyGlowOrbs / useMusicEnergyGlowBreath）
private struct MusicGlowBackdrop: View {
    let album: String
    let scene: MusicVisuals.Scene
    let tMs: Double
    let size: CGSize

    var body: some View {
        let g = MusicVisuals.gradient(album)
        let c0 = rgb(g[0]), c1 = rgb(g[1]), c2 = rgb(g[2])
        if scene.flatGradient {
            LinearGradient(stops: [.init(color: c0, location: 0), .init(color: c1, location: 0.58), .init(color: c2, location: 1)],
                           startPoint: .top, endPoint: .bottom)
        } else {
            let w = size.width, h = size.height
            let span = max(w, h)
            let orbMain = span * 0.92, orbSide = span * 0.55, core = span * 0.22
            let cx = w * 0.5, cy = h * 0.34
            let f = MusicVisuals.glowFrame(tMs: tMs)
            ZStack {
                LinearGradient(stops: [.init(color: c0, location: 0), .init(color: c1, location: 0.35), .init(color: c2, location: 0.7), .init(color: rgb(0x0a0908), location: 1)],
                               startPoint: UnitPoint(x: 0.15, y: 0), endPoint: UnitPoint(x: 0.85, y: 1))
                Circle().fill(c0).frame(width: orbMain, height: orbMain)
                    .scaleEffect(f.mainScale).opacity(f.mainOpacity)
                    .position(x: cx + f.mainX, y: cy + f.mainY)
                if scene.showSideOrbs {
                    Circle().fill(c1).frame(width: orbSide, height: orbSide)
                        .scaleEffect(f.leftScale).opacity(f.leftOpacity)
                        .position(x: w * 0.08 - orbSide * 0.2 + orbSide / 2 + f.leftX, y: h * 0.18 + orbSide / 2 + f.leftY)
                    let rs = orbSide * 0.85
                    Circle().fill(c2).frame(width: rs, height: rs)
                        .scaleEffect(f.rightScale).opacity(f.rightOpacity)
                        .position(x: w - (w * 0.02 - orbSide * 0.15) - rs / 2 + f.rightX, y: h * 0.42 + rs / 2 + f.rightY)
                }
                if scene.showCenterOrb {
                    Circle().fill(rgba(251, 230, 180, 0.85)).frame(width: core, height: core)
                        .scaleEffect(f.coreScale).opacity(f.coreOpacity)
                        .position(x: cx + (scene.centerOrbSway ? f.coreXWide : f.coreX), y: cy + (scene.centerOrbSway ? 0 : f.coreY))
                }
            }
        }
    }
}

/// 鱼群漩涡（RN SlowFish + fishSwarmNativeMotion）：100 条鱼，9 组谐波轨道，摆尾 + 闪烁；Canvas 一帧画完
private struct FishSwarmLayer: View {
    let tMs: Double
    let size: CGSize
    private static let fish = BundleImage.load("fish", ext: "png")

    /// 40×14 框内 contain：等比缩放后居中（以轨道点为中心，对应 RN left -20 / top -7）
    static func spriteRect(_ image: CGSize) -> CGRect {
        let boxW: CGFloat = 40, boxH: CGFloat = 14
        guard image.width > 0, image.height > 0 else { return CGRect(x: -boxW / 2, y: -boxH / 2, width: boxW, height: boxH) }
        let k = min(boxW / image.width, boxH / image.height)
        let w = image.width * k, h = image.height * k
        return CGRect(x: -w / 2, y: -h / 2, width: w, height: h)
    }

    var body: some View {
        Canvas { ctx, _ in
            guard let ui = Self.fish else { return }
            var sprite = ctx.resolve(Image(uiImage: ui).renderingMode(.template))
            sprite.shading = .color(.white.opacity(0.95))
            let cx = size.width * 0.5, cy = size.height * MusicVisuals.focusCenterYRatio
            for seed in MusicVisuals.fishSeeds {
                let f = MusicVisuals.fishFrame(seed, tMs: tMs)
                var c = ctx
                c.translateBy(x: cx + f.x, y: cy + f.y)
                c.rotate(by: .degrees(f.headingDeg))
                c.scaleBy(x: f.scale, y: f.scale)
                c.opacity = f.opacity
                // RN fishSprite：40×14 的框，resizeMode="contain"——fish-shape.png 是 300×54，按宽 40 等比缩成 40×7.2 居中，
                // 不能拉满 14 高（拉满就成了胖鱼，Josh 2026-09-09：「没有用我之前画的那个小鱼」）
                c.draw(sprite, in: Self.spriteRect(ui.size))
            }
        }
    }
}

/// 呼吸环（RN BreathingRing）：吸 7s · 停 · 呼 8s，圆 154 + 外晕 182
private struct BreathingRingLayer: View {
    let tMs: Double
    let size: CGSize
    var body: some View {
        let f = MusicVisuals.breathFrame(tMs: tMs)
        let cx = size.width * 0.5, cy = size.height * MusicVisuals.focusCenterYRatio
        ZStack {
            Circle().fill(rgba(217, 229, 243, 0.34)).frame(width: 182, height: 182)
                .shadow(color: rgb(0xd7e6f6), radius: 36)
                .scaleEffect(f.scale).opacity(f.glowOpacity)
            Circle().fill(rgba(233, 236, 242, 0.62)).frame(width: 154, height: 154)
                .shadow(color: rgb(0xd6deea).opacity(0.9), radius: 32)
                .scaleEffect(f.scale).opacity(f.circleOpacity)
        }
        .position(x: cx, y: cy)
    }
}

/// 下午茶（RN SunOrb + CoffeeBeanOrbit）：咖啡杯 + 呼吸光晕，34 颗豆子绕圈跳舞（首颗白豆带三颗跟随）
private struct CoffeeSceneLayer: View {
    let tMs: Double
    let size: CGSize
    private static let bean = BundleImage.load("coffee-bean-shape", ext: "png")

    var body: some View {
        let layout = MusicVisuals.coffeeOrbitLayout(width: size.width, height: size.height, viewportHeight: size.height)
        let nodes = MusicVisuals.beanNodes(layout)
        let leaderOrbitMs = nodes[MusicVisuals.whiteBeanIndex].orbitMs
        ZStack {
            Canvas { ctx, _ in
                guard let ui = Self.bean else { return }
                var dark = ctx.resolve(Image(uiImage: ui).renderingMode(.template))
                dark.shading = .color(rgba(75, 47, 27, 1))
                var light = ctx.resolve(Image(uiImage: ui).renderingMode(.template))
                light.shading = .color(rgba(255, 252, 245, 1))
                for node in nodes {
                    let f = MusicVisuals.beanFrame(node, leaderOrbitMs: leaderOrbitMs, tMs: tMs)
                    var c = ctx
                    c.translateBy(x: layout.cx + f.x, y: layout.cy + f.y)
                    c.rotate(by: .degrees(f.rotationDeg))
                    c.scaleBy(x: f.scale, y: f.scale)
                    c.opacity = f.opacity
                    c.draw(node.isLeader ? light : dark, in: CGRect(x: -node.beanW / 2, y: -node.beanH / 2, width: node.beanW, height: node.beanH))
                }
            }
            ZStack {
                Circle().fill(rgba(255, 245, 232, 0.28)).frame(width: 98, height: 98)
                    .shadow(color: rgb(0xfff3e6).opacity(0.95), radius: 34)
                    .opacity(MusicVisuals.cupGlowOpacity(tMs: tMs))
                MaterialIcon(glyph: MI.localCafe, size: MusicVisuals.coffeeCupIconSize, color: rgb(0xfff7ef))
                    .shadow(color: rgba(255, 245, 232, 0.5), radius: 10)
            }
            .position(x: layout.cx, y: layout.cy)
        }
    }
}

/// 睡眠（RN SlowStars + SlowMeteors + SleepCrescentMoon）
private struct SleepSkyLayer: View {
    let tMs: Double
    let size: CGSize
    private static let moon = BundleImage.load("sleep-crescent-moon", ext: "png")

    var body: some View {
        let w = size.width, h = size.height
        ZStack {
            Canvas { ctx, _ in
                // 星：闪烁 + 小幅拖尾位移
                for i in 0..<MusicVisuals.starCount {
                    let s = MusicVisuals.star(i, width: w, height: h)
                    let f = MusicVisuals.starFrame(s, tMs: tMs)
                    let rect = CGRect(x: s.x + f.dx, y: s.y + f.dy, width: s.size, height: s.size)
                    var glow = ctx
                    glow.opacity = f.opacity * 0.35
                    glow.fill(Path(ellipseIn: rect.insetBy(dx: -s.size * 0.9, dy: -s.size * 0.9)), with: .color(rgb(0xe5f2ff)))
                    var dot = ctx
                    dot.opacity = f.opacity
                    dot.fill(Path(ellipseIn: rect), with: .color(rgba(241, 248, 255, 0.95)))
                }
                // 流星：只在上方 34% 的天空层
                var sky = ctx
                sky.clip(to: Path(CGRect(x: 0, y: 0, width: w, height: h * 0.34)))
                for i in 0..<MusicVisuals.meteorCount {
                    let m = MusicVisuals.meteor(i, width: w, height: h)
                    let f = MusicVisuals.meteorFrame(m, tMs: tMs)
                    var c = sky
                    c.translateBy(x: m.startX + f.dx + m.length / 2, y: m.startY + f.dy + 1)
                    c.rotate(by: .degrees(-32))
                    c.scaleBy(x: m.scale, y: m.scale)
                    c.opacity = f.opacity
                    let body = CGRect(x: -m.length / 2, y: -1, width: m.length, height: 2)
                    c.fill(Path(roundedRect: body.insetBy(dx: -2, dy: -3), cornerRadius: 4), with: .color(rgb(0xdbeeff).opacity(0.35)))
                    c.fill(Path(roundedRect: body, cornerRadius: 1), with: .color(rgba(229, 243, 255, 0.82)))
                }
            }
            if let ui = Self.moon {
                Image(uiImage: ui).renderingMode(.template).resizable().scaledToFit()
                    .frame(width: 86, height: 86)
                    .foregroundStyle(rgba(229, 242, 255, 0.98))
                    .opacity(MusicVisuals.moonOpacity(tMs: tMs))
                    // RN 月亮住在上半舞台底部；Josh 2026-09-10「月亮要往上放一些」→ 提到 35% 高度
                    .position(x: w * 0.5, y: h * 0.35)
            }
        }
    }
}

/// 专注工作（RN WorkSpacePlanets）：核心雾 + 大球 + 两颗绕行的行星
private struct WorkPlanetsLayer: View {
    let tMs: Double
    let size: CGSize
    var body: some View {
        let f = MusicVisuals.planetFrame(tMs: tMs)
        let cx = size.width * 0.5, cy = size.height * MusicVisuals.focusCenterYRatio
        let a = (f.orbitADeg + 18) * Double.pi / 180
        let b = (f.orbitBDeg - 142) * Double.pi / 180
        ZStack {
            Circle().fill(rgba(164, 188, 226, 0.14)).frame(width: 292, height: 292).opacity(f.mistOuterOpacity).position(x: cx, y: cy)
            Circle().fill(rgba(176, 201, 236, 0.18)).frame(width: 236, height: 236).opacity(f.mistInnerOpacity).position(x: cx, y: cy)
            Circle().fill(rgba(160, 182, 222, 0.34)).frame(width: 176, height: 176)
                .shadow(color: rgb(0x9fb8e8).opacity(0.5), radius: 30).position(x: cx, y: cy)
            Circle().fill(rgba(124, 150, 198, 0.26)).frame(width: 56, height: 56)
                .shadow(color: rgb(0x89a9dd).opacity(0.44), radius: 20)
                .position(x: cx + cos(a) * 176, y: cy + sin(a) * 176)
            Circle().fill(rgba(193, 214, 245, 0.3)).frame(width: 42, height: 42)
                .shadow(color: rgb(0xbdd3f5).opacity(0.48), radius: 14)
                .position(x: cx + cos(b) * 152, y: cy + sin(b) * 152)
        }
    }
}
