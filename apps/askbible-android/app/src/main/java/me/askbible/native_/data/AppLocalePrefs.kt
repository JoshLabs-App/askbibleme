package me.askbible.native_.data

import android.content.Context

/**
 * 界面语言的手动设置（原生版新增，RN 没有：RN 只跟系统语言）。null = 跟随系统。
 * Josh 2026-09-10：「在探索页也放入语言的设置」。与 iOS AppLocale.storedOverride 同键义。
 */
object AppLocalePrefs {
    private const val KEY = "askbible.app-locale-override.v1"

    private fun sp(context: Context) = context.applicationContext.getSharedPreferences("app-locale", Context.MODE_PRIVATE)

    fun read(context: Context): AppLocale? {
        val tag = sp(context).getString(KEY, null) ?: return null
        return AppLocale.entries.firstOrNull { it.tag == tag }
    }

    fun write(context: Context, locale: AppLocale?) {
        sp(context).edit().apply { if (locale == null) remove(KEY) else putString(KEY, locale.tag) }.apply()
    }
}
