package me.askbible.native_.ui

import android.content.Context
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import me.askbible.native_.data.AppLocale

enum class AppTextSize(val scale: Float?, val zh: String, val en: String) {
    SYSTEM(null, "跟随系统", "Follow system"),
    STANDARD(1f, "标准", "Standard"),
    LARGE(1.3f, "大", "Large"),
    EXTRA_LARGE(1.6f, "特大", "Extra large");
    fun label(locale: AppLocale) = AppLocale.pick(zh,en,locale)
}
class AppTextSizing(initial: AppTextSize, private val persist: (AppTextSize) -> Unit) {
    var selected by mutableStateOf(initial)
        private set
    fun select(value: AppTextSize) { selected=value;persist(value) }
}
val LocalAppTextSizing = staticCompositionLocalOf<AppTextSizing> { error("AppTextSizingHost required") }

@Composable
fun AppTextSizingHost(content: @Composable () -> Unit) {
    val context=LocalContext.current
    val systemDensity=LocalDensity.current
    val state=remember {
        val prefs=context.getSharedPreferences("askbible_accessibility",Context.MODE_PRIVATE)
        val initial=AppTextSize.entries.firstOrNull { it.name==prefs.getString("text_size",null) } ?: AppTextSize.SYSTEM
        AppTextSizing(initial) { prefs.edit().putString("text_size",it.name).apply() }
    }
    // Preserve Android's native scaling (including nonlinear scaling) in System mode.
    val density=state.selected.scale?.let { Density(systemDensity.density,it) } ?: systemDensity
    CompositionLocalProvider(LocalDensity provides density, LocalAppTextSizing provides state, content=content)
}
