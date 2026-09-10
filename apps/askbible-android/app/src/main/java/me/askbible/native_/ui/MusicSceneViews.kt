package me.askbible.native_.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.clipRect
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import me.askbible.native_.data.MusicVisuals
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * 音乐页专辑舞台（RN MusicHomeBackdrop + MusicHomeUpperDecor）：整屏「渐变 + 光球」底，再叠该专辑自己的动画层：
 * 安静 = 鱼群漩涡 + 呼吸环；下午茶 = 咖啡杯 + 咖啡豆环；睡眠 = 星 + 流星 + 月亮；专注工作 = 行星；钢琴 / 赞美诗 = 只有渐变。
 * `active` = 音乐在播（RN albumDecorMotionActive）；停下时画面定格，不空转。与 iOS MusicSceneViews 同构，全部在一个 Canvas 里画。
 */
@Composable
fun MusicAlbumStage(album: String, active: Boolean, modifier: Modifier = Modifier) {
    val fish = rememberAssetImage("fish.png")
    val bean = rememberAssetImage("coffee-bean-shape.png")
    val moon = rememberAssetImage("sleep-crescent-moon.png")
    val cupGlyph = rememberMaterialGlyphBitmap(MI.LOCAL_CAFE, MusicVisuals.COFFEE_CUP_ICON_SIZE.toFloat(), Color(0xFFFFF7EF))
    // 舞台时钟：只在播放时走帧；停播定格
    var tMs by remember { mutableDoubleStateOf(0.0) }
    LaunchedEffect(active) {
        if (!active) return@LaunchedEffect
        val base = tMs
        var startFrame = -1L
        while (true) {
            withFrameMillis { now ->
                if (startFrame < 0) startFrame = now
                tMs = base + (now - startFrame).toDouble()
            }
        }
    }
    val scene = MusicVisuals.scene(album)
    Canvas(modifier.fillMaxSize()) {
        val d = density
        drawGlowBackdrop(album, scene, tMs)
        if (scene.fish) drawFishSwarm(fish, tMs, d)
        if (scene.breathRing) drawBreathingRing(tMs, d)
        if (scene.coffee) drawCoffeeScene(bean, cupGlyph, tMs, d)
        if (scene.sleepSky) drawSleepSky(moon, tMs, d)
        if (scene.planets) drawWorkPlanets(tMs, d)
    }
}

private fun argb(hex: Long): Color = Color(0xFF000000L or hex)
private fun rgba(r: Int, g: Int, b: Int, a: Double): Color = Color(r, g, b, (a * 255).roundToInt().coerceIn(0, 255))

/** 柔光圆：径向渐变代替 RN 的 shadowRadius（Compose Canvas 没有便宜的模糊） */
private fun DrawScope.glowCircle(center: Offset, radius: Float, color: Color, alpha: Float, glowScale: Float = 1.6f) {
    drawCircle(
        brush = Brush.radialGradient(0f to color, 0.55f to color.copy(alpha = color.alpha * 0.55f), 1f to color.copy(alpha = 0f),
                                     center = center, radius = radius * glowScale),
        radius = radius * glowScale, center = center, alpha = alpha,
    )
}

/** 渐变 + 三个呼吸光球（RN MusicEnergyGlow / MusicEnergyGlowOrbs / useMusicEnergyGlowBreath） */
private fun DrawScope.drawGlowBackdrop(album: String, scene: MusicVisuals.Scene, tMs: Double) {
    val g = MusicVisuals.gradient(album)
    val c0 = argb(g[0]); val c1 = argb(g[1]); val c2 = argb(g[2])
    val w = size.width; val h = size.height
    if (scene.flatGradient) {
        drawRect(Brush.verticalGradient(0f to c0, 0.58f to c1, 1f to c2, startY = 0f, endY = h))
        return
    }
    drawRect(Brush.linearGradient(0f to c0, 0.35f to c1, 0.7f to c2, 1f to argb(0x0a0908),
                                  start = Offset(w * 0.15f, 0f), end = Offset(w * 0.85f, h)))
    val span = max(w, h)
    val orbMain = span * 0.92f; val orbSide = span * 0.55f; val core = span * 0.22f
    val cx = w * 0.5f; val cy = h * 0.34f
    val f = MusicVisuals.glowFrame(tMs)
    drawCircle(c0, radius = orbMain / 2 * f.mainScale.toFloat(), center = Offset(cx + f.mainX.toFloat(), cy + f.mainY.toFloat()), alpha = f.mainOpacity.toFloat())
    if (scene.showSideOrbs) {
        drawCircle(c1, radius = orbSide / 2 * f.leftScale.toFloat(),
                   center = Offset(w * 0.08f - orbSide * 0.2f + orbSide / 2 + f.leftX.toFloat(), h * 0.18f + orbSide / 2 + f.leftY.toFloat()),
                   alpha = f.leftOpacity.toFloat())
        val rs = orbSide * 0.85f
        drawCircle(c2, radius = rs / 2 * f.rightScale.toFloat(),
                   center = Offset(w - (w * 0.02f - orbSide * 0.15f) - rs / 2 + f.rightX.toFloat(), h * 0.42f + rs / 2 + f.rightY.toFloat()),
                   alpha = f.rightOpacity.toFloat())
    }
    if (scene.showCenterOrb) {
        drawCircle(rgba(251, 230, 180, 0.85), radius = core / 2 * f.coreScale.toFloat(),
                   center = Offset(cx + (if (scene.centerOrbSway) f.coreXWide else f.coreX).toFloat(), cy + (if (scene.centerOrbSway) 0.0 else f.coreY).toFloat()),
                   alpha = f.coreOpacity.toFloat())
    }
}

/** 鱼群漩涡（RN SlowFish + fishSwarmNativeMotion）：100 条鱼，9 组谐波轨道，摆尾 + 闪烁 */
private fun DrawScope.drawFishSwarm(fish: ImageBitmap?, tMs: Double, d: Float) {
    fish ?: return
    val cx = size.width * 0.5f; val cy = size.height * MusicVisuals.FOCUS_CENTER_Y_RATIO.toFloat()
    val tint = ColorFilter.tint(Color.White.copy(alpha = 0.95f))
    // RN fishSprite：40×14 dp 的框，resizeMode="contain"——fish-shape.png 是 300×54，按宽 40 等比缩成 40×7.2 居中，
    // 不能拉满 14 高（拉满就成了胖鱼，Josh 2026-09-09：「没有用我之前画的那个小鱼」）
    val k = minOf(40f * d / fish.width, 14f * d / fish.height)
    val spriteW = (fish.width * k).roundToInt(); val spriteH = (fish.height * k).roundToInt()
    for (seed in MusicVisuals.FISH_SEEDS) {
        val f = MusicVisuals.fishFrame(seed, tMs)
        translate(cx + f.x.toFloat() * d, cy + f.y.toFloat() * d) {
            rotate(f.headingDeg.toFloat(), pivot = Offset.Zero) {
                scale(f.scale.toFloat(), f.scale.toFloat(), pivot = Offset.Zero) {
                    drawImage(fish, dstOffset = IntOffset(-spriteW / 2, -spriteH / 2), dstSize = IntSize(spriteW, spriteH),
                              alpha = f.opacity.toFloat(), colorFilter = tint)
                }
            }
        }
    }
}

/** 呼吸环（RN BreathingRing）：吸 7s · 停 · 呼 8s，圆 154 + 外晕 182 */
private fun DrawScope.drawBreathingRing(tMs: Double, d: Float) {
    val f = MusicVisuals.breathFrame(tMs)
    val c = Offset(size.width * 0.5f, size.height * MusicVisuals.FOCUS_CENTER_Y_RATIO.toFloat())
    val s = f.scale.toFloat()
    glowCircle(c, 91 * d * s, rgba(217, 229, 243, 0.34), f.glowOpacity.toFloat(), glowScale = 1.5f)
    glowCircle(c, 77 * d * s, rgba(233, 236, 242, 0.62), f.circleOpacity.toFloat(), glowScale = 1.35f)
    drawCircle(rgba(233, 236, 242, 0.62), radius = 77 * d * s, center = c, alpha = f.circleOpacity.toFloat())
}

/** 下午茶（RN SunOrb + CoffeeBeanOrbit）：咖啡杯 + 呼吸光晕，34 颗豆子绕圈跳舞（首颗白豆带三颗跟随） */
private fun DrawScope.drawCoffeeScene(bean: ImageBitmap?, cup: ImageBitmap?, tMs: Double, d: Float) {
    val w = size.width / d; val h = size.height / d
    val layout = MusicVisuals.coffeeOrbitLayout(w.toDouble(), h.toDouble(), h.toDouble())
    val nodes = MusicVisuals.beanNodes(layout)
    val leaderOrbitMs = nodes[MusicVisuals.WHITE_BEAN_INDEX].orbitMs
    val cx = layout.cx.toFloat() * d; val cy = layout.cy.toFloat() * d
    if (bean != null) {
        val dark = ColorFilter.tint(Color(0xFF4B2F1B)); val light = ColorFilter.tint(Color(0xFFFFFCF5))
        for (node in nodes) {
            val f = MusicVisuals.beanFrame(node, leaderOrbitMs, tMs)
            val bw = (node.beanW * d).roundToInt(); val bh = (node.beanH * d).roundToInt()
            translate(cx + f.x.toFloat() * d, cy + f.y.toFloat() * d) {
                rotate(f.rotationDeg.toFloat(), pivot = Offset.Zero) {
                    scale(f.scale.toFloat(), f.scale.toFloat(), pivot = Offset.Zero) {
                        drawImage(bean, dstOffset = IntOffset(-bw / 2, -bh / 2), dstSize = IntSize(bw, bh),
                                  alpha = f.opacity.toFloat(), colorFilter = if (node.isLeader) light else dark)
                    }
                }
            }
        }
    }
    val c = Offset(cx, cy)
    glowCircle(c, 49 * d, rgba(255, 245, 232, 0.28), MusicVisuals.cupGlowOpacity(tMs).toFloat(), glowScale = 1.7f)
    if (cup != null) {
        drawImage(cup, dstOffset = IntOffset((cx - cup.width / 2f).roundToInt(), (cy - cup.height / 2f).roundToInt()))
    }
}

/** 睡眠（RN SlowStars + SlowMeteors + SleepCrescentMoon） */
private fun DrawScope.drawSleepSky(moon: ImageBitmap?, tMs: Double, d: Float) {
    val w = size.width / d; val h = size.height / d
    for (i in 0 until MusicVisuals.STAR_COUNT) {
        val s = MusicVisuals.star(i, w.toDouble(), h.toDouble())
        val f = MusicVisuals.starFrame(s, tMs)
        val c = Offset(((s.x + f.dx) * d).toFloat(), ((s.y + f.dy) * d).toFloat())
        val r = (s.size / 2 * d).toFloat()
        drawCircle(argb(0xe5f2ff), radius = r * 2.2f, center = c, alpha = f.opacity.toFloat() * 0.3f)
        drawCircle(rgba(241, 248, 255, 0.95), radius = r, center = c, alpha = f.opacity.toFloat())
    }
    // 流星：只在上方 34% 的天空层
    clipRect(0f, 0f, size.width, size.height * 0.34f) {
        for (i in 0 until MusicVisuals.METEOR_COUNT) {
            val m = MusicVisuals.meteor(i, w.toDouble(), h.toDouble())
            val f = MusicVisuals.meteorFrame(m, tMs)
            val len = (m.length * d).toFloat()
            translate(((m.startX + f.dx) * d).toFloat() + len / 2, ((m.startY + f.dy) * d).toFloat() + d) {
                rotate(-32f, pivot = Offset.Zero) {
                    scale(m.scale.toFloat(), m.scale.toFloat(), pivot = Offset.Zero) {
                        drawRoundRect(argb(0xdbeeff), topLeft = Offset(-len / 2 - 2 * d, -4 * d), size = Size(len + 4 * d, 8 * d),
                                      cornerRadius = androidx.compose.ui.geometry.CornerRadius(4 * d), alpha = f.opacity.toFloat() * 0.35f)
                        drawRoundRect(rgba(229, 243, 255, 0.82), topLeft = Offset(-len / 2, -d), size = Size(len, 2 * d),
                                      cornerRadius = androidx.compose.ui.geometry.CornerRadius(d), alpha = f.opacity.toFloat())
                    }
                }
            }
        }
    }
    if (moon != null) {
        // RN 月亮住在上半舞台底部（贴着曲名上方），比其它场景的焦点略低
        val mw = (86 * d).roundToInt()
        drawImage(moon, dstOffset = IntOffset((size.width / 2 - mw / 2).roundToInt(), (size.height * 0.44f - mw / 2).roundToInt()),
                  dstSize = IntSize(mw, mw), alpha = MusicVisuals.moonOpacity(tMs).toFloat(),
                  colorFilter = ColorFilter.tint(rgba(229, 242, 255, 0.98)))
    }
}

/** 专注工作（RN WorkSpacePlanets）：核心雾 + 大球 + 两颗绕行的行星 */
private fun DrawScope.drawWorkPlanets(tMs: Double, d: Float) {
    val f = MusicVisuals.planetFrame(tMs)
    val c = Offset(size.width * 0.5f, size.height * MusicVisuals.FOCUS_CENTER_Y_RATIO.toFloat())
    val a = ((f.orbitADeg + 18) * Math.PI / 180).toFloat()
    val b = ((f.orbitBDeg - 142) * Math.PI / 180).toFloat()
    drawCircle(rgba(164, 188, 226, 0.14), radius = 146 * d, center = c, alpha = f.mistOuterOpacity.toFloat())
    drawCircle(rgba(176, 201, 236, 0.18), radius = 118 * d, center = c, alpha = f.mistInnerOpacity.toFloat())
    glowCircle(c, 88 * d, argb(0x9fb8e8), 0.5f, glowScale = 1.35f)
    drawCircle(rgba(160, 182, 222, 0.34), radius = 88 * d, center = c)
    val pa = Offset(c.x + cos(a) * 176 * d, c.y + sin(a) * 176 * d)
    glowCircle(pa, 28 * d, argb(0x89a9dd), 0.44f, glowScale = 1.7f)
    drawCircle(rgba(124, 150, 198, 0.26), radius = 28 * d, center = pa)
    val pb = Offset(c.x + cos(b) * 152 * d, c.y + sin(b) * 152 * d)
    glowCircle(pb, 21 * d, argb(0xbdd3f5), 0.48f, glowScale = 1.7f)
    drawCircle(rgba(193, 214, 245, 0.3), radius = 21 * d, center = pb)
}

/** 把一个 Material 字形画成位图，供 Canvas 直接贴（咖啡杯） */
@Composable
private fun rememberMaterialGlyphBitmap(glyph: String, sizeDp: Float, color: Color): ImageBitmap? {
    val context = androidx.compose.ui.platform.LocalContext.current
    val density = androidx.compose.ui.platform.LocalDensity.current.density
    return remember(glyph, sizeDp, color) {
        val px = (sizeDp * density).roundToInt()
        val typeface = try { android.graphics.Typeface.createFromAsset(context.assets, "fonts/MaterialIcons.ttf") } catch (_: Exception) { return@remember null }
        val bmp = android.graphics.Bitmap.createBitmap(px, px, android.graphics.Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bmp)
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            this.typeface = typeface; textSize = px.toFloat(); this.color = android.graphics.Color.argb(
                (color.alpha * 255).roundToInt(), (color.red * 255).roundToInt(), (color.green * 255).roundToInt(), (color.blue * 255).roundToInt())
            textAlign = android.graphics.Paint.Align.CENTER
            setShadowLayer(10 * density, 0f, 0f, android.graphics.Color.argb(128, 255, 245, 232))
        }
        val fm = paint.fontMetrics
        canvas.drawText(glyph, px / 2f, px / 2f - (fm.ascent + fm.descent) / 2f, paint)
        bmp.asImageBitmap()
    }
}
