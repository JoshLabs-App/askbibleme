package me.askbible.native_.data

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/**
 * 音乐页每个专辑（「各栏」）上方的动画，纯数学部分。逐条对应 RN：
 * musicAlbumVisualConstants（pseudoRandom01 / 常量）、fishSwarmNativeMotion（鱼群）、coffeeOrbitLayout +
 * coffeeBeanNodeLayout + useCoffeeBeanNodeMotion（咖啡豆）、MusicHomeStarVisual / MeteorVisual（星与流星）、
 * useMusicEnergyGlowBreath（光球呼吸）、MusicHomeCalmVisuals（呼吸环）、useWorkSpacePlanetMotion（行星）。
 * RN 用 Animated 时钟 + interpolate；这里全部改成「时间 t（毫秒）→ 当帧数值」的纯函数。与 iOS MusicVisuals.swift 同构。
 */
object MusicVisuals {
    const val TAU = PI * 2

    /** RN pseudoRandom01：frac(sin(seed·12.9898)·43758.5453) */
    fun pseudoRandom01(seed: Double): Double {
        val x = sin(seed * 12.9898) * 43758.5453
        return x - floor(x)
    }

    // ---- 缓动 / 周期工具（RN Easing 同款） ----

    fun easeInOutCubic(t: Double): Double {
        val u = t.coerceIn(0.0, 1.0)
        return if (u < 0.5) 4 * u * u * u else 1 - (-2 * u + 2).pow(3) / 2
    }

    fun easeInOutQuad(t: Double): Double {
        val u = t.coerceIn(0.0, 1.0)
        return if (u < 0.5) 2 * u * u else 1 - (-2 * u + 2).pow(2) / 2
    }

    /** Easing.bezier(0.42, 0, 0.58, 1)（RN 光球呼吸的 SILK），用正弦近似 */
    fun easeSilk(t: Double): Double = 0.5 - 0.5 * cos(t.coerceIn(0.0, 1.0) * PI)

    /** 线性插值表（RN interpolate 的 inputRange / outputRange） */
    fun interpolate(v: Double, input: DoubleArray, output: DoubleArray): Double {
        if (v <= input[0]) return output[0]
        for (i in 1 until input.size) {
            if (v <= input[i]) {
                val span = input[i] - input[i - 1]
                val k = if (span > 0) (v - input[i - 1]) / span else 0.0
                return output[i - 1] + (output[i] - output[i - 1]) * k
            }
        }
        return output.last()
    }

    /** 0→1→0 的往返呼吸：up 毫秒升、down 毫秒降，可带停顿；返回 0…1 */
    fun pingPong(tMs: Double, up: Double, down: Double, holdTop: Double = 0.0, holdBottom: Double = 0.0,
                 ease: (Double) -> Double = ::easeInOutCubic): Double {
        val period = up + holdTop + down + holdBottom
        if (period <= 0) return 0.0
        var p = tMs % period
        if (p < 0) p += period
        if (p < up) return ease(p / up)
        p -= up
        if (p < holdTop) return 1.0
        p -= holdTop
        if (p < down) return 1 - ease(p / down)
        return 0.0
    }

    /** 线性循环时钟 0…1 */
    fun clock(tMs: Double, period: Double): Double {
        if (period <= 0) return 0.0
        var c = (tMs / period) % 1
        if (c < 0) c += 1
        return c
    }

    /** RN 三角波：u≤0.5 从 at0 升到 atHalf，之后降回 */
    fun triangle(u: Double, at0: Double, atHalf: Double): Double =
        if (u <= 0.5) at0 + (atHalf - at0) * (u * 2) else atHalf + (at0 - atHalf) * ((u - 0.5) * 2)

    fun nearestIndex(target: Double, candidates: DoubleArray): Int {
        var best = 0
        for (i in 1 until candidates.size) if (abs(candidates[i] - target) < abs(candidates[best] - target)) best = i
        return best
    }

    // ---- 专辑 → 场景（RN MusicHomeBackdrop / MusicHomeUpperDecor 的分支） ----

    val GRADIENTS: Map<String, List<Long>> = mapOf(
        "安静" to listOf(0x10C0DF, 0x0e8ca3, 0x0a2a33),
        "下午茶" to listOf(0xf3e6d8, 0xdcc4ab, 0xb69173),
        "专注工作" to listOf(0x22324e, 0x18243a, 0x0b1222),
        "睡眠" to listOf(0x0d1d46, 0x081233, 0x030816),
        "钢琴" to listOf(0xe8dcc8, 0xc4b39a, 0x8a7359),
        "赞美诗" to listOf(0xd7c4b0, 0xb89a7a, 0x6e5340),
    )
    fun gradient(album: String): List<Long> = GRADIENTS[album] ?: GRADIENTS.getValue("安静")

    data class Scene(
        /** 只画平铺竖向渐变（睡眠 / 钢琴 / 赞美诗） */
        val flatGradient: Boolean,
        val showCenterOrb: Boolean,
        val centerOrbSway: Boolean,
        val showSideOrbs: Boolean,
        val fish: Boolean,
        val breathRing: Boolean,
        val coffee: Boolean,
        val sleepSky: Boolean,
        val planets: Boolean,
    )

    fun scene(album: String) = Scene(
        flatGradient = album == "睡眠" || album == "钢琴" || album == "赞美诗",
        showCenterOrb = album != "安静" && album != "睡眠" && album != "专注工作",
        centerOrbSway = album == "下午茶",
        showSideOrbs = album != "安静" && album != "专注工作",
        fish = album == "安静",
        breathRing = album == "安静",
        coffee = album == "下午茶",
        sleepSky = album == "睡眠",
        planets = album == "专注工作",
    )

    /** 上半舞台视觉的中心 Y（FOCUS_ORB_CENTER_Y_RATIO） */
    const val FOCUS_CENTER_Y_RATIO = 0.382

    // ---- 光球呼吸（useMusicEnergyGlowBreath） ----

    data class GlowFrame(
        val mainScale: Double, val mainX: Double, val mainY: Double, val mainOpacity: Double,
        val leftScale: Double, val leftX: Double, val leftY: Double, val leftOpacity: Double,
        val rightScale: Double, val rightX: Double, val rightY: Double, val rightOpacity: Double,
        val coreScale: Double, val coreX: Double, val coreXWide: Double, val coreY: Double, val coreOpacity: Double,
    )

    fun glowFrame(tMs: Double): GlowFrame {
        val main = pingPong(tMs, 5400.0, 5400.0, ease = ::easeSilk)
        val left = pingPong(tMs + 0.32 * 13400, 6700.0, 6700.0, ease = ::easeSilk)
        val right = pingPong(tMs + 0.68 * 9600, 4800.0, 4800.0, ease = ::easeSilk)
        val tri = doubleArrayOf(0.0, 0.5, 1.0)
        return GlowFrame(
            mainScale = 0.9 + 0.16 * main, mainX = -10 + 20 * main, mainY = 8 - 16 * main,
            mainOpacity = interpolate(main, tri, doubleArrayOf(0.16, 0.3, 0.16)),
            leftScale = 0.86 + 0.17 * left, leftX = 8 - 16 * left, leftY = -6 + 12 * left,
            leftOpacity = interpolate(left, tri, doubleArrayOf(0.1, 0.24, 0.1)),
            rightScale = 0.88 + 0.16 * right, rightX = -9 + 18 * right, rightY = 7 - 14 * right,
            rightOpacity = interpolate(right, tri, doubleArrayOf(0.11, 0.26, 0.11)),
            coreScale = 0.93 + 0.09 * main, coreX = -4 + 8 * main, coreXWide = -16 + 32 * main, coreY = 4 - 8 * main,
            coreOpacity = interpolate(main, tri, doubleArrayOf(0.06, 0.16, 0.06)),
        )
    }

    // ---- 呼吸环（BreathingRing）：吸 7s · 停 1.8s · 呼 8s · 停 1.8s ----

    data class BreathFrame(val scale: Double, val circleOpacity: Double, val glowOpacity: Double)
    fun breathFrame(tMs: Double): BreathFrame {
        val p = pingPong(tMs, 7000.0, 8000.0, holdTop = 1800.0, holdBottom = 1800.0)
        return BreathFrame(0.62 + 0.84 * p, 0.42 + 0.4 * p, 0.28 + 0.32 * p)
    }

    /** 咖啡杯光晕（SunOrb）：5.2s 往返，0.16…0.34 */
    fun cupGlowOpacity(tMs: Double): Double = 0.16 + 0.18 * pingPong(tMs, 5200.0, 5200.0)

    /** 月亮（SleepCrescentMoon）：7.2s 往返，0.42…0.78 */
    fun moonOpacity(tMs: Double): Double = 0.42 + 0.36 * pingPong(tMs, 7200.0, 7200.0)

    // ---- 鱼群（fishSwarmNativeMotion） ----

    const val FISH_COUNT = 100
    const val ORBIT_PERIOD_MS = 168_000.0
    val ORBIT_HARMONICS = intArrayOf(1, 2, 3, 4, 5, 6, 7, 8, 9)
    const val SHIMMER_PERIOD_MS = 8_400.0
    val SWIM_PERIODS_MS = doubleArrayOf(2600.0, 3120.0, 3640.0, 4160.0, 4680.0, 5200.0)

    data class FishSeed(
        val baseAngleDeg: Double, val radius: Double, val size: Double, val opacity: Double,
        val orbitHarmonic: Int, val shimmerOffset: Double, val swimBucket: Int,
        val swimOffset: Double, val tangentialAmp: Double, val radialAmp: Double, val headingAmp: Double,
    )

    val FISH_SEEDS: List<FishSeed> by lazy {
        val harmonicPeriods = DoubleArray(ORBIT_HARMONICS.size) { ORBIT_PERIOD_MS / ORBIT_HARMONICS[it] }
        List(FISH_COUNT) { i ->
            val d = i.toDouble()
            val ring = (i / 12).toDouble()
            val slot = (i % 12).toDouble()
            val angleJitter = (pseudoRandom01(d * 19 + 7) - 0.5) * 44
            val randomSpeed = 0.45 + pseudoRandom01(d * 41 + 9) * 1.7
            val speedFactor = (0.7 + ring * 0.14) * randomSpeed * 0.58
            val swimPeriodMs = 2600 + pseudoRandom01(d * 73 + 33) * 2600
            FishSeed(
                baseAngleDeg = slot * 30 + angleJitter + ring * 2.5 + pseudoRandom01(d * 67 + 21) * 360,
                radius = 132 + ring * 13.5 + pseudoRandom01(d * 23 + 11) * 20,
                size = 0.55 + pseudoRandom01(d * 31 + 17) * 0.68,
                opacity = 0.34 + pseudoRandom01(d * 37 + 3) * 0.28,
                orbitHarmonic = ORBIT_HARMONICS[nearestIndex(42_000 / max(speedFactor, 0.0001), harmonicPeriods)],
                shimmerOffset = d / FISH_COUNT,
                swimBucket = nearestIndex(swimPeriodMs, SWIM_PERIODS_MS),
                swimOffset = (d * 0.21) % 1,
                tangentialAmp = 1.6 + pseudoRandom01(d * 79 + 27) * 2.2,
                radialAmp = 1.6 + pseudoRandom01(d * 83 + 31) * 3.2,
                headingAmp = 1.2 + pseudoRandom01(d * 89 + 37) * 2.6,
            )
        }
    }

    /** 一条鱼在某一帧：相对漩涡中心的位置（设计稿尺度）、朝向（度）、缩放、透明度 */
    data class FishFrame(val x: Double, val y: Double, val headingDeg: Double, val scale: Double, val opacity: Double)

    fun fishFrame(seed: FishSeed, tMs: Double): FishFrame {
        val orbitDeg = 360 * seed.orbitHarmonic * clock(tMs, ORBIT_PERIOD_MS)
        val swimU = (clock(tMs, SWIM_PERIODS_MS[seed.swimBucket]) + seed.swimOffset) % 1
        val shimU = (clock(tMs, SHIMMER_PERIOD_MS) + seed.shimmerOffset) % 1
        val tx = seed.radius + cos(swimU * TAU) * seed.radialAmp
        val ty = sin(swimU * TAU) * seed.tangentialAmp + triangle(shimU, -2.4, 2.4)
        val heading = 90 + sin(swimU * TAU) * seed.headingAmp
        // RN transform 顺序：轨道组 rotate → rotate(base) → translate(tx, ty) → rotate(heading) → scale
        val a = (orbitDeg + seed.baseAngleDeg) * PI / 180
        return FishFrame(
            x = cos(a) * tx - sin(a) * ty,
            y = sin(a) * tx + cos(a) * ty,
            headingDeg = orbitDeg + seed.baseAngleDeg + heading,
            scale = seed.size,
            opacity = seed.opacity * triangle(shimU, 0.88, 1.0),
        )
    }

    // ---- 咖啡豆（coffeeOrbitLayout / coffeeBeanNodeLayout / useCoffeeBeanNodeMotion） ----

    const val COFFEE_BEAN_COUNT = 34
    const val WHITE_BEAN_INDEX = 0
    val FOLLOWER_BEAN_INDICES = listOf(1, 2, 3)
    const val COFFEE_CUP_ICON_SIZE = 88.0
    const val COFFEE_ORBIT_VISIBLE_PADDING = 4.0
    const val COFFEE_ORBIT_MIN_RADIUS = 34.0

    data class CoffeeOrbitLayout(val cx: Double, val cy: Double, val innerRadius: Double, val outerRadius: Double)

    fun coffeeOrbitLayout(width: Double, height: Double, viewportHeight: Double, viewportTop: Double = 0.0): CoffeeOrbitLayout {
        val cx = width * 0.5
        val cy = viewportHeight * FOCUS_CENTER_Y_RATIO - viewportTop
        val cyOnScreen = viewportTop + cy
        val maxVisible = max(COFFEE_ORBIT_MIN_RADIUS + 16,
            minOf(cx - COFFEE_ORBIT_VISIBLE_PADDING, width - cx - COFFEE_ORBIT_VISIBLE_PADDING,
                  cyOnScreen - COFFEE_ORBIT_VISIBLE_PADDING, viewportHeight - cyOnScreen - COFFEE_ORBIT_VISIBLE_PADDING))
        val cupOuter = COFFEE_CUP_ICON_SIZE * 0.56
        val keepOut = cupOuter + 32
        val desiredInner = keepOut + 8
        val desiredOuter = desiredInner + 880
        val inner = max(COFFEE_ORBIT_MIN_RADIUS, min(desiredInner, maxVisible - 12))
        val outer = max(inner + 12, min(desiredOuter, maxVisible))
        return CoffeeOrbitLayout(cx, cy, inner, outer)
    }

    data class BeanNode(
        val index: Int, val isLeader: Boolean, val isFollower: Boolean, val followIndex: Int, val direction: Double,
        val angle: Double, val radius: Double, val beanW: Double, val beanH: Double,
        val orbitPhaseDeg: Double, val followerBaseDeg: Double, val opacity: Double,
        /** 轨道一圈毫秒（含抖动）；bob 往返的延迟 / 上 / 下毫秒 */
        val orbitMs: Double, val bobDelayMs: Double, val bobUpMs: Double, val bobDownMs: Double,
    )

    fun beanNode(index: Int, layout: CoffeeOrbitLayout): BeanNode {
        val d = index.toDouble()
        val isLeader = index == WHITE_BEAN_INDEX
        val followIndex = FOLLOWER_BEAN_INDICES.indexOf(index)
        val isFollower = followIndex >= 0
        val direction = if (isLeader || isFollower) -1.0 else 1.0
        val ringCount = 10
        val ring = index % ringCount
        val slotsPerRing = ceil(COFFEE_BEAN_COUNT.toDouble() / ringCount).toInt()
        val slot = index / ringCount
        val angleBase = slot * (360.0 / slotsPerRing) + ring * 4.0
        val leaderD = WHITE_BEAN_INDEX.toDouble()
        val leaderAngleBase = (pseudoRandom01(leaderD * 5 + 1) - 0.5) * 8
        val followGap = 10 + pseudoRandom01(d * 71 + 4) * 2
        val angle = if (isFollower) leaderAngleBase + (followIndex + 1) * (followGap * 0.36)
                    else angleBase + (pseudoRandom01(d * 5 + 1) - 0.5) * 4
        val ringRatio = if (ringCount <= 1) 0.0 else ring.toDouble() / (ringCount - 1)
        val radiusBase = layout.innerRadius + (layout.outerRadius - layout.innerRadius) * ringRatio
        val leaderRadius = (layout.outerRadius - 2) + (pseudoRandom01(leaderD * 13 + 3) - 0.5) * 4
        val radius = when {
            isLeader -> leaderRadius
            isFollower -> leaderRadius + followIndex * 2 + (pseudoRandom01(d * 79 + 6) - 0.5) * 2
            else -> radiusBase + pseudoRandom01(d * 13 + 3) * 18
        }
        val beanW = 20 + pseudoRandom01(d * 17 + 9) * 18
        val beanH = beanW * (0.56 + pseudoRandom01(d * 13 + 5) * 0.2)
        val orbitPhaseDeg = pseudoRandom01(d * 61 + 21) * 360
        val leaderOrbitBaseDeg = pseudoRandom01(leaderD * 61 + 21) * 360
        val leaderPhaseLag = if (isFollower) 16 + followIndex * 12.0 else 0.0
        val baseDuration = if (isLeader) 24500.0 else if (isFollower) 27200.0 else 29400.0
        return BeanNode(
            index, isLeader, isFollower, followIndex, direction, angle, radius, beanW, beanH, orbitPhaseDeg,
            followerBaseDeg = leaderOrbitBaseDeg + leaderPhaseLag,
            opacity = if (isLeader) 0.62 else 0.22 + pseudoRandom01(d * 97 + 13) * 0.18,
            orbitMs = baseDuration + floor(pseudoRandom01(d * 31 + 7) * 9000),
            bobDelayMs = 120 + floor(pseudoRandom01(d * 53 + 11) * 1200),
            bobUpMs = 5200 + floor(pseudoRandom01(d * 43 + 5) * 2800),
            bobDownMs = 5200 + floor(pseudoRandom01(d * 47 + 3) * 2800),
        )
    }

    fun beanNodes(layout: CoffeeOrbitLayout): List<BeanNode> = List(COFFEE_BEAN_COUNT) { beanNode(it, layout) }

    /** 一颗豆子在某一帧：中心（相对轨道中心）、总旋转（度）、缩放、透明度 */
    data class BeanFrame(val x: Double, val y: Double, val rotationDeg: Double, val scale: Double, val opacity: Double)

    private val FIVE = doubleArrayOf(0.0, 0.25, 0.5, 0.75, 1.0)
    private val THREE = doubleArrayOf(0.0, 0.5, 1.0)

    fun beanFrame(node: BeanNode, leaderOrbitMs: Double, tMs: Double): BeanFrame {
        val bob = pingPongDelayed(tMs, node.bobDelayMs, node.bobUpMs, node.bobDownMs)
        val orbitClock = clock(tMs, if (node.isFollower) leaderOrbitMs else node.orbitMs)
        val spin = if (node.isFollower) node.followerBaseDeg + node.direction * 360 * orbitClock
                   else node.orbitPhaseDeg + node.direction * 360 * orbitClock
        val bobY = interpolate(bob, FIVE, doubleArrayOf(-14.0, -2.0, 16.0, 3.0, -14.0))
        val swayX = interpolate(bob, FIVE, doubleArrayOf(-6.0, 3.0, 8.0, -2.0, -6.0))
        val floatY = interpolate(bob, FIVE, doubleArrayOf(0.0, -3.0, 4.0, -2.0, 0.0))
        val danceRotate = interpolate(bob, FIVE, doubleArrayOf(-16.0, -4.0, 18.0, 6.0, -16.0))
        val danceScale = interpolate(bob, FIVE, doubleArrayOf(0.86, 0.98, 1.16, 1.02, 0.86))
        val wobble = if (node.isFollower) interpolate(bob, THREE, doubleArrayOf(-3.0, 4.0, -3.0))
                     else interpolate(bob, FIVE, doubleArrayOf(-3.0, -1.0, 4.0, 1.0, -3.0))
        val drift = if (node.isFollower) interpolate(bob, THREE, doubleArrayOf(0.0, 12.0, 0.0))
                    else interpolate(bob, FIVE, doubleArrayOf(0.0, 2.0, 14.0, 6.0, 0.0))
        // RN transform 链：rotate(angle) → rotate(spin) → translateX(radius) → translateX(drift) → rotate(wobble)
        //   → translateX(sway) → translateY(float) → translateY(bob) → rotate(dance) → scale(dance)
        var x = 0.0; var y = 0.0; var heading = 0.0
        fun move(dx: Double, dy: Double) {
            val a = heading * PI / 180
            x += cos(a) * dx - sin(a) * dy
            y += sin(a) * dx + cos(a) * dy
        }
        heading += node.angle; heading += spin; move(node.radius, 0.0); move(drift, 0.0); heading += wobble
        move(swayX, 0.0); move(0.0, floatY); move(0.0, bobY); heading += danceRotate
        return BeanFrame(x, y, heading, danceScale, node.opacity)
    }

    /** 延迟 → 上 → 下 的循环（RN Animated.sequence(delay, timing↑, timing↓) 套 loop） */
    fun pingPongDelayed(tMs: Double, delay: Double, up: Double, down: Double): Double {
        val period = delay + up + down
        var p = tMs % period
        if (p < 0) p += period
        if (p < delay) return 0.0
        p -= delay
        if (p < up) return easeInOutCubic(p / up)
        return 1 - easeInOutCubic((p - up) / down)
    }

    // ---- 星与流星（MusicHomeStarVisual / MusicHomeMeteorVisual） ----

    const val STAR_COUNT = 28
    const val METEOR_COUNT = 4

    data class Star(val x: Double, val y: Double, val size: Double, val trailSpan: Double, val trailTilt: Double, val upMs: Double, val downMs: Double)
    fun star(i: Int, width: Double, height: Double): Star {
        val d = i.toDouble()
        return Star(
            x = width * (0.06 + pseudoRandom01(d * 13 + 1) * 0.88),
            y = height * (0.05 + pseudoRandom01(d * 17 + 2) * 0.5),
            size = 1.5 + pseudoRandom01(d * 23 + 3) * 2.2,
            trailSpan = 1.8 + pseudoRandom01(d * 29 + 5) * 4.2,
            trailTilt = (pseudoRandom01(d * 31 + 7) - 0.5) * 0.8,
            upMs = 2600 + floor(pseudoRandom01(d * 29 + 3) * 3600),
            downMs = 2800 + floor(pseudoRandom01(d * 31 + 7) * 3400),
        )
    }

    data class StarFrame(val opacity: Double, val dx: Double, val dy: Double)
    fun starFrame(s: Star, tMs: Double): StarFrame {
        val v = 0.22 + 0.56 * pingPong(tMs, s.upMs, s.downMs, ease = ::easeInOutQuad)
        val input = doubleArrayOf(0.22, 0.5, 0.78)
        return StarFrame(
            opacity = v,
            dx = interpolate(v, input, doubleArrayOf(-s.trailSpan, 0.0, s.trailSpan)),
            dy = interpolate(v, input, doubleArrayOf(s.trailSpan * (0.24 + s.trailTilt), -s.trailSpan * 0.18, s.trailSpan * (0.24 - s.trailTilt))),
        )
    }

    data class Meteor(val startX: Double, val startY: Double, val driftX: Double, val driftY: Double, val scale: Double, val length: Double, val periodMs: Double)
    fun meteor(i: Int, width: Double, height: Double): Meteor {
        val d = i.toDouble()
        return Meteor(
            startX = width * (0.1 + pseudoRandom01(d * 3 + 1) * 0.74),
            startY = height * (0.03 + pseudoRandom01(d * 5 + 2) * 0.1),
            driftX = -(44 + pseudoRandom01(d * 11 + 3) * 30),
            driftY = 14 + pseudoRandom01(d * 13 + 4) * 20,
            scale = 0.72 + pseudoRandom01(d * 19 + 5) * 0.85,
            length = 22 + pseudoRandom01(d * 23 + 6) * 22,
            periodMs = 15000 + floor(pseudoRandom01(d * 43 + 7) * 9000),
        )
    }

    data class MeteorFrame(val opacity: Double, val dx: Double, val dy: Double)
    fun meteorFrame(m: Meteor, tMs: Double): MeteorFrame {
        val v = clock(tMs, m.periodMs)
        return MeteorFrame(interpolate(v, doubleArrayOf(0.0, 0.1, 0.84, 1.0), doubleArrayOf(0.0, 0.26, 0.22, 0.0)), v * m.driftX, v * m.driftY)
    }

    // ---- 行星（useWorkSpacePlanetMotion） ----

    data class PlanetFrame(val orbitADeg: Double, val orbitBDeg: Double, val mistOuterOpacity: Double, val mistInnerOpacity: Double)
    fun planetFrame(tMs: Double): PlanetFrame {
        val mist = pingPong(tMs, 6800.0, 6800.0)
        return PlanetFrame(360 * clock(tMs, 72000.0), 360 * clock(tMs, 32000.0), 0.1 + 0.14 * mist, 0.26 - 0.14 * mist)
    }
}
