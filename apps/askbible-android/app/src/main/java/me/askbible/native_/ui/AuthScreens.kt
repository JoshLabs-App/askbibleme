package me.askbible.native_.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import me.askbible.native_.data.SiteCopy
import androidx.compose.runtime.getValue
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
import kotlinx.coroutines.launch
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.MemberAuthStore
import me.askbible.native_.data.Parchment

/**
 * 登录 / 注册页（RN MemberLoginScreen / MemberRegisterScreen + AuthParchmentScreen + authFormSurface）：
 * 全屏羊皮卷底、窄栏版心，返回 → 标题 → 引言 → Google 按钮 → 「或」分隔 → 邮箱 / 密码（注册多一个昵称）→ 提交 → 切换链接。
 * Google 走 Supabase 浏览器 OAuth（RN 安卓默认分支：Custom Tab → askbible://auth/callback）；Apple 按钮 RN 在安卓不显示，这里也不放。
 */
@Composable
fun LoginScreen(auth: MemberAuthStore, locale: AppLocale, onBack: () -> Unit, onRegister: () -> Unit, onDone: () -> Unit, theme: Parchment = Parchment.light) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    var googleError by remember { mutableStateOf<String?>(null) }
    AuthPage(locale, SiteCopy.t("auth.pageTitle", locale), onBack, theme) {
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
                if (err != null) error = if (err == "network") SiteCopy.t("auth.errorNetwork", locale) else SiteCopy.localizeKnown(err, locale) else onDone()
            }
        }
        AuthLink(SiteCopy.t("auth.loginFooterRegister", locale), locale, theme, onRegister)
    }
}

@Composable
fun RegisterScreen(auth: MemberAuthStore, locale: AppLocale, onBack: () -> Unit, onLogin: () -> Unit, onDone: () -> Unit, theme: Parchment = Parchment.light) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var pending by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    var googleError by remember { mutableStateOf<String?>(null) }
    AuthPage(locale, SiteCopy.t("auth.registerPageTitle", locale), onBack, theme) {
        SocialSignInButtons(auth, locale, theme, googleError, { googleError = it }, onDone)
        AuthField(SiteCopy.t("auth.email", locale), email, { email = it }, locale, theme, KeyboardType.Email)
        AuthField(SiteCopy.t("auth.password", locale), password, { password = it }, locale, theme, KeyboardType.Password, secure = true)
        AuthField(SiteCopy.t("auth.registerName", locale), name, { name = it }, locale, theme, KeyboardType.Text)
        error?.let { AuthErrorText(it, locale) }
        AuthSubmit(SiteCopy.t("auth.registerSubmit", locale), pending, locale, theme) {
            if (pending || auth.oauthPending) return@AuthSubmit
            pending = true; error = null; googleError = null
            scope.launch {
                val err = auth.register(email, password, name, locale.tag)
                pending = false
                if (err != null) error = if (err == "network") SiteCopy.t("auth.errorNetwork", locale) else SiteCopy.localizeKnown(err, locale) else onDone()
            }
        }
        AuthLink(SiteCopy.t("auth.registerGoLogin", locale), locale, theme, onLogin)
    }
}

/** RN MemberGoogleSignInButton + MemberAuthMethodDivider（登录 / 注册页共用）：按钮 → 行内错误 → 「或」分隔 */
@Composable
private fun SocialSignInButtons(auth: MemberAuthStore, locale: AppLocale, theme: Parchment, googleError: String?, setGoogleError: (String?) -> Unit, onDone: () -> Unit) {
    val context = LocalContext.current
    val result = auth.oauthResult
    LaunchedEffect(result) {
        when (result) {
            is MemberAuthStore.SocialOutcome.Done -> { auth.clearOAuthResult(); onDone() }
            is MemberAuthStore.SocialOutcome.Failed -> { setGoogleError(result.message); auth.clearOAuthResult() }
            is MemberAuthStore.SocialOutcome.Cancelled -> auth.clearOAuthResult()
            null -> {}
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        OAuthProviderButton(SiteCopy.t("auth.continueWithGoogle", locale), pending = auth.oauthPending, disabled = auth.oauthPending, locale = locale, theme = theme) {
            setGoogleError(null)
            auth.startGoogleSignIn(context, locale.tag)
        }
        googleError?.let { AuthOAuthError(it, locale) }
    }
    AuthMethodDivider(locale, theme)
}

/** RN OAuthProviderButton：48 高、圆角 12、hairline 边、parchmentControlSurface.fillStrong 底；左 20 槽放品牌标，文字居中，右侧对称留 20 槽 */
@Composable
private fun OAuthProviderButton(label: String, pending: Boolean, disabled: Boolean, locale: AppLocale, theme: Parchment, onClick: () -> Unit) {
    val inactive = disabled || pending
    Box(
        Modifier.fillMaxWidth().heightIn(min = 48.dp).clip(RoundedCornerShape(12.dp))
            .background(Color(0x9EFFFCF5)).border(0.5.dp, theme.border.toColor(), RoundedCornerShape(12.dp))
            .alpha(if (inactive) 0.55f else 1f).clickableNoRipple { if (!inactive) onClick() },
        contentAlignment = Alignment.Center,
    ) {
        if (pending) CircularProgressIndicator(color = theme.ink.toColor(), strokeWidth = 2.dp, modifier = Modifier.padding(12.dp).height(24.dp))
        else Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(20.dp), contentAlignment = Alignment.Center) { GoogleBrandMark(18.dp) }
            Text(locale.zh(label), Modifier.weight(1f), color = theme.ink.toColor(), fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center, maxLines = 2)
            Spacer(Modifier.size(20.dp))
        }
    }
}

/** RN GOOGLE_G_PATHS：官方四色 G（viewBox 48） */
private val GOOGLE_G_SEGMENTS = listOf(
    0xFFEA4335 to "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z",
    0xFF4285F4 to "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z",
    0xFFFBBC05 to "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z",
    0xFF34A853 to "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z",
)

@Composable
private fun GoogleBrandMark(size: Dp) {
    val paths = remember { GOOGLE_G_SEGMENTS.map { (argb, d) -> Color(argb) to PathParser().parsePathString(d).toPath() } }
    Canvas(Modifier.size(size)) {
        val k = this.size.width / 48f
        scale(k, k, pivot = Offset.Zero) { for ((color, path) in paths) drawPath(path, color) }
    }
}

/** RN OAuthInlineError：13 号 / 行高 18 / #b42318 居中 */
@Composable
private fun AuthOAuthError(text: String, locale: AppLocale) {
    Text(locale.zh(text), Modifier.fillMaxWidth(), color = Color(0xFFB42318), fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
}

/** RN MemberAuthMethodDivider：hairline 线 —「或」— 线，上下 16 */
@Composable
private fun AuthMethodDivider(locale: AppLocale, theme: Parchment) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.weight(1f).height(0.5.dp).background(theme.border.toColor()))
        Text(SiteCopy.t("auth.orDivider", locale).uppercase(), color = theme.faint.toColor(), fontSize = 11.sp, letterSpacing = 0.6.sp, fontWeight = FontWeight.SemiBold)
        Box(Modifier.weight(1f).height(0.5.dp).background(theme.border.toColor()))
    }
}

/** 页面骨架：羊皮卷底 + 返回 + 标题 + 引言 + 表单（键盘顶起靠 imePadding + 滚动） */
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
            Text(SiteCopy.t("auth.registerIntro", locale), Modifier.fillMaxWidth().padding(top = 10.dp), color = theme.muted.toColor(), fontSize = 14.sp, lineHeight = 21.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            content()
        }
    }
}

@Composable
private fun AuthField(label: String, value: String, onChange: (String) -> Unit, locale: AppLocale, theme: Parchment, keyboard: KeyboardType, secure: Boolean = false) {
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
private fun AuthErrorText(text: String, locale: AppLocale) {
    Text(SiteCopy.localizeKnown(text, locale), Modifier.fillMaxWidth().padding(top = 8.dp), color = Color(0xFFB42318), fontSize = 13.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center)
}

@Composable
private fun AuthSubmit(title: String, pending: Boolean, locale: AppLocale, theme: Parchment, onClick: () -> Unit) {
    Box(
        Modifier.fillMaxWidth().padding(top = 16.dp).heightIn(min = 48.dp).clip(RoundedCornerShape(12.dp))
            .background(Color(0x1A1C1410)).alpha(if (pending) 0.55f else 1f).clickableNoRipple(onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (pending) CircularProgressIndicator(color = theme.ink.toColor(), strokeWidth = 2.dp, modifier = Modifier.padding(12.dp).height(24.dp))
        else Text(locale.zh(title), color = theme.ink.toColor(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun AuthLink(title: String, locale: AppLocale, theme: Parchment, onClick: () -> Unit) {
    Text(locale.zh(title), Modifier.fillMaxWidth().padding(top = 14.dp).padding(vertical = 8.dp).clickableNoRipple(onClick),
         color = theme.muted.toColor(), fontSize = 13.sp, fontWeight = FontWeight.Medium, textAlign = TextAlign.Center, textDecoration = TextDecoration.Underline)
}
