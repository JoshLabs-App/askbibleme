package me.askbible.native_.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
import me.askbible.native_.data.MemberAuthStore
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.SiteCopy

/**
 * 首次打开的欢迎页（对齐 iOS `WelcomeView.swift`）：
 * 首屏只承担安静进入「开始今日灵修」，右上角放语言与轻量「登录」（拉起 6 位验证码面板）。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WelcomeScreen(
    auth: MemberAuthStore,
    locale: AppLocale,
    localeOverride: AppLocale?,
    onSetLocale: (AppLocale?) -> Unit,
    onDone: () -> Unit,
    theme: Parchment = LocalParchment.current,
) {
    var showSignIn by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()) {
            val topGap = maxHeight * 0.12f
            Column(
                Modifier.fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 24.dp, vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Row(
                    Modifier.fillMaxWidth().widthIn(max = 420.dp),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier.heightIn(min = 40.dp)
                            .clickableNoRipple { showSignIn = true }
                            .padding(horizontal = 6.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            SiteCopy.t("native.welcomeSignIn", locale),
                            color = theme.muted.toColor(),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }

                Spacer(Modifier.height(topGap))

                Column(
                    Modifier.fillMaxWidth().widthIn(max = 420.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        SiteCopy.t("native.welcomeTitle", locale),
                        color = theme.ink.toColor(),
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        SiteCopy.t("native.welcomeTagline", locale),
                        color = theme.readingAccent,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        SiteCopy.t("native.welcomeLead", locale),
                        color = theme.muted.toColor(),
                        fontSize = 14.sp,
                        lineHeight = 20.sp,
                        textAlign = TextAlign.Center,
                    )
                }

                Spacer(Modifier.height(28.dp))

                Column(Modifier.fillMaxWidth().widthIn(max = 420.dp)) {
                    Text(
                        SiteCopy.t("onboarding.welcome.languageTitle", locale),
                        color = theme.muted.toColor(),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(10.dp))
                            .background(theme.surface.toColor())
                            .border(0.5.dp, theme.border.toColor(), RoundedCornerShape(10.dp)),
                    ) {
                        WelcomeLocaleChip(SiteCopy.t("native.followSystem", locale), localeOverride == null, theme) { onSetLocale(null) }
                        for (l in listOf(AppLocale.ZH_CN, AppLocale.ZH_TW, AppLocale.EN)) {
                            WelcomeLocaleChip(l.settingLabel, localeOverride == l, theme) { onSetLocale(l) }
                        }
                    }
                }

                Spacer(Modifier.weight(1f, fill = true))
                Spacer(Modifier.height(24.dp))

                Column(
                    Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(bottom = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier.fillMaxWidth().heightIn(min = 52.dp).clip(RoundedCornerShape(12.dp))
                            .background(Color(0x38FFB101))
                            .border(0.5.dp, theme.border.toColor(), RoundedCornerShape(12.dp))
                            .clickableNoRipple(onDone),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            SiteCopy.t("native.welcomeStart", locale),
                            color = theme.ink.toColor(),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        SiteCopy.t("native.welcomeSyncHint", locale),
                        color = theme.muted.toColor(),
                        fontSize = 12.sp,
                        lineHeight = 18.sp,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
    }

    if (showSignIn) {
        ModalBottomSheet(
            onDismissRequest = { showSignIn = false },
            containerColor = theme.surfaceSolid.toColor(),
        ) {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 32.dp),
            ) {
                Text(
                    SiteCopy.t("auth.pageTitle", locale),
                    color = theme.ink.toColor(),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(8.dp))
                EmailOtpForm(
                    auth = auth,
                    locale = locale,
                    theme = theme,
                    onDone = {
                        showSignIn = false
                        onDone()
                    },
                )
            }
        }
    }
}

@Composable
private fun RowScope.WelcomeLocaleChip(label: String, on: Boolean, theme: Parchment, onClick: () -> Unit) {
    Box(
        Modifier.weight(1f).heightIn(min = 48.dp)
            .background(if (on) Color(0x2EFFB101) else Color.Transparent)
            .clickableNoRipple(onClick).padding(horizontal = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = if (on) theme.ink.toColor() else theme.muted.toColor(),
             fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1,
             overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
    }
}

/** 欢迎页只出一次 */
object OnboardingPrefs {
    private const val FILE = "onboarding"
    private const val KEY = "onboardingCompleted"

    fun completed(context: Context): Boolean =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY, null) == "1"

    fun complete(context: Context) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY, "1").apply()
    }
}
