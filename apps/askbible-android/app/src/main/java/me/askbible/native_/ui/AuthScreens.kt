package me.askbible.native_.ui

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.MemberAuthStore
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.SiteCopy

/**
 * 登录页（DECISIONS D-44：羊皮卷底、窄栏版心，6 位邮箱验证码无密码登录/自动建号，消除浏览器回调故障，与 iOS `LoginView` 对齐）。
 */
@Composable
fun LoginScreen(
    auth: MemberAuthStore,
    locale: AppLocale,
    onBack: () -> Unit,
    onRegister: () -> Unit = {},
    onDone: () -> Unit,
    theme: Parchment = LocalParchment.current,
) {
    AuthPage(locale, SiteCopy.t("auth.pageTitle", locale), onBack, theme) {
        EmailOtpForm(auth = auth, locale = locale, theme = theme, onDone = onDone)
    }
}

/** 兼容旧路由：无密码验证码已统一登录与自动注册 */
@Composable
fun RegisterScreen(
    auth: MemberAuthStore,
    locale: AppLocale,
    onBack: () -> Unit,
    onLogin: () -> Unit = {},
    onDone: () -> Unit,
    theme: Parchment = LocalParchment.current,
) {
    LoginScreen(auth = auth, locale = locale, onBack = onBack, onRegister = onLogin, onDone = onDone, theme = theme)
}

/** 登录页与欢迎页共用的 6 位邮箱验证码表单（含 45 秒重发倒计时与更换邮箱） */
@Composable
fun EmailOtpForm(
    auth: MemberAuthStore,
    locale: AppLocale,
    theme: Parchment,
    onDone: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var stepSent by remember { mutableStateOf(false) }
    var pending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var cooldown by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(cooldown) {
        if (cooldown > 0) {
            delay(1000L)
            cooldown -= 1
        }
    }

    fun sendCode() {
        if (pending) return
        val clean = email.trim().lowercase()
        if (!clean.contains("@") || !clean.contains(".")) {
            error = SiteCopy.t("native.otpInvalidEmail", locale)
            return
        }
        pending = true; error = null
        scope.launch {
            val err = auth.sendOtp(clean, locale.tag)
            pending = false
            if (err != null) {
                error = if (err == "network") SiteCopy.t("auth.errorNetwork", locale) else SiteCopy.localizeKnown(err, locale)
            } else {
                email = clean
                stepSent = true
                cooldown = 45
            }
        }
    }

    fun verifyCode() {
        if (pending) return
        val digits = code.filter { it.isDigit() }
        if (digits.length != 6) {
            error = SiteCopy.t("native.otpInvalidCode", locale)
            return
        }
        pending = true; error = null
        scope.launch {
            val err = auth.verifyOtp(email = email, code = digits, locale = locale.tag)
            pending = false
            if (err != null) {
                error = if (err == "network") SiteCopy.t("auth.errorNetwork", locale) else SiteCopy.localizeKnown(err, locale)
            } else {
                onDone()
            }
        }
    }

    if (!stepSent) {
        AuthField(SiteCopy.t("auth.email", locale), email, { email = it }, locale, theme, KeyboardType.Email)
        error?.let { AuthErrorText(it, locale) }
        AuthSubmit(SiteCopy.t("native.otpSendCode", locale), pending, locale, theme) { sendCode() }
    } else {
        Text(
            SiteCopy.f("native.otpSentTo", mapOf("email" to email.trim()), locale),
            Modifier.fillMaxWidth().padding(top = 6.dp),
            color = theme.muted.toColor(),
            fontSize = 13.sp,
            lineHeight = 19.sp,
        )
        AuthField(
            SiteCopy.t("native.otpCodeLabel", locale),
            code,
            { next -> code = next.filter { it.isDigit() }.take(6) },
            locale,
            theme,
            KeyboardType.Number,
        )
        error?.let { AuthErrorText(it, locale) }
        AuthSubmit(SiteCopy.t("native.otpVerifySubmit", locale), pending, locale, theme) { verifyCode() }
        Row(
            Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (cooldown > 0) SiteCopy.f("native.otpResendIn", mapOf("n" to cooldown.toString()), locale)
                else SiteCopy.t("native.otpResend", locale),
                Modifier.padding(vertical = 8.dp).clickableNoRipple { if (!pending && cooldown == 0) sendCode() },
                color = if (cooldown > 0) theme.faint.toColor() else theme.muted.toColor(),
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
            Text(
                SiteCopy.t("native.otpChangeEmail", locale),
                Modifier.padding(vertical = 8.dp).clickableNoRipple {
                    if (!pending) {
                        stepSent = false
                        code = ""
                        error = null
                    }
                },
                color = theme.muted.toColor(),
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                textDecoration = TextDecoration.Underline,
            )
        }
    }
}

@Composable
private fun AuthPage(locale: AppLocale, title: String, onBack: () -> Unit, theme: Parchment, content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize()) {
        ParchmentBackground(theme = theme)
        Column(
            Modifier.fillMaxSize().statusBarsPadding().imePadding().verticalScroll(rememberScrollState())
                .padding(PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 24.dp)),
        ) {
            Text(SiteCopy.t("pages.read.chapterChromeBack", locale), Modifier.padding(vertical = 8.dp).clickableNoRipple(onBack), color = theme.faint.toColor(), fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(locale.zh(title), Modifier.fillMaxWidth().padding(top = 8.dp), color = theme.ink.toColor(), fontSize = 18.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center)
            Text(SiteCopy.t("native.otpIntro", locale), Modifier.fillMaxWidth().padding(top = 10.dp), color = theme.muted.toColor(), fontSize = 14.sp, lineHeight = 21.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            content()
        }
    }
}

@Composable
fun AuthField(label: String, value: String, onChange: (String) -> Unit, locale: AppLocale, theme: Parchment, keyboard: KeyboardType, secure: Boolean = false) {
    Text(locale.zh(label), Modifier.padding(top = 10.dp), color = theme.muted.toColor(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    Spacer(Modifier.height(10.dp))
    BasicTextField(
        value = value, onValueChange = onChange, singleLine = true,
        textStyle = TextStyle(color = theme.ink.toColor(), fontSize = 17.sp),
        cursorBrush = SolidColor(theme.ink.toColor()),
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        visualTransformation = if (secure) PasswordVisualTransformation() else VisualTransformation.None,
        modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp).clip(RoundedCornerShape(10.dp))
            .background(Color(0x9EFFFCF5)).border(0.5.dp, theme.border.toColor(), RoundedCornerShape(10.dp)),
        decorationBox = { inner -> Box(Modifier.padding(horizontal = 14.dp, vertical = 14.dp), contentAlignment = Alignment.CenterStart) { inner() } },
    )
}

@Composable
fun AuthErrorText(text: String, locale: AppLocale) {
    Text(SiteCopy.localizeKnown(text, locale), Modifier.fillMaxWidth().padding(top = 8.dp), color = Color(0xFFB42318), fontSize = 13.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
}

@Composable
fun AuthSubmit(title: String, pending: Boolean, locale: AppLocale, theme: Parchment, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().padding(top = 16.dp).heightIn(min = 48.dp).clip(RoundedCornerShape(12.dp))
            .background(Color(0x38FFB101)).border(0.5.dp, theme.border.toColor(), RoundedCornerShape(12.dp))
            .alpha(if (pending) 0.55f else 1f).clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (pending) CircularProgressIndicator(color = theme.ink.toColor(), strokeWidth = 2.dp, modifier = Modifier.padding(12.dp).height(24.dp))
        else Text(locale.zh(title), color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}
