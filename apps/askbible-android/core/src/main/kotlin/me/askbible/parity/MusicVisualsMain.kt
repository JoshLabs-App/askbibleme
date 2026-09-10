package me.askbible.parity

import me.askbible.native_.data.MusicVisuals
import java.util.Locale

/** 音乐页动画参数对拍 harness（core --musicvis），协议与 Swift 侧相同；数值统一保留 4 位小数 */
fun musicVisualsMain() {
    val lines = generateSequence(::readLine).toList()
    fun n(v: Double) = String.format(Locale.US, "%.4f", v)
    val out = ArrayList<String>()
    for (line in lines) {
        val f = line.split("\t")
        out.add(when (f[0]) {
            "prand" -> n(MusicVisuals.pseudoRandom01(f[1].toDouble()))
            "scene" -> {
                val s = MusicVisuals.scene(f[1])
                listOf(s.flatGradient, s.showCenterOrb, s.centerOrbSway, s.showSideOrbs, s.fish, s.breathRing, s.coffee, s.sleepSky, s.planets).joinToString("") { if (it) "1" else "0" } +
                    "|" + MusicVisuals.gradient(f[1]).joinToString(",") { String.format(Locale.US, "%06x", it) }
            }
            "fishseed" -> { val s = MusicVisuals.FISH_SEEDS[f[1].toInt()]
                listOf(n(s.baseAngleDeg), n(s.radius), n(s.size), n(s.opacity), "${s.orbitHarmonic}", n(s.shimmerOffset), "${s.swimBucket}", n(s.swimOffset), n(s.tangentialAmp), n(s.radialAmp), n(s.headingAmp)).joinToString(",") }
            "fishframe" -> { val r = MusicVisuals.fishFrame(MusicVisuals.FISH_SEEDS[f[1].toInt()], f[2].toDouble()); listOf(r.x, r.y, r.headingDeg, r.scale, r.opacity).joinToString(",") { n(it) } }
            "orbit" -> { val l = MusicVisuals.coffeeOrbitLayout(f[1].toDouble(), f[2].toDouble(), f[3].toDouble(), f[4].toDouble()); listOf(l.cx, l.cy, l.innerRadius, l.outerRadius).joinToString(",") { n(it) } }
            "bean" -> {
                val l = MusicVisuals.coffeeOrbitLayout(f[2].toDouble(), f[3].toDouble(), f[3].toDouble())
                val b = MusicVisuals.beanNode(f[1].toInt(), l)
                listOf(if (b.isLeader) "L" else if (b.isFollower) "F${b.followIndex}" else "-", n(b.direction), n(b.angle), n(b.radius), n(b.beanW), n(b.beanH), n(b.orbitPhaseDeg), n(b.followerBaseDeg), n(b.opacity), n(b.orbitMs), n(b.bobDelayMs), n(b.bobUpMs), n(b.bobDownMs)).joinToString(",")
            }
            "beanframe" -> {
                val l = MusicVisuals.coffeeOrbitLayout(f[2].toDouble(), f[3].toDouble(), f[3].toDouble())
                val nodes = MusicVisuals.beanNodes(l)
                val r = MusicVisuals.beanFrame(nodes[f[1].toInt()], nodes[0].orbitMs, f[4].toDouble())
                listOf(r.x, r.y, r.rotationDeg, r.scale, r.opacity).joinToString(",") { n(it) }
            }
            "star" -> { val s = MusicVisuals.star(f[1].toInt(), f[2].toDouble(), f[3].toDouble()); val r = MusicVisuals.starFrame(s, f[4].toDouble())
                listOf(s.x, s.y, s.size, s.trailSpan, s.trailTilt, s.upMs, s.downMs, r.opacity, r.dx, r.dy).joinToString(",") { n(it) } }
            "meteor" -> { val m = MusicVisuals.meteor(f[1].toInt(), f[2].toDouble(), f[3].toDouble()); val r = MusicVisuals.meteorFrame(m, f[4].toDouble())
                listOf(m.startX, m.startY, m.driftX, m.driftY, m.scale, m.length, m.periodMs, r.opacity, r.dx, r.dy).joinToString(",") { n(it) } }
            "glow" -> { val g = MusicVisuals.glowFrame(f[1].toDouble())
                listOf(g.mainScale, g.mainX, g.mainY, g.mainOpacity, g.leftScale, g.leftOpacity, g.rightScale, g.rightOpacity, g.coreScale, g.coreXWide, g.coreOpacity).joinToString(",") { n(it) } }
            "breath" -> { val t = f[1].toDouble(); val b = MusicVisuals.breathFrame(t)
                listOf(b.scale, b.circleOpacity, b.glowOpacity, MusicVisuals.cupGlowOpacity(t), MusicVisuals.moonOpacity(t)).joinToString(",") { n(it) } }
            "planet" -> { val p = MusicVisuals.planetFrame(f[1].toDouble()); listOf(p.orbitADeg, p.orbitBDeg, p.mistOuterOpacity, p.mistInnerOpacity).joinToString(",") { n(it) } }
            else -> "?"
        })
    }
    println("[" + out.joinToString(",") { jsonString(it) } + "]")
}
