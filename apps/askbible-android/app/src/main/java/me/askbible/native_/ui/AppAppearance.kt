package me.askbible.native_.ui

import android.app.Activity
import android.content.Context
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.core.view.WindowCompat
import me.askbible.native_.data.Parchment

val LocalParchment = staticCompositionLocalOf { Parchment.light }
data class AppearanceChoice(val value: String, val select: (String) -> Unit)
val LocalAppearance = staticCompositionLocalOf { AppearanceChoice("system") {} }

/** Persist only the user's choice; system mode remains reactive to device changes. */
@Composable
fun AppAppearance(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("askbible.appearance", Context.MODE_PRIVATE) }
    var choice by remember { mutableStateOf(prefs.getString("mode", "system") ?: "system") }
    val systemDark = isSystemInDarkTheme()
    val dark = when (choice) { "dark" -> true; "light" -> false; else -> systemDark }
    val theme = if (dark) Parchment.dark else Parchment.light
    SideEffect {
        (context as? Activity)?.window?.let { window ->
            WindowCompat.getInsetsController(window, window.decorView).apply {
                isAppearanceLightStatusBars = !dark
                isAppearanceLightNavigationBars = !dark
            }
        }
    }
    CompositionLocalProvider(
        LocalParchment provides theme,
        LocalAppearance provides AppearanceChoice(choice) {
            choice = it
            prefs.edit().putString("mode", it).apply()
        },
    ) {
        MaterialTheme(colorScheme = if (dark) darkColorScheme() else lightColorScheme(), content = content)
    }
}
