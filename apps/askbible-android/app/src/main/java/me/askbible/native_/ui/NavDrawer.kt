package me.askbible.native_.ui

import android.content.Context

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.SiteCopy

/**
 * 首页左上角的用户菜单，对齐 RN `ShellNavDrawer`：自左侧滑出、宽度 80%、羊皮卷底。
 * 行样式来自 `shellNavDrawerMenuStyles`（圆角 10、内边 12 × 10、正文 16、右侧细节 12）。
 */
@Composable
fun NavDrawer(
    open: Boolean,
    locale: AppLocale,
    /** 界面语言手动设置（null = 跟随系统） */
    localeOverride: AppLocale?,
    userName: String?,
    /** 当前主译本的短名，显示在「圣经版本」右边 */
    translationLabel: String,
    /** 读经同步的右侧细节；没登录传 null，这一行就不出 */
    syncDetail: String?,
    versionLabel: String,
    onSetLocale: (AppLocale?) -> Unit,
    onOpenTranslations: () -> Unit,
    onLogin: () -> Unit,
    onRegister: () -> Unit,
    onLogout: () -> Unit,
    onFeedback: () -> Unit,
    onClose: () -> Unit,
    theme: Parchment = Parchment.light,
) {
    AnimatedVisibility(open, enter = fadeIn(), exit = fadeOut()) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.42f)).clickableNoRipple(onClose))
    }
    AnimatedVisibility(
        open,
        enter = slideInHorizontally { -it },
        exit = slideOutHorizontally { -it },
    ) {
        BoxWithConstraints(Modifier.fillMaxSize()) {
            val panelW = minOf(maxWidth * 0.8f, 360.dp)
            Box(Modifier.width(panelW).fillMaxHeight().clickableNoRipple {}) {
                ParchmentBackground(theme = theme)
                Box(Modifier.fillMaxHeight().width(0.5.dp).background(theme.border.toColor())
                        .align(Alignment.CenterEnd))
                Column(
                    Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                ) {
                    Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(SiteCopy.t("native.userMenu", locale), Modifier.weight(1f),
                             color = theme.ink.toColor().copy(alpha = 0.55f), fontSize = 14.sp,
                             fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp)
                        Box(Modifier.size(40.dp).clickableNoRipple(onClose), contentAlignment = Alignment.Center) {
                            MaterialIcon(MI.CLOSE, 22f, theme.ink.toColor().copy(alpha = 0.82f))
                        }
                    }

                    Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                        // 语言行：RN 是「语言 + EN / 繁 / 简」三个胶囊，原生多一个「跟随系统」
                        Column(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
                            Text(SiteCopy.t("nav.language", locale), color = theme.ink.toColor(), fontSize = 16.sp)
                            Spacer(Modifier.height(8.dp))
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                DrawerLocaleChip(SiteCopy.t("native.followSystem", locale), localeOverride == null, theme) { onSetLocale(null) }
                                for (l in listOf(AppLocale.ZH_CN, AppLocale.ZH_TW, AppLocale.EN)) {
                                    DrawerLocaleChip(l.settingLabel, localeOverride == l, theme) { onSetLocale(l) }
                                }
                            }
                        }
                        DrawerRow(SiteCopy.t("native.bibleVersion", locale), "$translationLabel ›", theme, onOpenTranslations)
                        if (userName != null) {
                            DrawerRow(SiteCopy.t("native.signedIn", locale), userName, theme, onClose)
                            DrawerRow(SiteCopy.t("auth.drawerLogout", locale), null, theme, onLogout)
                        } else {
                            DrawerRow(SiteCopy.t("auth.pageTitle", locale), null, theme, onLogin)
                            DrawerRow(SiteCopy.t("native.register", locale), null, theme, onRegister)
                        }
                        DrawerRow(SiteCopy.t("native.sendFeedback", locale), SUPPORT_EMAIL, theme, onFeedback)
                        if (syncDetail != null) {
                            DrawerRow(SiteCopy.t("native.readingSync", locale), syncDetail, theme, onClose)
                        }
                    }

                    Text(SiteCopy.f("native.appVersion", mapOf("version" to versionLabel), locale),
                         Modifier.fillMaxWidth().padding(top = 8.dp),
                         color = theme.ink.toColor().copy(alpha = 0.42f), fontSize = 11.sp, textAlign = TextAlign.Center)
                }
            }
        }
    }
}

const val SUPPORT_EMAIL = "askbibleme@gmail.com"

@Composable
private fun androidx.compose.foundation.layout.RowScope.DrawerLocaleChip(
    label: String, on: Boolean, theme: Parchment, onClick: () -> Unit,
) {
    Box(
        Modifier.weight(1f).heightIn(min = 32.dp).clip(RoundedCornerShape(999.dp))
            .background(if (on) Color(0x2EFFB101) else theme.surface.toColor().copy(alpha = 0.45f))
            .border(if (on) 1.dp else 0.5.dp,
                    if (on) Color(0xBFFFB101) else theme.border.toColor(), RoundedCornerShape(999.dp))
            .clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = if (on) Color(0xFF784B1E) else theme.ink.toColor().copy(alpha = 0.72f),
             fontSize = 12.sp, fontWeight = FontWeight.SemiBold, maxLines = 1,
             overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
    }
}

@Composable
private fun DrawerRow(label: String, detail: String?, theme: Parchment, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickableNoRipple(onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(label, color = theme.ink.toColor(), fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.weight(1f))
        if (detail != null) {
            Text(detail, color = theme.ink.toColor().copy(alpha = 0.55f), fontSize = 12.sp,
                 maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
    Spacer(Modifier.height(2.dp))
}

/** 读经同步那一行的右侧细节 */
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

/** 「1.2.3 (45)」 */
fun appVersionLabel(context: Context): String {
    return try {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        val code = if (android.os.Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
        "${info.versionName} ($code)"
    } catch (_: Throwable) { "—" }
}

/** 发送反馈：RN 是 mailto，打不开就算了（原生没有站内反馈页） */
fun openSupportMail(context: Context) {
    val intent = android.content.Intent(android.content.Intent.ACTION_SENDTO,
                                        android.net.Uri.parse("mailto:$SUPPORT_EMAIL"))
    try { context.startActivity(intent) } catch (_: Throwable) { }
}
