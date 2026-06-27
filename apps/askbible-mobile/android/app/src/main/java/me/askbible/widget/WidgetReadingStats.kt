package me.askbible.widget

object WidgetReadingStats {
  data class Meta(
    val locale: String,
    val readDays: Int,
    val streakDays: Int,
    val readDaysLabel: String,
    val streakDaysLabel: String,
  )

  private fun isChineseLocale(locale: String): Boolean {
    return locale.trim().lowercase().startsWith("zh")
  }

  private fun defaultReadDaysLabel(locale: String): String {
    return if (isChineseLocale(locale)) "读经天" else "Days read"
  }

  private fun defaultStreakDaysLabel(locale: String): String {
    return if (isChineseLocale(locale)) "连续天" else "Streak"
  }

  fun fromSnapshotJson(json: org.json.JSONObject): Meta {
    val locale = json.optString("locale", "en")
    val readDaysLabel =
      json.optString("readDaysLabel").trim().ifEmpty { defaultReadDaysLabel(locale) }
    val streakDaysLabel =
      json.optString("streakDaysLabel").trim().ifEmpty { defaultStreakDaysLabel(locale) }
    return Meta(
      locale = locale,
      readDays = json.optInt("readDays", 0),
      streakDays = json.optInt("streakDays", 0),
      readDaysLabel = readDaysLabel,
      streakDaysLabel = streakDaysLabel,
    )
  }

  fun format(meta: Meta): String {
    return "${meta.readDays} ${meta.readDaysLabel} · ${meta.streakDays} ${meta.streakDaysLabel}"
  }
}
