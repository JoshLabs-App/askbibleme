package me.askbible.native_.ui

import androidx.compose.foundation.background
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
    val recent = listOf("创世记 1章", "创世记 3章", "创世记 2章")
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
                    Text(locale.zh("退出登录"), Modifier.fillMaxWidth().padding(top = 8.dp).clickableNoRipple { scope.launch { auth.signOut() } },
                         color = theme.faint.toColor(), fontSize = 13.sp, textAlign = TextAlign.Center,
                         textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline)
                }
                Spacer(Modifier.height(26.dp))

                // 进度线 + 橙点
                Box(Modifier.fillMaxWidth().padding(horizontal = 52.dp), contentAlignment = Alignment.Center) {
                    Box(Modifier.fillMaxWidth().height(3.dp).clip(CircleShape)
                        .background(theme.border.toColor().copy(alpha = 0.8f)))
                    Box(Modifier.size(11.dp).clip(CircleShape).background(theme.parchmentAccent.toColor()))
                }
                Spacer(Modifier.height(22.dp))

                Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Stat("251", "今年已过", theme.parchmentAccent.toColor(), theme, Modifier.weight(1f))
                    Divider(theme)
                    Stat("2", "读经天", Color(0xFF4F7A54), theme, Modifier.weight(1f))
                    Divider(theme)
                    Stat("1", "连续天", Color(0xFF4F7A54), theme, Modifier.weight(1f))
                }
                Spacer(Modifier.height(18.dp))

                Text("使用时长 8 小时 25 分钟", Modifier.fillMaxWidth(),
                     color = theme.muted.toColor(), fontSize = 17.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(6.dp))
                Text("累计听 46 分钟", Modifier.fillMaxWidth(),
                     color = theme.muted.toColor(), fontSize = 17.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(20.dp))
                Text("最近阅读", Modifier.fillMaxWidth(),
                     color = theme.faint.toColor(), fontSize = 15.sp, textAlign = TextAlign.Center)
                Spacer(Modifier.height(8.dp))

                Column(Modifier.padding(horizontal = 26.dp)) {
                    for (r in recent) {
                        Row(Modifier.fillMaxWidth().height(38.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(r, color = theme.ink.toColor(), fontSize = 18.sp, modifier = Modifier.weight(1f))
                            Text("\u203A", color = theme.faint.toColor().copy(alpha = 0.58f), fontSize = 24.sp, lineHeight = 24.sp)
                        }
                    }
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
