package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.offset
import me.askbible.native_.data.MemberReadingSyncRules
import me.askbible.native_.data.ReadingActivityStore
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ExploreArticles
import me.askbible.native_.data.ExploreArticle
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.remember
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.MeetingRoom
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.QuestionAnswer
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material.icons.filled.VolunteerActivism
import androidx.compose.material.icons.filled.WavingHand
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import me.askbible.native_.data.Brand
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.layout.RowScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.MemberAuthRules
import me.askbible.native_.data.MemberAuthStore
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ShellMetrics

/** 探索页：统计 → 使用时长 → 最近阅读 → 查经资料格子。与 iOS 的 ExploreView 对等。 */
@Composable
fun ExploreScreen(
    size: ReadSize = ReadSize.DEFAULT,
    /** 当前打开的文章（宿主持有，系统返回键要能关） */
    article: ExploreArticle? = null,
    onOpenArticle: (ExploreArticle?) -> Unit = {},
    /** 文章里的经文链接 → 读经 Tab 打开那一章 */
    onOpenChapter: (bookId: String, chapter: Int) -> Unit = { _, _ -> },
    /** 会员状态：抬头「请登录，解锁更多」→ 登录页；登录后「你好，名字」→ 改称呼 */
    auth: MemberAuthStore? = null,
    locale: AppLocale = AppLocale.ZH_CN,
    onOpenLogin: () -> Unit = {},
    /** 读经活动：今年已过 / 读经天 / 连续天 / 使用时长 / 累计听 / 最近阅读（RN ExploreReadingHabitStats） */
    activity: ReadingActivityStore? = null,
    /** 退出登录（先把本机进度推上云端再清本机，由壳接线） */
    onSignOut: () -> Unit = {},
    /** 界面语言手动设置（null = 跟随系统）；原生版新增，RN 只跟系统 */
    localeOverride: AppLocale? = null,
    onSetLocale: (AppLocale?) -> Unit = {},
    theme: Parchment = Parchment.light,
) {
    if (article != null) {
        ExploreArticleScreen(article, size, onBack = { onOpenArticle(null) }, onOpenChapter = onOpenChapter,
                             onOpenArticle = onOpenArticle, theme = theme)
        return
    }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var nameEditorOpen by remember { mutableStateOf(false) }
    var nameDraft by remember { mutableStateOf("") }
    val recent = activity?.recent ?: emptyList()
    // 原生界面文案目前只有中文（locale.zh 只管简繁），统计行也跟着走，别混进英文（Josh 2026-09-09：中英文混一起）
    val isEn = false
    val tl = remember { MemberReadingSyncRules.yearTimeline() }
    val completedDates = activity?.completedDates ?: emptyList()
    val ranges = remember(completedDates) { val d = java.time.LocalDate.now(); MemberReadingSyncRules.yearReadRanges(completedDates, d.year, d.monthValue, d.dayOfMonth) }
    val usageLine = "${if (isEn) "Time in app" else locale.zh("使用时长")}  ${MemberReadingSyncRules.formatUsageDuration((activity?.usageTotalSec ?: 0.0).toInt(), isEn)}"
    val listenDuration = MemberReadingSyncRules.formatListenDuration((activity?.listenTotalSec ?: 0.0).toInt(), isEn)
    val listenLine = if (isEn) "Listened $listenDuration" else locale.zh("累计听 ") + listenDuration
    val articles = remember { ExploreArticles.grid(context) }

    // RN ExploreGreetingNameModal：改称呼（最多 24 字）
    if (nameEditorOpen && auth != null) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { nameEditorOpen = false },
            title = { Text(locale.zh("修改称呼")) },
            text = {
                androidx.compose.material3.OutlinedTextField(value = nameDraft, onValueChange = { nameDraft = it }, singleLine = true,
                    placeholder = { Text(locale.zh("你的名字")) })
            },
            confirmButton = {
                androidx.compose.material3.TextButton(enabled = MemberAuthRules.isValidDisplayName(nameDraft),
                    onClick = { val n = nameDraft; nameEditorOpen = false; scope.launch { auth.updateDisplayName(n) } }) { Text(locale.zh("保存")) }
            },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { nameEditorOpen = false }) { Text(locale.zh("取消")) } },
        )
    }
    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)

        val insets = WindowInsets.systemBars.asPaddingValues()
        LazyColumn(
            Modifier.fillMaxSize().parchmentFade(ParchmentFadePreset.TABBAR),
            contentPadding = PaddingValues(top = 37.dp + insets.calculateTopPadding(),
                                           bottom = TAB_BAR_CLEARANCE.dp + insets.calculateBottomPadding() + 120.dp + 120.dp),
        ) {
            item {
                // RN ExploreScreen 抬头：没登录点了去登录页；登录了显示「你好，名字」，点了改称呼
                val user = auth?.user
                Text(locale.zh(MemberAuthRules.greeting(user)),
                     Modifier.fillMaxWidth().clickableNoRipple { if (user != null) { nameDraft = user.name; nameEditorOpen = true } else onOpenLogin() },
                     color = theme.ink.toColor(), fontSize = 25.sp,
                     fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, maxLines = 1)
                if (user != null) {
                    // RN 的「退出登录」在侧边抽屉里；原生版还没有抽屉，先放在抬头下面
                    Text(locale.zh("退出登录"), Modifier.fillMaxWidth().padding(top = 8.dp).clickableNoRipple { onSignOut() },
                         color = theme.faint.toColor(), fontSize = 13.sp, textAlign = TextAlign.Center,
                         textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline)
                }
                Spacer(Modifier.height(26.dp))

                // RN ReadYearDayTimeline：淡底轨 + 实色已读区段 + 今日橙点
                BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = 52.dp).height(22.dp), contentAlignment = Alignment.CenterStart) {
                    val w = maxWidth
                    Box(Modifier.fillMaxWidth().height(3.dp).clip(CircleShape).background(theme.border.toColor().copy(alpha = 0.8f)))
                    val minW = 2.0 / maxOf(tl.daysInYear, 1)
                    for ((start, end) in ranges) {
                        val (left, width) = MemberReadingSyncRules.rangeToTrackFraction(start, end, tl.daysInYear)
                        val drawW = maxOf(width, minW)
                        val drawLeft = minOf(left, maxOf(0.0, 1 - drawW))
                        Box(Modifier.offset(x = w * drawLeft.toFloat()).width(w * drawW.toFloat()).height(5.dp).clip(CircleShape).background(Color(0xFFE8A017)))
                    }
                    Box(Modifier.offset(x = w * tl.progress.toFloat() - 5.5.dp).size(11.dp).clip(CircleShape).background(theme.parchmentAccent.toColor()))
                }
                Spacer(Modifier.height(22.dp))

                Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Stat(tl.dayOfYear.toString(), "今年已过", theme.parchmentAccent.toColor(), theme, Modifier.weight(1f))
                    Divider(theme)
                    Stat((activity?.readDays ?: 0).toString(), "读经天", Color(0xFF4F7A54), theme, Modifier.weight(1f))
                    Divider(theme)
                    Stat((activity?.streakDays ?: 0).toString(), "连续天", Color(0xFF4F7A54), theme, Modifier.weight(1f))
                }
                Spacer(Modifier.height(18.dp))

                Text(usageLine, Modifier.fillMaxWidth(),
                     color = theme.muted.toColor(), fontSize = 17.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(6.dp))
                Text(listenLine, Modifier.fillMaxWidth(),
                     color = theme.muted.toColor(), fontSize = 17.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(20.dp))
                Text("最近阅读", Modifier.fillMaxWidth(),
                     color = theme.faint.toColor(), fontSize = 15.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(8.dp))

                Column(Modifier.padding(horizontal = 26.dp)) {
                    for (r in recent) {
                        val label = if (isEn) "${r.bookName} ${r.chapter}" else "${locale.zh(r.bookName)} ${r.chapter}${locale.zh("章")}"
                        Row(Modifier.fillMaxWidth().height(38.dp).clickableNoRipple { onOpenChapter(r.bookId, r.chapter) }, verticalAlignment = Alignment.CenterVertically) {
                            Text(label, color = theme.ink.toColor(), fontSize = 18.sp, modifier = Modifier.weight(1f))
                            Text("\u203A", color = theme.faint.toColor().copy(alpha = 0.58f), fontSize = 24.sp, lineHeight = 24.sp)
                        }
                    }
                    if (recent.isEmpty()) {
                        Text(locale.zh("还没有阅读记录"), Modifier.fillMaxWidth().height(38.dp), color = theme.faint.toColor(), fontSize = 15.sp, textAlign = TextAlign.Center)
                    }
                }
                // 界面语言（原生版新增）：跟随系统 / 简体 / 繁體 / English，样式同计划详情的单选格
                Spacer(Modifier.height(28.dp))
                Text(locale.zh("语言"), Modifier.fillMaxWidth(), color = theme.faint.toColor(), fontSize = 15.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth().padding(horizontal = 26.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    LanguageChip(locale.zh("跟随系统"), localeOverride == null, theme) { onSetLocale(null) }
                    for (l in listOf(AppLocale.ZH_CN, AppLocale.ZH_TW, AppLocale.EN)) LanguageChip(l.settingLabel, localeOverride == l, theme) { onSetLocale(l) }
                }
                // 九宫格功能块（欢迎 / 读经计划 / 圣经人物…）按 Josh 的决定只留网站，App 暂不放（2026-09-09）
                // 查经资料：RN 探索格子里的精选文章（section 上 36 + 8，格子上 16 + 8，3 列 gap 10）
                Spacer(Modifier.height((36 + 8 + 16 + 8).dp))
                BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = 22.dp)) {
                    val cols = 3
                    val gap = 10.dp
                    val gridWidth = minOf(maxWidth + 44.dp, 448.dp) - 44.dp
                    val tileW = (gridWidth - gap * (cols - 1)) / cols
                    Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                        for (row in articles.chunked(cols)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(gap), verticalAlignment = Alignment.Top) {
                                for (a in row) {
                                    // RN renderArticleTile：64 圆角 18 的浅底圈 + MaterialCommunityIcons 28 ink + 12/600 两行标签
                                    Column(Modifier.width(tileW).clickableNoRipple { onOpenArticle(a) },
                                           horizontalAlignment = Alignment.CenterHorizontally,
                                           verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Box(Modifier.size(64.dp).clip(RoundedCornerShape(18.dp)).background(Color(0x8CFFFCF5))
                                                .border(0.5.dp, theme.border.toColor(), RoundedCornerShape(18.dp)),
                                            contentAlignment = Alignment.Center) {
                                            MaterialIcon(a.icon, 28f, theme.ink.toColor(), community = true)
                                        }
                                        Text(a.exploreLabel, Modifier.fillMaxWidth(), color = theme.ink.toColor(), fontSize = 12.sp,
                                             lineHeight = 15.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, maxLines = 2)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Stat(value: String, label: String, color: Color, theme: Parchment, modifier: Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally,
           verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(value, color = color, fontSize = 34.sp, fontWeight = FontWeight.Bold)
        Text(label, color = theme.muted.toColor(), fontSize = 15.sp)
    }
}

@Composable
private fun Divider(theme: Parchment) {
    Box(Modifier.width(1.dp).height(56.dp).background(theme.border.toColor().copy(alpha = 0.8f)))
}

@Composable
private fun RowScope.LanguageChip(label: String, on: Boolean, theme: Parchment, onClick: () -> Unit) {
    Box(
        Modifier.weight(1f).clip(RoundedCornerShape(12.dp))
            .background(if (on) Brand.logo.toColor().copy(alpha = 0.28f) else theme.surface.toColor().copy(alpha = 0.6f))
            .border(if (on) 1.5.dp else 0.5.dp, if (on) Brand.logo.toColor() else theme.border.toColor(), RoundedCornerShape(12.dp))
            .clickableNoRipple(onClick).padding(vertical = 10.dp, horizontal = 4.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = theme.ink.toColor(), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1,
             overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
    }
}
