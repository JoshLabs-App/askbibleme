package me.askbible.native_.ui

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.MemberAuthStore
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.SiteCopy

/**
 * 首次打开的欢迎页，对齐 RN `/welcome`（OnboardingDevotionIntro）：选语言 + 登录 / 注册，右上「略过」。
 * RN 那一版中间还有「每日读经提醒」，原生还没有本地通知，这一段先不做。
 */
@Composable
fun WelcomeScreen(
    auth: MemberAuthStore,
    locale: AppLocale,
    localeOverride: AppLocale?,
    onSetLocale: (AppLocale?) -> Unit,
    onDone: () -> Unit,
    theme: Parchment = Parchment.light,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var googleError by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()
                .verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 6.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Box(
                    Modifier.heightIn(min = 32.dp).clickableNoRipple { if (!pending) onDone() }
                        .padding(horizontal = 4.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(SiteCopy.t("onboarding.welcome.loginSkip", locale),
                         color = theme.muted.toColor(), fontSize = 17.sp)
                }
            }

            Column(Modifier.fillMaxWidth().widthIn(max = 420.dp).padding(top = 12.dp)) {
                Text(SiteCopy.t("onboarding.welcome.languageTitle", locale),
                     color = theme.muted.toColor(), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 50.dp).clip(RoundedCornerShape(10.dp))
                        .background(theme.surface.toColor())
                        .border(0.5.dp, theme.border.toColor(), RoundedCornerShape(10.dp)),
                ) {
                    WelcomeLocaleChip(SiteCopy.t("native.followSystem", locale), localeOverride == null, theme) { onSetLocale(null) }
                    for (l in listOf(AppLocale.ZH_CN, AppLocale.ZH_TW, AppLocale.EN)) {
                        WelcomeLocaleChip(l.settingLabel, localeOverride == l, theme) { onSetLocale(l) }
                    }
                }

                Spacer(Modifier.height(16.dp))
                Text(SiteCopy.t("onboarding.welcome.loginTitle", locale),
                     color = theme.ink.toColor(), fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Text(SiteCopy.t("onboarding.welcome.loginIntro", locale),
                     color = theme.muted.toColor(), fontSize = 14.sp, lineHeight = 20.sp)
                Spacer(Modifier.height(12.dp))
                SocialSignInButtons(auth, locale, theme, googleError, { googleError = it }, onDone)
                AuthField(SiteCopy.t("auth.email", locale), email, { email = it }, locale, theme, KeyboardType.Email)
                AuthField(SiteCopy.t("auth.password", locale), password, { password = it }, locale, theme, KeyboardType.Password, secure = true)
                error?.let { AuthErrorText(it, locale) }
                AuthSubmit(SiteCopy.t("auth.submit", locale), pending, locale, theme) {
                    if (pending || auth.oauthPending) return@AuthSubmit
                    pending = true; error = null; googleError = null
                    scope.launch {
                        val err = auth.signIn(email, password, locale.tag)
                        pending = false
                        if (err != null) {
                            error = if (err == "network") SiteCopy.t("auth.errorNetwork", locale) else SiteCopy.localizeKnown(err, locale)
                        } else onDone()
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun RowScope.WelcomeLocaleChip(label: String, on: Boolean, theme: Parchment, onClick: () -> Unit) {
    Box(
        Modifier.weight(1f).heightIn(min = 50.dp)
            .background(if (on) Color(0x2EFFB101) else Color.Transparent)
            .clickableNoRipple(onClick).padding(horizontal = 6.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(label, color = if (on) theme.ink.toColor() else theme.muted.toColor(),
             fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1,
             overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
    }
}

/** 欢迎页只出一次（RN `onboardingCompleted`） */
object OnboardingPrefs {
    private const val FILE = "onboarding"
    private const val KEY = "onboardingCompleted"

    fun completed(context: Context): Boolean =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).getString(KEY, null) == "1"

    fun complete(context: Context) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY, "1").apply()
    }
}
