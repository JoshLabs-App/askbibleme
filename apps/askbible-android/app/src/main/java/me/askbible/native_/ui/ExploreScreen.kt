package me.askbible.native_.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import me.askbible.native_.data.AchievementStore
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.BibleCatalog
import me.askbible.native_.data.ExploreArticle
import me.askbible.native_.data.MemberAuthRules
import me.askbible.native_.data.MemberAuthStore
import me.askbible.native_.data.MemberUser
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.ReadSize
import me.askbible.native_.data.ReadingActivityStore
import me.askbible.native_.data.SiteCopy
import me.askbible.native_.data.VerseBookmark
import me.askbible.native_.data.VerseBookmarkStore
import me.askbible.native_.data.VerseHighlightStore
import me.askbible.native_.data.name

/**
 * 私人读经书房（对齐 iOS ExploreView）：
 * - 温润问候语「平安，旅人 / 名字」+ 右上偏好设置齿轮（唤起底部三分组偏好抽屉）
 * - 去游戏化「手抄本藏书票与书卷火漆印」卡片（点击进入 66 卷印鉴墙）
 * - 四色「摘录与印记」统一模块（支持筛选、书签图分享与撤销）
 * - 最近阅读轨迹卡片 + 同系列软件入口
 */
@Composable
fun ExploreScreen(
    size: ReadSize = ReadSize.DEFAULT,
    article: ExploreArticle? = null,
    onOpenArticle: (ExploreArticle?) -> Unit = {},
    onOpenChapter: (bookId: String, chapter: Int) -> Unit = { _, _ -> },
    favorites: List<VerseBookmark> = emptyList(),
    bookmarks: VerseBookmarkStore? = null,
    highlights: VerseHighlightStore? = null,
    onOpenVerse: (String, Int, Int) -> Unit = { _, _, _ -> },
    onOpenFavorites: () -> Unit = {},
    auth: MemberAuthStore? = null,
    locale: AppLocale = AppLocale.ZH_CN,
    onOpenLogin: () -> Unit = {},
    onOpenSettings: () -> Unit = {},
    activity: ReadingActivityStore? = null,
    onSignOut: () -> Unit = {},
    achievements: AchievementStore? = null,
    onOpenAchievements: () -> Unit = {},
    theme: Parchment = Parchment.light,
) {
    if (article != null) {
        ExploreArticleScreen(article, size, onBack = { onOpenArticle(null) }, onOpenChapter = onOpenChapter,
                             onOpenArticle = onOpenArticle, theme = theme)
        return
    }
    val scope = rememberCoroutineScope()
    var nameEditorOpen by remember { mutableStateOf(false) }
    var nameDraft by remember { mutableStateOf("") }
    var sharePayload by remember { mutableStateOf<VerseSharePayload?>(null) }
    var undoState by remember { mutableStateOf<Pair<String, () -> Unit>?>(null) }
    val recent = activity?.recent ?: emptyList()
    val isEn = locale == AppLocale.EN
    val ink = theme.ink.toColor()
    val muted = theme.muted.toColor()
    val faint = theme.faint.toColor()
    val accent = theme.accentOt.toColor()

    LaunchedEffect(undoState) {
        if (undoState != null) {
            delay(3400)
            undoState = null
        }
    }

    if (nameEditorOpen && auth != null) {
        AlertDialog(
            onDismissRequest = { nameEditorOpen = false },
            title = { Text(SiteCopy.t("pages.explore.greetingEditTitle", locale)) },
            text = {
                OutlinedTextField(
                    value = nameDraft,
                    onValueChange = { nameDraft = it },
                    singleLine = true,
                    placeholder = { Text(SiteCopy.t("pages.explore.birthYearModalNamePlaceholder", locale)) },
                )
            },
            confirmButton = {
                TextButton(
                    enabled = MemberAuthRules.isValidDisplayName(nameDraft),
                    onClick = { val n = nameDraft; nameEditorOpen = false; scope.launch { auth.updateDisplayName(n) } },
                ) { Text(SiteCopy.t("native.save", locale)) }
            },
            dismissButton = { TextButton(onClick = { nameEditorOpen = false }) { Text(SiteCopy.t("native.cancel", locale)) } },
        )
    }

    val insets = WindowInsets.systemBars.asPaddingValues()
    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)

        LazyColumn(
            Modifier.fillMaxSize().parchmentFade(ParchmentFadePreset.TABBAR),
            contentPadding = PaddingValues(
                top = 18.dp + insets.calculateTopPadding(),
                bottom = TAB_BAR_CLEARANCE.dp + insets.calculateBottomPadding() + 110.dp,
            ),
        ) {
            item {
                Column(Modifier.padding(horizontal = 22.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    // 顶栏问候与偏好齿轮
                    val user = auth?.user
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(
                            Modifier.weight(1f).clickableNoRipple {
                                if (user != null) { nameDraft = user.name; nameEditorOpen = true } else onOpenLogin()
                            },
                            verticalArrangement = Arrangement.spacedBy(4.dp),
                        ) {
                            Text(
                                studyGreeting(user, locale),
                                color = ink,
                                fontSize = 26.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                if (user != null) AppLocale.pick("进入优先于完成 · 私人读经书房", "Entry over completion · Personal study", locale)
                                else AppLocale.pick("点此登录，跨设备同步印记与摘录 ›", "Tap to sign in and sync notes & seals ›", locale),
                                color = if (user != null) muted else accent,
                                fontSize = 13.sp,
                            )
                        }
                        Box(
                            Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(theme.surface.toColor().copy(alpha = 0.85f))
                                .border(1.dp, theme.border.toColor(), CircleShape)
                                .clickableNoRipple(onOpenSettings),
                            contentAlignment = Alignment.Center,
                        ) {
                            MaterialIcon(MI.SETTINGS, 20f, ink.copy(alpha = 0.82f))
                        }
                    }

                    // 手抄本藏书票与书卷火漆印卡片
                    if (achievements != null) {
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(20.dp))
                                .background(theme.surface.toColor())
                                .border(1.dp, theme.borderStrong.toColor(), RoundedCornerShape(20.dp))
                                .clickableNoRipple(onOpenAchievements)
                                .padding(16.dp),
                        ) {
                            XPBar(achievements, locale, theme, readDaysOverride = activity?.readDays)
                        }
                    }

                    // 统一摘录与印记
                    if (bookmarks != null) {
                        UnifiedNotesBlock(
                            bookmarks = bookmarks,
                            highlights = highlights,
                            locale = locale,
                            theme = theme,
                            limit = 6,
                            onOpenVerse = onOpenVerse,
                            onOpenMore = onOpenFavorites,
                            onShareCard = { sharePayload = it },
                            onUndoAvailable = { msg, restore -> undoState = msg to restore },
                        )
                    }

                    // 最近阅读轨迹
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(SiteCopy.t("native.recentReading", locale), color = ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(theme.surface.toColor())
                                .border(1.dp, theme.border.toColor(), RoundedCornerShape(16.dp)),
                        ) {
                            if (recent.isEmpty()) {
                                Text(
                                    SiteCopy.t("native.noReadingRecord", locale),
                                    color = faint,
                                    fontSize = 14.sp,
                                    modifier = Modifier.padding(16.dp),
                                )
                            } else {
                                recent.take(5).forEachIndexed { idx, r ->
                                    if (idx > 0) {
                                        Box(Modifier.fillMaxWidth().padding(horizontal = 14.dp).height(0.5.dp).background(theme.border.toColor()))
                                    }
                                    val name = BibleCatalog.book(r.bookId)?.name(locale) ?: locale.zh(r.bookName)
                                    val label = if (isEn) "$name ${r.chapter}" else SiteCopy.f("native.chapterUnit", mapOf("bookName" to name, "chapter" to "${r.chapter}"), locale)
                                    Row(
                                        Modifier
                                            .fillMaxWidth()
                                            .clickableNoRipple { onOpenChapter(r.bookId, r.chapter) }
                                            .padding(horizontal = 14.dp, vertical = 12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Text(label, color = ink, fontSize = 15.5.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                                        MaterialIcon(MI.CHEVRON_RIGHT, 18f, faint)
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.height(18.dp))
                SiblingAppsSection(locale, theme)
            }
        }

        AnimatedVisibility(
            visible = undoState != null,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = TAB_BAR_CLEARANCE.dp + insets.calculateBottomPadding() + 20.dp),
        ) {
            undoState?.let { (msg, restore) ->
                UndoCapsuleToast(msg, locale) {
                    restore()
                    undoState = null
                }
            }
        }

        sharePayload?.let { payload ->
            VerseShareCardSheet(payload = payload, locale = locale, theme = theme, onClose = { sharePayload = null })
        }
    }
}

private fun studyGreeting(user: MemberUser?, locale: AppLocale): String {
    if (user == null) return AppLocale.pick("平安，旅人", "Peace, Pilgrim", locale)
    val n = MemberAuthRules.shortAccountName(user.name.ifEmpty { user.email })
    return AppLocale.pick("平安，${n.ifEmpty { "朋友" }}", "Peace, ${n.ifEmpty { "Friend" }}", locale)
}
