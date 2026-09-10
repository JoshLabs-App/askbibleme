import Foundation

/// 音乐页每个专辑（「各栏」）上方的动画，纯数学部分。逐条对应 RN：
/// musicAlbumVisualConstants（pseudoRandom01 / 常量）、fishSwarmNativeMotion（鱼群）、coffeeOrbitLayout +
/// coffeeBeanNodeLayout + useCoffeeBeanNodeMotion（咖啡豆）、MusicHomeStarVisual / MeteorVisual（星与流星）、
/// useMusicEnergyGlowBreath（光球呼吸）、MusicHomeCalmVisuals（呼吸环）、useWorkSpacePlanetMotion（行星）。
/// RN 用 Animated 时钟 + interpolate；这里全部改成「时间 t（秒）→ 当帧数值」的纯函数，
/// 两端 Canvas 每帧算一遍即可，没有动画对象要管理。种子与几何布局与 RN 完全一致（check:music-visuals 对拍）。
enum MusicVisuals {
    static let tau = Double.pi * 2

    /// RN pseudoRandom01：frac(sin(seed·12.9898)·43758.5453)
    static func pseudoRandom01(_ seed: Double) -> Double {
        let x = sin(seed * 12.9898) * 43758.5453
        return x - floor(x)
    }

    // MARK: 缓动 / 周期工具（RN Easing 同款）

    static func easeInOutCubic(_ t: Double) -> Double {
        let u = min(max(t, 0), 1)
        return u < 0.5 ? 4 * u * u * u : 1 - pow(-2 * u + 2, 3) / 2
    }

    static func easeInOutQuad(_ t: Double) -> Double {
        let u = min(max(t, 0), 1)
        return u < 0.5 ? 2 * u * u : 1 - pow(-2 * u + 2, 2) / 2
    }

    /// Easing.bezier(0.42, 0, 0.58, 1)（RN 光球呼吸的 SILK），用正弦近似
    static func easeSilk(_ t: Double) -> Double {
        let u = min(max(t, 0), 1)
        return 0.5 - 0.5 * cos(u * Double.pi)
    }

    /// 线性插值表（RN interpolate 的 inputRange / outputRange）
    static func interpolate(_ v: Double, _ input: [Double], _ output: [Double]) -> Double {
        if v <= input[0] { return output[0] }
        for i in 1..<input.count where v <= input[i] {
            let span = input[i] - input[i - 1]
            let k = span > 0 ? (v - input[i - 1]) / span : 0
            return output[i - 1] + (output[i] - output[i - 1]) * k
        }
        return output[output.count - 1]
    }

    /// 0→1→0 的往返呼吸：up 毫秒升、down 毫秒降，可带停顿；返回 0…1
    static func pingPong(_ tMs: Double, up: Double, down: Double, holdTop: Double = 0, holdBottom: Double = 0,
                         ease: (Double) -> Double = easeInOutCubic) -> Double {
        let period = up + holdTop + down + holdBottom
        guard period > 0 else { return 0 }
        var p = tMs.truncatingRemainder(dividingBy: period)
        if p < 0 { p += period }
        if p < up { return ease(p / up) }
        p -= up
        if p < holdTop { return 1 }
        p -= holdTop
        if p < down { return 1 - ease(p / down) }
        return 0
    }

    /// 线性循环时钟 0…1
    static func clock(_ tMs: Double, period: Double) -> Double {
        guard period > 0 else { return 0 }
        var c = (tMs / period).truncatingRemainder(dividingBy: 1)
        if c < 0 { c += 1 }
        return c
    }

    /// RN 三角波：u≤0.5 从 at0 升到 atHalf，之后降回
    static func triangle(_ u: Double, _ at0: Double, _ atHalf: Double) -> Double {
        u <= 0.5 ? at0 + (atHalf - at0) * (u * 2) : atHalf + (at0 - atHalf) * ((u - 0.5) * 2)
    }

    static func nearestIndex(_ target: Double, _ candidates: [Double]) -> Int {
        var best = 0
        for i in 1..<candidates.count where abs(candidates[i] - target) < abs(candidates[best] - target) { best = i }
        return best
    }

    // MARK: 专辑 → 场景（RN MusicHomeBackdrop / MusicHomeUpperDecor 的分支）

    static let gradients: [String: [UInt32]] = [
        "安静": [0x10C0DF, 0x0e8ca3, 0x0a2a33],
        "下午茶": [0xf3e6d8, 0xdcc4ab, 0xb69173],
        "专注工作": [0x22324e, 0x18243a, 0x0b1222],
        "睡眠": [0x0d1d46, 0x081233, 0x030816],
        "钢琴": [0xe8dcc8, 0xc4b39a, 0x8a7359],
        "赞美诗": [0xd7c4b0, 0xb89a7a, 0x6e5340],
    ]
    static func gradient(_ album: String) -> [UInt32] { gradients[album] ?? gradients["安静"]! }

    struct Scene {
        /// 只画平铺竖向渐变（睡眠 / 钢琴 / 赞美诗）
        let flatGradient: Bool
        let showCenterOrb: Bool
        let centerOrbSway: Bool
        let showSideOrbs: Bool
        let fish: Bool
        let breathRing: Bool
        let coffee: Bool
        let sleepSky: Bool
        let planets: Bool
    }

    static func scene(_ album: String) -> Scene {
        Scene(
            flatGradient: album == "睡眠" || album == "钢琴" || album == "赞美诗",
            showCenterOrb: album != "安静" && album != "睡眠" && album != "专注工作",
            centerOrbSway: album == "下午茶",
            showSideOrbs: album != "安静" && album != "专注工作",
            fish: album == "安静",
            breathRing: album == "安静",
            coffee: album == "下午茶",
            sleepSky: album == "睡眠",
            planets: album == "专注工作"
        )
    }

    /// 上半舞台视觉的中心 Y（FOCUS_ORB_CENTER_Y_RATIO）
    static let focusCenterYRatio = 0.382

    // MARK: 光球呼吸（useMusicEnergyGlowBreath）

    struct GlowFrame {
        let mainScale, mainX, mainY, mainOpacity: Double
        let leftScale, leftX, leftY, leftOpacity: Double
        let rightScale, rightX, rightY, rightOpacity: Double
        let coreScale, coreX, coreXWide, coreY, coreOpacity: Double
    }

    static func glowFrame(tMs: Double) -> GlowFrame {
        // startBreathLoop：half = max(2400, period/2)，SILK 缓动往返；左右两球带初值相位
        let main = pingPong(tMs, up: 5400, down: 5400, ease: easeSilk)
        let left = pingPong(tMs + 0.32 * 13400, up: 6700, down: 6700, ease: easeSilk)
        let right = pingPong(tMs + 0.68 * 9600, up: 4800, down: 4800, ease: easeSilk)
        return GlowFrame(
            mainScale: 0.9 + 0.16 * main, mainX: -10 + 20 * main, mainY: 8 - 16 * main,
            mainOpacity: interpolate(main, [0, 0.5, 1], [0.16, 0.3, 0.16]),
            leftScale: 0.86 + 0.17 * left, leftX: 8 - 16 * left, leftY: -6 + 12 * left,
            leftOpacity: interpolate(left, [0, 0.5, 1], [0.1, 0.24, 0.1]),
            rightScale: 0.88 + 0.16 * right, rightX: -9 + 18 * right, rightY: 7 - 14 * right,
            rightOpacity: interpolate(right, [0, 0.5, 1], [0.11, 0.26, 0.11]),
            coreScale: 0.93 + 0.09 * main, coreX: -4 + 8 * main, coreXWide: -16 + 32 * main, coreY: 4 - 8 * main,
            coreOpacity: interpolate(main, [0, 0.5, 1], [0.06, 0.16, 0.06])
        )
    }

    // MARK: 呼吸环（BreathingRing）：吸 7s · 停 1.8s · 呼 8s · 停 1.8s

    struct BreathFrame { let scale, circleOpacity, glowOpacity: Double }
    static func breathFrame(tMs: Double) -> BreathFrame {
        let p = pingPong(tMs, up: 7000, down: 8000, holdTop: 1800, holdBottom: 1800)
        return BreathFrame(scale: 0.62 + 0.84 * p, circleOpacity: 0.42 + 0.4 * p, glowOpacity: 0.28 + 0.32 * p)
    }

    /// 咖啡杯光晕（SunOrb）：5.2s 往返，0.16…0.34
    static func cupGlowOpacity(tMs: Double) -> Double { 0.16 + 0.18 * pingPong(tMs, up: 5200, down: 5200) }

    /// 月亮（SleepCrescentMoon）：7.2s 往返，0.42…0.78
    static func moonOpacity(tMs: Double) -> Double { 0.42 + 0.36 * pingPong(tMs, up: 7200, down: 7200) }

    // MARK: 鱼群（fishSwarmNativeMotion）

    static let fishCount = 100
    static let orbitPeriodMs = 168_000.0
    static let orbitHarmonics: [Int] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    static let shimmerPeriodMs = 8_400.0
    static let swimPeriodsMs: [Double] = [2600, 3120, 3640, 4160, 4680, 5200]

    struct FishSeed {
        let baseAngleDeg, radius, size, opacity: Double
        let orbitHarmonic: Int
        let shimmerOffset: Double
        let swimBucket: Int
        let swimOffset, tangentialAmp, radialAmp, headingAmp: Double
    }

    static let fishSeeds: [FishSeed] = {
        let harmonicPeriods = orbitHarmonics.map { orbitPeriodMs / Double($0) }
        return (0..<fishCount).map { i in
            let d = Double(i)
            let ring = Double(i / 12)
            let slot = Double(i % 12)
            let angleJitter = (pseudoRandom01(d * 19 + 7) - 0.5) * 44
            let randomSpeed = 0.45 + pseudoRandom01(d * 41 + 9) * 1.7
            let speedFactor = (0.7 + ring * 0.14) * randomSpeed * 0.58
            let swimPeriodMs = 2600 + pseudoRandom01(d * 73 + 33) * 2600
            return FishSeed(
                baseAngleDeg: slot * 30 + angleJitter + ring * 2.5 + pseudoRandom01(d * 67 + 21) * 360,
                radius: 132 + ring * 13.5 + pseudoRandom01(d * 23 + 11) * 20,
                size: 0.55 + pseudoRandom01(d * 31 + 17) * 0.68,
                opacity: 0.34 + pseudoRandom01(d * 37 + 3) * 0.28,
                orbitHarmonic: orbitHarmonics[nearestIndex(42_000 / max(speedFactor, 0.0001), harmonicPeriods)],
                shimmerOffset: d / Double(fishCount),
                swimBucket: nearestIndex(swimPeriodMs, swimPeriodsMs),
                swimOffset: (d * 0.21).truncatingRemainder(dividingBy: 1),
                tangentialAmp: 1.6 + pseudoRandom01(d * 79 + 27) * 2.2,
                radialAmp: 1.6 + pseudoRandom01(d * 83 + 31) * 3.2,
                headingAmp: 1.2 + pseudoRandom01(d * 89 + 37) * 2.6
            )
        }
    }()

    /// 一条鱼在某一帧：相对漩涡中心的位置（pt，设计稿尺度）、朝向（度）、缩放、透明度
    struct FishFrame { let x, y, headingDeg, scale, opacity: Double }

    static func fishFrame(_ seed: FishSeed, tMs: Double) -> FishFrame {
        let orbitDeg = 360 * Double(seed.orbitHarmonic) * clock(tMs, period: orbitPeriodMs)
        let swimU = (clock(tMs, period: swimPeriodsMs[seed.swimBucket]) + seed.swimOffset).truncatingRemainder(dividingBy: 1)
        let shimU = (clock(tMs, period: shimmerPeriodMs) + seed.shimmerOffset).truncatingRemainder(dividingBy: 1)
        let tx = seed.radius + cos(swimU * tau) * seed.radialAmp
        let ty = sin(swimU * tau) * seed.tangentialAmp + triangle(shimU, -2.4, 2.4)
        let heading = 90 + sin(swimU * tau) * seed.headingAmp
        // RN transform 顺序：轨道组 rotate → rotate(base) → translate(tx, ty) → rotate(heading) → scale
        let a = (orbitDeg + seed.baseAngleDeg) * Double.pi / 180
        return FishFrame(
            x: cos(a) * tx - sin(a) * ty,
            y: sin(a) * tx + cos(a) * ty,
            headingDeg: orbitDeg + seed.baseAngleDeg + heading,
            scale: seed.size,
            opacity: seed.opacity * triangle(shimU, 0.88, 1)
        )
    }

    // MARK: 咖啡豆（coffeeOrbitLayout / coffeeBeanNodeLayout / useCoffeeBeanNodeMotion）

    static let coffeeBeanCount = 34
    static let whiteBeanIndex = 0
    static let followerBeanIndices = [1, 2, 3]
    static let coffeeCupIconSize = 88.0
    static let coffeeOrbitVisiblePadding = 4.0
    static let coffeeOrbitMinRadius = 34.0

    struct CoffeeOrbitLayout { let cx, cy, innerRadius, outerRadius: Double }

    static func coffeeOrbitLayout(width: Double, height: Double, viewportHeight: Double, viewportTop: Double = 0) -> CoffeeOrbitLayout {
        let cx = width * 0.5
        let cy = viewportHeight * focusCenterYRatio - viewportTop
        let cyOnScreen = viewportTop + cy
        let maxVisible = max(coffeeOrbitMinRadius + 16,
                             min(cx - coffeeOrbitVisiblePadding, width - cx - coffeeOrbitVisiblePadding,
                                 cyOnScreen - coffeeOrbitVisiblePadding, viewportHeight - cyOnScreen - coffeeOrbitVisiblePadding))
        let cupOuter = coffeeCupIconSize * 0.56
        let keepOut = cupOuter + 32
        let desiredInner = keepOut + 8
        let desiredOuter = desiredInner + 880
        let inner = max(coffeeOrbitMinRadius, min(desiredInner, maxVisible - 12))
        let outer = max(inner + 12, min(desiredOuter, maxVisible))
        return CoffeeOrbitLayout(cx: cx, cy: cy, innerRadius: inner, outerRadius: outer)
    }

    struct BeanNode {
        let index: Int
        let isLeader, isFollower: Bool
        let followIndex: Int
        let direction: Double
        let angle, radius, beanW, beanH, orbitPhaseDeg, followerBaseDeg, opacity: Double
        /// 轨道一圈毫秒（含抖动）；bob 往返的延迟 / 上 / 下毫秒
        let orbitMs, bobDelayMs, bobUpMs, bobDownMs: Double
    }

    static func beanNode(_ index: Int, layout: CoffeeOrbitLayout) -> BeanNode {
        let d = Double(index)
        let isLeader = index == whiteBeanIndex
        let followIndex = followerBeanIndices.firstIndex(of: index) ?? -1
        let isFollower = followIndex >= 0
        let direction: Double = (isLeader || isFollower) ? -1 : 1
        let ringCount = 10
        let ring = index % ringCount
        let slotsPerRing = Int(ceil(Double(coffeeBeanCount) / Double(ringCount)))
        let slot = index / ringCount
        let angleBase = Double(slot) * (360 / Double(slotsPerRing)) + Double(ring) * 4
        let leaderD = Double(whiteBeanIndex)
        let leaderAngleBase = (pseudoRandom01(leaderD * 5 + 1) - 0.5) * 8
        let followGap = 10 + pseudoRandom01(d * 71 + 4) * 2
        let angle = isFollower ? leaderAngleBase + Double(followIndex + 1) * (followGap * 0.36)
                               : angleBase + (pseudoRandom01(d * 5 + 1) - 0.5) * 4
        let ringRatio = ringCount <= 1 ? 0 : Double(ring) / Double(ringCount - 1)
        let radiusBase = layout.innerRadius + (layout.outerRadius - layout.innerRadius) * ringRatio
        let leaderRadius = (layout.outerRadius - 2) + (pseudoRandom01(leaderD * 13 + 3) - 0.5) * 4
        let radius = isLeader ? leaderRadius
            : isFollower ? leaderRadius + Double(followIndex) * 2 + (pseudoRandom01(d * 79 + 6) - 0.5) * 2
            : radiusBase + pseudoRandom01(d * 13 + 3) * 18
        let beanW = 20 + pseudoRandom01(d * 17 + 9) * 18
        let beanH = beanW * (0.56 + pseudoRandom01(d * 13 + 5) * 0.2)
        let orbitPhaseDeg = pseudoRandom01(d * 61 + 21) * 360
        let leaderOrbitBaseDeg = pseudoRandom01(leaderD * 61 + 21) * 360
        let leaderPhaseLag = isFollower ? 16 + Double(followIndex) * 12 : 0
        let baseDuration: Double = isLeader ? 24500 : (isFollower ? 27200 : 29400)
        return BeanNode(
            index: index, isLeader: isLeader, isFollower: isFollower, followIndex: followIndex, direction: direction,
            angle: angle, radius: radius, beanW: beanW, beanH: beanH, orbitPhaseDeg: orbitPhaseDeg,
            followerBaseDeg: leaderOrbitBaseDeg + leaderPhaseLag,
            opacity: isLeader ? 0.62 : 0.22 + pseudoRandom01(d * 97 + 13) * 0.18,
            orbitMs: baseDuration + floor(pseudoRandom01(d * 31 + 7) * 9000),
            bobDelayMs: 120 + floor(pseudoRandom01(d * 53 + 11) * 1200),
            bobUpMs: 5200 + floor(pseudoRandom01(d * 43 + 5) * 2800),
            bobDownMs: 5200 + floor(pseudoRandom01(d * 47 + 3) * 2800)
        )
    }

    static let beanNodes: (CoffeeOrbitLayout) -> [BeanNode] = { layout in (0..<coffeeBeanCount).map { beanNode($0, layout: layout) } }

    /// 一颗豆子在某一帧：中心（相对轨道中心）、总旋转（度）、缩放、透明度
    struct BeanFrame { let x, y, rotationDeg, scale, opacity: Double }

    static func beanFrame(_ node: BeanNode, leaderOrbitMs: Double, tMs: Double) -> BeanFrame {
        // bob：延迟 → 上（易入易出三次）→ 下，循环
        let bob = pingPongDelayed(tMs, delay: node.bobDelayMs, up: node.bobUpMs, down: node.bobDownMs)
        let orbitClock = clock(tMs, period: node.isFollower ? leaderOrbitMs : node.orbitMs)
        let spin = node.isFollower
            ? node.followerBaseDeg + node.direction * 360 * orbitClock
            : node.orbitPhaseDeg + node.direction * 360 * orbitClock
        let bobY = interpolate(bob, [0, 0.25, 0.5, 0.75, 1], [-14, -2, 16, 3, -14])
        let swayX = interpolate(bob, [0, 0.25, 0.5, 0.75, 1], [-6, 3, 8, -2, -6])
        let floatY = interpolate(bob, [0, 0.25, 0.5, 0.75, 1], [0, -3, 4, -2, 0])
        let danceRotate = interpolate(bob, [0, 0.25, 0.5, 0.75, 1], [-16, -4, 18, 6, -16])
        let danceScale = interpolate(bob, [0, 0.25, 0.5, 0.75, 1], [0.86, 0.98, 1.16, 1.02, 0.86])
        let wobble = node.isFollower ? interpolate(bob, [0, 0.5, 1], [-3, 4, -3])
                                     : interpolate(bob, [0, 0.25, 0.5, 0.75, 1], [-3, -1, 4, 1, -3])
        let drift = node.isFollower ? interpolate(bob, [0, 0.5, 1], [0, 12, 0])
                                    : interpolate(bob, [0, 0.25, 0.5, 0.75, 1], [0, 2, 14, 6, 0])
        // RN transform 链：rotate(angle) → rotate(spin) → translateX(radius) → translateX(drift) → rotate(wobble)
        //   → translateX(sway) → translateY(float) → translateY(bob) → rotate(dance) → scale(dance)
        var x = 0.0, y = 0.0, heading = 0.0
        func rot(_ deg: Double) { heading += deg }
        func move(_ dx: Double, _ dy: Double) {
            let a = heading * Double.pi / 180
            x += cos(a) * dx - sin(a) * dy
            y += sin(a) * dx + cos(a) * dy
        }
        rot(node.angle); rot(spin); move(node.radius, 0); move(drift, 0); rot(wobble)
        move(swayX, 0); move(0, floatY); move(0, bobY); rot(danceRotate)
        return BeanFrame(x: x, y: y, rotationDeg: heading, scale: danceScale, opacity: node.opacity)
    }

    /// 延迟 → 上 → 下 的循环（RN Animated.sequence(delay, timing↑, timing↓) 套 loop）
    static func pingPongDelayed(_ tMs: Double, delay: Double, up: Double, down: Double) -> Double {
        let period = delay + up + down
        var p = tMs.truncatingRemainder(dividingBy: period)
        if p < 0 { p += period }
        if p < delay { return 0 }
        p -= delay
        if p < up { return easeInOutCubic(p / up) }
        return 1 - easeInOutCubic((p - up) / down)
    }

    // MARK: 星与流星（MusicHomeStarVisual / MusicHomeMeteorVisual）

    static let starCount = 28
    static let meteorCount = 4

    struct Star { let x, y, size, trailSpan, trailTilt, upMs, downMs: Double }
    static func star(_ i: Int, width: Double, height: Double) -> Star {
        let d = Double(i)
        return Star(
            x: width * (0.06 + pseudoRandom01(d * 13 + 1) * 0.88),
            y: height * (0.05 + pseudoRandom01(d * 17 + 2) * 0.5),
            size: 1.5 + pseudoRandom01(d * 23 + 3) * 2.2,
            trailSpan: 1.8 + pseudoRandom01(d * 29 + 5) * 4.2,
            trailTilt: (pseudoRandom01(d * 31 + 7) - 0.5) * 0.8,
            upMs: 2600 + floor(pseudoRandom01(d * 29 + 3) * 3600),
            downMs: 2800 + floor(pseudoRandom01(d * 31 + 7) * 3400)
        )
    }

    struct StarFrame { let opacity, dx, dy: Double }
    static func starFrame(_ s: Star, tMs: Double) -> StarFrame {
        // 0.22 ↔ 0.78 往返（易入易出二次）
        let v = 0.22 + 0.56 * pingPong(tMs, up: s.upMs, down: s.downMs, ease: easeInOutQuad)
        return StarFrame(
            opacity: v,
            dx: interpolate(v, [0.22, 0.5, 0.78], [-s.trailSpan, 0, s.trailSpan]),
            dy: interpolate(v, [0.22, 0.5, 0.78], [s.trailSpan * (0.24 + s.trailTilt), -s.trailSpan * 0.18, s.trailSpan * (0.24 - s.trailTilt)])
        )
    }

    struct Meteor { let startX, startY, driftX, driftY, scale, length, periodMs: Double }
    static func meteor(_ i: Int, width: Double, height: Double) -> Meteor {
        let d = Double(i)
        return Meteor(
            startX: width * (0.1 + pseudoRandom01(d * 3 + 1) * 0.74),
            startY: height * (0.03 + pseudoRandom01(d * 5 + 2) * 0.1),
            driftX: -(44 + pseudoRandom01(d * 11 + 3) * 30),
            driftY: 14 + pseudoRandom01(d * 13 + 4) * 20,
            scale: 0.72 + pseudoRandom01(d * 19 + 5) * 0.85,
            length: 22 + pseudoRandom01(d * 23 + 6) * 22,
            periodMs: 15000 + floor(pseudoRandom01(d * 43 + 7) * 9000)
        )
    }

    struct MeteorFrame { let opacity, dx, dy: Double }
    static func meteorFrame(_ m: Meteor, tMs: Double) -> MeteorFrame {
        let v = clock(tMs, period: m.periodMs)
        return MeteorFrame(opacity: interpolate(v, [0, 0.1, 0.84, 1], [0, 0.26, 0.22, 0]), dx: v * m.driftX, dy: v * m.driftY)
    }

    // MARK: 行星（useWorkSpacePlanetMotion）

    struct PlanetFrame { let orbitADeg, orbitBDeg, mistOuterOpacity, mistInnerOpacity: Double }
    static func planetFrame(tMs: Double) -> PlanetFrame {
        let mist = pingPong(tMs, up: 6800, down: 6800)
        return PlanetFrame(orbitADeg: 360 * clock(tMs, period: 72000), orbitBDeg: 360 * clock(tMs, period: 32000),
                           mistOuterOpacity: 0.1 + 0.14 * mist, mistInnerOpacity: 0.26 - 0.14 * mist)
    }
}
