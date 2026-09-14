package me.askbible.native_.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import me.askbible.native_.R

class DailyVerseWidget : AppWidgetProvider() {

    companion object {
        const val PREFS = "widget-verse"
        const val KEY_TEXT = "text"
        const val KEY_REF  = "ref"
        private const val FALLBACK_TEXT = "凡自高的，必降为卑；自卑的，必升为高。"
        private const val FALLBACK_REF  = "马太福音 23:12"

        /** HomeVerseController.advance() 后调用，保存当前金句并刷新所有 Widget 实例 */
        fun push(context: Context, text: String, reference: String) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_TEXT, text)
                .putString(KEY_REF, reference)
                .apply()
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                ComponentName(context, DailyVerseWidget::class.java))
            if (ids.isNotEmpty()) {
                DailyVerseWidget().onUpdate(context, manager, ids)
            }
        }
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val text = prefs.getString(KEY_TEXT, FALLBACK_TEXT) ?: FALLBACK_TEXT
        val ref  = prefs.getString(KEY_REF,  FALLBACK_REF)  ?: FALLBACK_REF
        for (id in ids) {
            val views = RemoteViews(context.packageName, R.layout.widget_daily_verse)
            views.setTextViewText(R.id.widget_verse_text, text)
            views.setTextViewText(R.id.widget_reference, ref)
            manager.updateAppWidget(id, views)
        }
    }
}
