package me.askbible.native_.ui

import me.askbible.native_.data.SiteCopy
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.InfoEditionDatabase
import me.askbible.native_.data.InfoEditionFormat
import me.askbible.native_.data.InfoEditionVariant
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadSize

private val LEAD = Color(0xE6784B1E)
private val HINT = Color(0xEB8C5A2A)
private val NAV_INK = Color(0xFF8C5A2A)
private val PAPER = Color(0xFFF2E4CF)

/**
 * 章末「读后两版」入口。对应 RN ReadChapterPostReadingEditions + PostReadingBookPage + ReadChapterInfoEditionBlock，与 iOS 的 PostReadingEditions 对等：
 * 标题「继续阅读与思考」+ 引导语 + 细线；左右两页书脊卡「陪你探索 / 查找资料」；点开后在下方铺出该版正文（纸面卡片），
 * 末尾「返回」；再往下是「上一章 / 回到顶部 / 下一章」。字号随阅读档位 textScale = verseFontSize / 16。
 */
@Composable
fun PostReadingEditions(
    bookId: String,
    chapter: Int,
    size: ReadSize,
    theme: Parchment,
    prev: ChapterNeighbor?,
    next: ChapterNeighbor?,
    active: InfoEditionVariant?,
    /** 用英文那套讲解 / 发现（读英文译本，或界面是英文时） */
    english: Boolean = false,
    onActiveChange: (InfoEditionVariant?) -> Unit,
    onNavigate: (String, Int) -> Unit,
    onBackToTop: () -> Unit,
) {
    val scale = (size.metrics.verseFontSize / 16f).coerceIn(0.8f, 2.8f)
    fun sx(n: Float) = Math.round(n * scale * 10f) / 10f

    Column(Modifier.fillMaxWidth().padding(top = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        // heading（下 20）
        Text(SiteCopy.t("pages.read.postReadingEditionsHeading"), color = theme.ink.toColor(), fontSize = sx(22f).sp, lineHeight = sx(30f).sp,
             fontWeight = FontWeight.SemiBold, letterSpacing = 0.8.sp, textAlign = TextAlign.Center,
             modifier = Modifier.padding(bottom = 10.dp))
        Text(SiteCopy.t("pages.read.postReadingEditionsLead"), color = LEAD, fontSize = sx(13f).sp, lineHeight = sx(21f).sp,
             textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 18.dp).padding(bottom = 10.dp))
        Text(SiteCopy.t("pages.read.postReadingEditionsTapHint"), color = HINT, fontSize = sx(12f).sp, lineHeight = sx(18f).sp, fontWeight = FontWeight.Medium,
             letterSpacing = 0.2.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 8.dp))
        BoxWithConstraints(Modifier.fillMaxWidth().padding(bottom = 20.dp), contentAlignment = Alignment.Center) {
            Box(Modifier.width(minOf(224.dp, maxWidth * 0.56f)).height(0.5.dp).background(Color(0x47483422)))
        }

        // bookSpread：两页各占一半，外圈圆角 12；页面本身透明（羊皮透出）
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)), verticalAlignment = Alignment.Top) {
            Page(InfoEditionVariant.GUIDE, active == InfoEditionVariant.GUIDE, ::sx, Modifier.weight(1f)) { onActiveChange(InfoEditionVariant.GUIDE) }
            Page(InfoEditionVariant.INFO, active == InfoEditionVariant.INFO, ::sx, Modifier.weight(1f)) { onActiveChange(InfoEditionVariant.INFO) }
        }

        if (active != null) {
            EditionBlock(bookId, chapter, active, english, size, theme, ::sx, onBack = { onActiveChange(null) }, onLink = { url ->
                (ArticleLink.resolve(url) as? ArticleLink.Chapter)?.let { onNavigate(it.bookId, it.chapter) }
            })
            // 底部「上一章 / 回到顶部 / 下一章」（上下各 50）
            Row(Modifier.fillMaxWidth().padding(top = 50.dp, bottom = 50.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                    prev?.let { p ->
                        Row(Modifier.clickableNoRipple { onNavigate(p.bookId, p.chapter) }.padding(6.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                            MaterialIcon(MI.CHEVRON_LEFT, 16f, NAV_INK)
                            Text(SiteCopy.t("pages.read.chapterEndNavPrev"), color = Color(0xE08C5A2A), fontSize = 13.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.1.sp)
                        }
                    }
                }
                Text(SiteCopy.t("pages.read.postReadingBackToTop"), color = Color(0xD68C5A2A), fontSize = sx(14f).sp, fontWeight = FontWeight.Medium, letterSpacing = 0.2.sp,
                     modifier = Modifier.clickableNoRipple(onBackToTop).padding(horizontal = 8.dp, vertical = 6.dp))
                Box(Modifier.weight(1f), contentAlignment = Alignment.CenterEnd) {
                    next?.let { n ->
                        Row(Modifier.clickableNoRipple { onNavigate(n.bookId, n.chapter) }.padding(6.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(1.dp)) {
                            Text(SiteCopy.t("pages.read.chapterChromeNext"), color = Color(0xE08C5A2A), fontSize = 13.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.1.sp)
                            MaterialIcon(MI.CHEVRON_RIGHT, 16f, NAV_INK)
                        }
                    }
                }
            }
        }
    }
}

/** PostReadingBookPage：方形插画（stretch，80%）+ 标题 17/600 强调色 + 简介 11 + 「点按打开 ›」/「已选择 ✓」 */
@Composable
private fun Page(variant: InfoEditionVariant, isActive: Boolean, sx: (Float) -> Float, modifier: Modifier, onPress: () -> Unit) {
    val art = rememberAssetImage(if (variant == InfoEditionVariant.GUIDE) "images/post-reading-discover.png" else "images/post-reading-consult.png")
    val title = SiteCopy.t(if (variant == InfoEditionVariant.GUIDE) "pages.read.postReadingEditionGuideTitle" else "pages.read.postReadingEditionInfoTitle")
    val blurb = SiteCopy.t(if (variant == InfoEditionVariant.GUIDE) "pages.read.postReadingEditionGuideBlurb" else "pages.read.postReadingEditionInfoBlurb")
    Column(modifier.clickableNoRipple { if (!isActive) onPress() }, horizontalAlignment = Alignment.CenterHorizontally) {
        if (art != null) {
            Image(art, contentDescription = null, contentScale = ContentScale.FillBounds,
                  modifier = Modifier.fillMaxWidth().aspectRatio(1f).alpha(0.8f))
        } else {
            Box(Modifier.fillMaxWidth().aspectRatio(1f))
        }
        Column(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 4.dp, bottom = 14.dp),
               horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text(title, color = MARKDOWN_ACCENT, fontSize = sx(17f).sp, lineHeight = sx(24f).sp, fontWeight = FontWeight.SemiBold,
                 letterSpacing = 0.6.sp, textAlign = TextAlign.Center)
            Text(blurb, color = Color(0xDB784B1E), fontSize = sx(11f).sp, lineHeight = sx(17f).sp, textAlign = TextAlign.Center,
                 modifier = Modifier.widthIn(max = 168.dp))
            Row(Modifier.padding(top = 2.dp).defaultMinSize(minHeight = 18.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(SiteCopy.t(if (isActive) "pages.read.postReadingEditionSelected" else "pages.read.postReadingEditionTapAction"), color = HINT, fontSize = 11.sp, lineHeight = 16.sp,
                     fontWeight = FontWeight.Medium, letterSpacing = 0.2.sp)
                MaterialIcon(if (isActive) MI.CHECK_CIRCLE else MI.CHEVRON_RIGHT, 14f, if (isActive) Color(0xFF7A633A) else NAV_INK)
            }
        }
    }
}

/**
 * 展开的一版正文。对应 RN ReadChapterInfoEditionBlock：免责声明 → 通屏壳（顶部一道 15dp 的暗影）→
 * 纸面卡片（#F2E4CF、圆角 18、边 rgba(150,112,64,.18)、投影）→ 标题 + Markdown → 「返回」。
 */
@Composable
private fun EditionBlock(
    bookId: String, chapter: Int, variant: InfoEditionVariant, english: Boolean, size: ReadSize, theme: Parchment,
    sx: (Float) -> Float, onBack: () -> Unit, onLink: (String) -> Unit,
) {
    val context = LocalContext.current
    val content = remember(bookId, chapter, variant, english) {
        InfoEditionDatabase.open(context)?.chapter(bookId, chapter, variant, english)?.let { ch ->
            InfoEditionFormat.splitPrimaryHeading(InfoEditionFormat.readerText(ch.markdown, variant))
        }
    }
    val screenH = LocalConfiguration.current.screenHeightDp.dp
    Column(Modifier.fillMaxWidth().padding(top = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(SiteCopy.t("pages.read.infoEditionDisclaimer"), color = theme.muted.toColor(), fontSize = sx(12f).sp, lineHeight = sx(19f).sp,
             textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 320.dp).padding(horizontal = 8.dp).padding(top = 10.dp, bottom = 18.dp))

        // bodyFullscreenShell：通屏（越过章页 20 的内边距），最小高度一屏，顶部一道暗影
        val shape = RoundedCornerShape(18.dp)
        Box(
            Modifier.fillMaxWidth()
                .layout { measurable, constraints ->
                    val extra = 40.dp.roundToPx()
                    val p = measurable.measure(constraints.copy(maxWidth = constraints.maxWidth + extra, minWidth = constraints.maxWidth + extra))
                    layout(constraints.maxWidth, p.height) { p.placeRelative(-extra / 2, 0) }
                }
                .heightIn(min = screenH)
        ) {
            Box(Modifier.fillMaxWidth().height(15.dp).background(Brush.verticalGradient(
                0f to Color(0x7A2A180D), 0.45f to Color(0x4F1D120A), 1f to Color.Transparent)))
            Column(
                Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 14.dp, bottom = 14.dp)
                    .shadow(16.dp, shape, ambientColor = Color(0x38000000), spotColor = Color(0x38000000))
                    .clip(shape).background(PAPER).border(1.dp, Color(0x2E967040), shape)
                    .padding(start = 18.dp, end = 18.dp, top = 20.dp, bottom = 22.dp),
            ) {
                if (content != null) {
                    content.first?.let { h ->
                        // titleStyles：24/700 强调色、行高 36、字距 .5、居中、上 30 下 22
                        Text(h, Modifier.fillMaxWidth().padding(top = sx(30f).dp, bottom = 22.dp), color = MARKDOWN_ACCENT,
                             fontSize = sx(24f).sp, lineHeight = sx(36f).sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp,
                             textAlign = TextAlign.Center)
                    }
                    MarkdownBody(content.second, size, theme, onLink)
                } else {
                    Text(SiteCopy.t("pages.read.infoEditionLoadFailed"), Modifier.fillMaxWidth(), color = theme.muted.toColor(), fontSize = sx(13f).sp,
                         lineHeight = sx(20f).sp, textAlign = TextAlign.Center)
                }
                Box(Modifier.fillMaxWidth().padding(top = 50.dp, bottom = 100.dp), contentAlignment = Alignment.Center) {
                    Text(SiteCopy.t("pages.read.chapterChromeBack"), color = NAV_INK, fontSize = sx(14f).sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.3.sp,
                         modifier = Modifier.clickableNoRipple(onBack).padding(horizontal = 8.dp, vertical = 6.dp))
                }
            }
        }
    }
}
