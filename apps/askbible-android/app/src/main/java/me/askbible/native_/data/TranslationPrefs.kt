package me.askbible.native_.data

import android.content.Context

/** 译本偏好落盘（SharedPreferences，键与 RN AsyncStorage 同名）；格式规则在 core 的 TranslationPrefsRules。与 iOS ScriptureStore 里的持久化对等。 */
class TranslationPrefs(context: Context) {
    private val sp = context.applicationContext.getSharedPreferences("read-translation", Context.MODE_PRIVATE)

    data class Stored(val primary: ScriptureTranslation, val secondary: ScriptureTranslation?)

    fun read(): Stored {
        val s = TranslationPrefsRules.parse(sp.getString(TranslationPrefsRules.KEY, null),
                                            ScriptureTranslation.all.map { it.id },
                                            // 首装没存过：跟界面语言（RN resolveDefaultPrimaryTranslationId(index, locale)）
                                            AppLocale.primaryTranslationId(AppLocale.current))  // RN 传整个目录：下载型 / 在线译本重启后也要记住
        return Stored(ScriptureTranslation.find(s.primaryId) ?: ScriptureTranslation.DEFAULT, s.secondaryId?.let { ScriptureTranslation.find(it) })
    }

    fun write(primary: ScriptureTranslation, secondary: ScriptureTranslation?) {
        sp.edit().putString(TranslationPrefsRules.KEY, TranslationPrefsRules.serialize(primary.id, secondary?.id)).apply()
    }
}
