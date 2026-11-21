package me.askbible.native_.ui

import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.SiteCopy

/**
 * 书房底部偏好设置抽屉（与 iOS NavDrawerView 对齐）：
 * 取消左侧滑出抽屉与重复「音乐」行，改为底部柔和升起的三分组羊皮纸弹层：
 * 1) 阅读与陪伴（语言 / 圣经版本 / 每日提醒 / 连接电视）
 * 2) 账号与云端同步（登录注册 / 同步状态 / 退出）
 * 3) 全局字号与支持（全局字号 / 邮件反馈 / 版本信息 / 删除账户）
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NavDrawer(
    open: Boolean,
    locale: AppLocale,
    localeOverride: AppLocale?,
    userName: String?,
    translationLabel: String,
    syncDetail: String?,
    versionLabel: String,
    onSetLocale: (AppLocale?) -> Unit,
    onOpenTranslations: () -> Unit,
    onLogin: () -> Unit,
    onRegister: () -> Unit,
    onLogout: () -> Unit,
    onFeedback: () -> Unit,
    onOpenMusic: () -> Unit = {},
    reminderEnabled: Boolean = false,
    reminderTime: String = "07:00",
    onToggleReminder: () -> Unit = {},
    onPickReminderTime: () -> Unit = {},
    updateDetail: String? = null,
    onCheckUpdates: () -> Unit = {},
    onDeleteAccount: () -> Unit = {},
    onClose: () -> Unit,
    theme: Parchment = LocalParchment.current,
) {
    val textSizing = LocalAppTextSizing.current
    AnimatedVisibility(open, enter = fadeIn(), exit = fadeOut()) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.40f)).clickableNoRipple(onClose))
    }
    AnimatedVisibility(
        open,
        enter = slideInVertically { it },
        exit = slideOutVertically { it },
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.84f)
                    .clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp))
                    .clickableNoRipple {},
            ) {
                ParchmentBackground(theme = theme)
                Column(
                    Modifier
                        .fillMaxSize()
                        .navigationBarsPadding()
                        .padding(horizontal = 18.dp, vertical = 10.dp),
                ) {
                    Box(
                        Modifier
                            .align(Alignment.CenterHorizontally)
                            .padding(bottom = 10.dp)
                            .width(38.dp)
                            .height(4.dp)
                            .clip(CircleShape)
                            .background(theme.ink.toColor().copy(alpha = 0.22f)),
                    )
                    Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            AppLocale.pick("偏好设置", "Preferences", locale),
                            Modifier.weight(1f),
                            color = theme.ink.toColor(),
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            SiteCopy.t("native.done", locale),
                            Modifier.clickableNoRipple(onClose).padding(horizontal = 8.dp, vertical = 6.dp),
                            color = theme.accentOt.toColor(),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }

                    Column(
                        Modifier.weight(1f).verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        // 分组一：阅读与陪伴
                        SheetGroupTitle(AppLocale.pick("阅读与陪伴", "Reading & Companion", locale), theme)
                        SheetCard(theme) {
                            Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                                Text(SiteCopy.t("nav.language", locale), color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.Medium)
                                Spacer(Modifier.height(8.dp))
                                FlowRow(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                ) {
                                    DrawerLocaleChip(SiteCopy.t("native.followSystem", locale), localeOverride == null, theme) { onSetLocale(null) }
                                    for (l in listOf(AppLocale.ZH_CN, AppLocale.ZH_TW, AppLocale.EN)) {
                                        DrawerLocaleChip(l.settingLabel, localeOverride == l, theme) { onSetLocale(l) }
                                    }
                                }
                            }
                            SheetHairline(theme)
                            SheetRow(SiteCopy.t("native.bibleVersion", locale), "$translationLabel ›", theme, onOpenTranslations)
                            SheetHairline(theme)
                            Row(
                                Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Row(
                                    Modifier.weight(1f).clickableNoRipple(onToggleReminder),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Text(SiteCopy.t("native.reminderTitle", locale), color = theme.ink.toColor(), fontSize = 15.sp)
                                    Box(
                                        Modifier.clip(CircleShape)
                                            .background(if (reminderEnabled) Color(0x38FFB101) else theme.border.toColor().copy(alpha = 0.25f))
                                            .padding(horizontal = 8.dp, vertical = 3.dp),
                                    ) {
                                        Text(
                                            SiteCopy.t(if (reminderEnabled) "native.reminderOn" else "native.reminderOff", locale),
                                            color = if (reminderEnabled) Color(0xFF784B1E) else theme.muted.toColor(),
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                        )
                                    }
                                }
                                Text(
                                    reminderTime,
                                    Modifier.clickableNoRipple(onPickReminderTime).padding(4.dp),
                                    color = theme.accentOt.toColor(),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                )
                            }
                            SheetHairline(theme)
                            val appearance = LocalAppearance.current
                            Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                                Text(SiteCopy.t("native.appearance", locale), color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.Medium)
                                Spacer(Modifier.height(8.dp))
                                FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    for ((mode, key) in listOf("system" to "native.followSystem", "light" to "native.appearanceLight", "dark" to "native.appearanceDark")) {
                                        DrawerLocaleChip(SiteCopy.t(key, locale), appearance.value == mode, theme) { appearance.select(mode) }
                                    }
                                }
                            }
                        }

                        // 分组二：账号与云端同步
                        SheetGroupTitle(AppLocale.pick("账号与云端同步", "Account & Cloud Sync", locale), theme)
                        SheetCard(theme) {
                            if (userName != null) {
                                SheetRow(SiteCopy.t("native.signedIn", locale), userName, theme, onClose)
                                if (syncDetail != null) {
                                    SheetHairline(theme)
                                    SheetRow(SiteCopy.t("native.readingSync", locale), syncDetail, theme, onClose)
                                }
                                SheetHairline(theme)
                                SheetRow(SiteCopy.t("auth.drawerLogout", locale), null, theme, onLogout)
                            } else {
                                SheetRow(SiteCopy.t("auth.pageTitle", locale), "›", theme, onLogin)
                            }
                        }

                        // 分组三：全局字号与支持
                        SheetGroupTitle(AppLocale.pick("全局字号与支持", "App Text Size & Support", locale), theme)
                        SheetCard(theme) {
                            Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp)) {
                                Text(AppLocale.pick("全局字号", "App text size", locale), color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                                AppTextSize.entries.forEach { option ->
                                    Text(
                                        (if (textSizing.selected == option) "●  " else "○  ") + option.label(locale),
                                        Modifier.fillMaxWidth().heightIn(min = 44.dp).clickableNoRipple { textSizing.select(option) }.padding(vertical = 8.dp),
                                        color = theme.ink.toColor(),
                                        fontSize = 14.5.sp,
                                    )
                                }
                            }
                            SheetHairline(theme)
                            SheetRow(SiteCopy.t("native.checkForUpdates", locale), updateDetail ?: appVersionWithTimeLabel(versionLabel), theme, onCheckUpdates)
                            SheetHairline(theme)
                            SheetRow(SiteCopy.t("native.sendFeedback", locale), SUPPORT_EMAIL, theme, onFeedback)
                            if (userName != null) {
                                SheetHairline(theme)
                                Text(
                                    SiteCopy.t("native.deleteAccount", locale),
                                    Modifier.fillMaxWidth().clickableNoRipple(onDeleteAccount).padding(horizontal = 14.dp, vertical = 12.dp),
                                    color = Color(0xFFA63D33).copy(alpha = 0.85f),
                                    fontSize = 13.sp,
                                )
                            }
                        }

                        Text(
                            SiteCopy.f("native.appVersion", mapOf("version" to appVersionWithTimeLabel(versionLabel)), locale),
                            Modifier.fillMaxWidth().clickableNoRipple(onCheckUpdates).padding(vertical = 8.dp),
                            color = theme.faint.toColor(),
                            fontSize = 11.sp,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }
    }
}

const val SUPPORT_EMAIL = "hello@askbible.me"

@Composable
private fun SheetGroupTitle(title: String, theme: Parchment) {
    Text(
        title,
        Modifier.padding(start = 4.dp),
        color = theme.muted.toColor(),
        fontSize = 12.5.sp,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
private fun SheetCard(theme: Parchment, content: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(theme.surface.toColor())
            .border(1.dp, theme.border.toColor(), RoundedCornerShape(16.dp)),
    ) {
        content()
    }
}

@Composable
private fun SheetHairline(theme: Parchment) {
    Box(Modifier.fillMaxWidth().padding(horizontal = 14.dp).height(0.5.dp).background(theme.border.toColor()))
}

@Composable
private fun DrawerLocaleChip(
    label: String, on: Boolean, theme: Parchment, onClick: () -> Unit,
) {
    Box(
        Modifier.heightIn(min = 38.dp).clip(CircleShape)
            .background(if (on) Color(0x2EFFB101) else theme.surface.toColor().copy(alpha = 0.45f))
            .border(if (on) 1.dp else 0.75.dp, if (on) Color(0xBFFFB101) else theme.border.toColor(), CircleShape)
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            color = if (on) Color(0xFF784B1E) else theme.ink.toColor().copy(alpha = 0.8f),
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun SheetRow(label: String, detail: String?, theme: Parchment, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickableNoRipple(onClick).heightIn(min = 48.dp).padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, Modifier.weight(1f), color = theme.ink.toColor(), fontSize = 15.sp)
        if (detail != null) {
            Text(detail, color = theme.muted.toColor(), fontSize = 13.sp, maxLines = 1)
        }
    }
}

fun syncDetailText(engine: me.askbible.native_.data.MemberReadingSyncEngine, locale: AppLocale): String {
    val at = engine.lastSyncedAt
    if (!at.isNullOrEmpty()) {
        val ms = me.askbible.native_.data.MemberReadingSyncRules.parseIsoMs(at)
        if (ms > 0.0) {
            val fmt = java.text.SimpleDateFormat(if (locale == AppLocale.EN) "MMM d, HH:mm" else "M月d日 HH:mm", java.util.Locale.getDefault())
            return SiteCopy.f("native.syncLast", mapOf("time" to fmt.format(java.util.Date(ms.toLong()))), locale)
        }
    }
    return if (engine.lastError != null) SiteCopy.t("native.syncIncomplete", locale) else SiteCopy.t("native.syncNever", locale)
}

fun appVersionLabel(context: Context): String {
    return try {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        val code = if (android.os.Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
        "${info.versionName} ($code)"
    } catch (_: Throwable) { "—" }
}

fun formatLocalTimestamp(epochMs: Long = System.currentTimeMillis()): String {
    val fmt = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.getDefault())
    return fmt.format(java.util.Date(epochMs))
}

fun appVersionWithTimeLabel(versionLabel: String): String {
    val epoch = me.askbible.native_.BuildConfig.BUILD_EPOCH_MS
    return if (epoch > 0L) "$versionLabel · ${formatLocalTimestamp(epoch)}" else versionLabel
}

fun appVersionWithTimeLabel(context: Context): String =
    appVersionWithTimeLabel(appVersionLabel(context))

fun openSupportMail(context: Context) {
    val intent = android.content.Intent(android.content.Intent.ACTION_SENDTO, android.net.Uri.parse("mailto:$SUPPORT_EMAIL"))
    try { context.startActivity(intent) } catch (_: Throwable) { }
}
