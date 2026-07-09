package me.askbible.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.util.TypedValue
import android.widget.RemoteViews
import me.askbible.MainActivity
import me.askbible.R
import me.askbible.playback.ShellPlaybackService
import me.askbible.playback.ShellPlaybackSession
import org.json.JSONObject

class AskBibleDailyVerseWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    updateWidgets(context, appWidgetManager, appWidgetIds)
    WidgetAlarmScheduler.schedule(context)
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle,
  ) {
    appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context, newOptions))
  }

  override fun onEnabled(context: Context) {
    WidgetAlarmScheduler.schedule(context)
  }

  override fun onDisabled(context: Context) {
    WidgetAlarmScheduler.cancel(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      ACTION_NEXT_VERSE -> {
        val verses = loadVerses(context)
        if (verses.size > 1) {
          WidgetRotationState.advanceOnTap(context, verses.size)
        }
        refreshAllWidgets(context)
      }
      ACTION_ROTATE_TICK -> refreshAllWidgets(context)
      ACTION_TOGGLE_READING -> handleReadingToggle(context)
      ACTION_TOGGLE_MUSIC -> handleMusicToggle(context)
    }
  }

  companion object {
    private const val TAG = "AskBibleWidget"
    const val ACTION_NEXT_VERSE = "me.askbible.widget.ACTION_NEXT_VERSE"
    const val ACTION_ROTATE_TICK = "me.askbible.widget.ACTION_ROTATE_TICK"
    const val ACTION_TOGGLE_READING = "me.askbible.widget.ACTION_TOGGLE_READING"
    const val ACTION_TOGGLE_MUSIC = "me.askbible.widget.ACTION_TOGGLE_MUSIC"
    private const val FALLBACK_DEEP_LINK = "askbible://"
    // 点击后到真正开始播放前，最多把按钮显示为「启动中」多久（毫秒）。超时自动回落。
    private const val PENDING_TIMEOUT_MS = 15_000L
    private const val PENDING_READING_UNTIL_KEY = "askbible-widget-pending-reading-until"
    private const val PENDING_MUSIC_UNTIL_KEY = "askbible-widget-pending-music-until"

    private data class WidgetVerse(
      val line: String,
      val ref: String,
      val verseKey: String,
    )

    fun updateWidgets(
      context: Context,
      appWidgetManager: AppWidgetManager,
      appWidgetIds: IntArray,
    ) {
      for (appWidgetId in appWidgetIds) {
        val options = appWidgetManager.getAppWidgetOptions(appWidgetId)
        appWidgetManager.updateAppWidget(appWidgetId, buildRemoteViews(context, options))
      }
    }

    private fun refreshAllWidgets(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = android.content.ComponentName(context, AskBibleDailyVerseWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(component)
      if (ids.isNotEmpty()) updateWidgets(context, manager, ids)
    }

    /** 供播放状态变化 / toggle 后刷新经文挂件上的播放按钮图标。 */
    fun refreshAll(context: Context) {
      refreshAllWidgets(context)
    }

    private data class PlaybackSnapshot(
      val scripturePlaying: Boolean,
      val scriptureHasContent: Boolean,
      val scriptureDeepLink: String,
      val musicPlaying: Boolean,
      val musicHasContent: Boolean,
      val musicDeepLink: String,
    )

    private fun loadPlaybackSnapshot(context: Context): PlaybackSnapshot {
      val raw =
        context
          .getSharedPreferences(AskBibleWidgetPrefsModule.PREFS_NAME, Context.MODE_PRIVATE)
          .getString(AskBibleWidgetPrefsModule.READING_AUDIO_SNAPSHOT_KEY, null)
      if (raw.isNullOrBlank()) {
        return PlaybackSnapshot(false, false, "", false, false, FALLBACK_DEEP_LINK)
      }
      return try {
        val json = JSONObject(raw)
        PlaybackSnapshot(
          scripturePlaying = json.optBoolean("scripturePlaying", false),
          scriptureHasContent = json.optBoolean("scriptureHasContent", false),
          scriptureDeepLink = json.optString("scriptureDeepLink", "").trim(),
          musicPlaying = json.optBoolean("musicPlaying", false),
          musicHasContent = json.optBoolean("musicHasContent", false),
          musicDeepLink =
            json.optString("musicDeepLink", "").trim().ifEmpty { FALLBACK_DEEP_LINK },
        )
      } catch (_: Exception) {
        PlaybackSnapshot(false, false, "", false, false, FALLBACK_DEEP_LINK)
      }
    }

    private fun prefs(context: Context) =
      context.getSharedPreferences(AskBibleWidgetPrefsModule.PREFS_NAME, Context.MODE_PRIVATE)

    /** 标记某个按钮进入「启动中」态（收到点击、还没真正播放）。 */
    private fun setPending(context: Context, key: String, pending: Boolean) {
      prefs(context)
        .edit()
        .putLong(key, if (pending) System.currentTimeMillis() + PENDING_TIMEOUT_MS else 0L)
        .apply()
    }

    /** 当前是否仍处于「启动中」态（未超时）。playing=true 会立即清掉该态。 */
    private fun isPending(context: Context, key: String, playing: Boolean): Boolean {
      if (playing) {
        setPending(context, key, false)
        return false
      }
      val until = prefs(context).getLong(key, 0L)
      if (until <= 0L) return false
      if (System.currentTimeMillis() >= until) {
        setPending(context, key, false)
        return false
      }
      return true
    }

    private fun bindPlaybackButtons(context: Context, views: RemoteViews) {
      val snapshot = loadPlaybackSnapshot(context)
      // 进程被杀后 active=false，即使快照仍标记 playing 也回落成「待机」态。
      val sessionActive = ShellPlaybackSession.active

      val readingPlaying = snapshot.scripturePlaying && sessionActive
      val musicPlaying = snapshot.musicPlaying && sessionActive

      isPending(context, PENDING_READING_UNTIL_KEY, readingPlaying)
      bindPlaybackButton(
        context,
        views,
        buttonId = R.id.widget_verse_reading_toggle,
        idleGlyph = R.drawable.widget_audio_voice,
        activeGlyph = R.drawable.widget_audio_voice_active,
        playing = readingPlaying,
        descRes = R.string.widget_audio_reading_desc,
        action = ACTION_TOGGLE_READING,
        requestCode = 11,
      )
      isPending(context, PENDING_MUSIC_UNTIL_KEY, musicPlaying)
      bindPlaybackButton(
        context,
        views,
        buttonId = R.id.widget_verse_music_toggle,
        idleGlyph = R.drawable.widget_audio_music,
        activeGlyph = R.drawable.widget_audio_music_active,
        playing = musicPlaying,
        descRes = R.string.widget_audio_music_desc,
        action = ACTION_TOGGLE_MUSIC,
        requestCode = 12,
      )
    }

    private fun bindPlaybackButton(
      context: Context,
      views: RemoteViews,
      buttonId: Int,
      idleGlyph: Int,
      activeGlyph: Int,
      playing: Boolean,
      descRes: Int,
      action: String,
      requestCode: Int,
    ) {
      views.setImageViewResource(
        buttonId,
        if (playing) activeGlyph else idleGlyph,
      )
      views.setContentDescription(buttonId, context.getString(descRes))
      val bridgeAction =
        WidgetPlaybackBridge.widgetActionToBridgeAction(action) ?: return
      val launchIntent = WidgetPlaybackBridge.buildPlaybackActivityIntent(context, bridgeAction)
      views.setOnClickPendingIntent(
        buttonId,
        PendingIntent.getActivity(
          context,
          requestCode,
          launchIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        ),
      )
    }

    private fun handleReadingToggle(context: Context) {
      val snapshot = loadPlaybackSnapshot(context)
      val currentlyPlaying = snapshot.scripturePlaying && ShellPlaybackSession.active
      setPending(context, PENDING_READING_UNTIL_KEY, !currentlyPlaying)
      if (ShellPlaybackSession.active) {
        ShellPlaybackService.readingToggle(context)
      } else {
        WidgetPlaybackBridge.requestViaForegroundService(context, WidgetPlaybackBridge.ACTION_READING)
      }
      refreshAllWidgets(context)
    }

    private fun handleMusicToggle(context: Context) {
      val snapshot = loadPlaybackSnapshot(context)
      val currentlyPlaying = snapshot.musicPlaying && ShellPlaybackSession.active
      setPending(context, PENDING_MUSIC_UNTIL_KEY, !currentlyPlaying)
      if (ShellPlaybackSession.active) {
        ShellPlaybackService.musicToggle(context)
      } else {
        WidgetPlaybackBridge.requestViaForegroundService(context, WidgetPlaybackBridge.ACTION_MUSIC)
      }
      refreshAllWidgets(context)
    }

    private fun launchApp(context: Context, deepLink: String) {
      val uri = try {
        Uri.parse(deepLink)
      } catch (_: Exception) {
        null
      }
      val intent =
        Intent(context, MainActivity::class.java).apply {
          if (uri != null) {
            action = Intent.ACTION_VIEW
            data = uri
          }
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
      try {
        context.startActivity(intent)
      } catch (error: Exception) {
        Log.e(TAG, "Failed to launch app from widget playback button", error)
      }
    }

    private fun loadTextScale(context: Context): WidgetTypography.TextScale {
      val raw =
        context
          .getSharedPreferences(AskBibleWidgetPrefsModule.PREFS_NAME, Context.MODE_PRIVATE)
          .getString(AskBibleWidgetPrefsModule.TEXT_SCALE_KEY, null)
      return WidgetTypography.parseTextScale(raw)
    }

    private fun loadSnapshotLocale(context: Context): String {
      val raw =
        context
          .getSharedPreferences(AskBibleWidgetPrefsModule.PREFS_NAME, Context.MODE_PRIVATE)
          .getString(AskBibleWidgetPrefsModule.SNAPSHOT_KEY, null)
      if (raw.isNullOrBlank()) return "en"
      return try {
        JSONObject(raw).optString("locale", "en").trim().ifEmpty { "en" }
      } catch (_: Exception) {
        "en"
      }
    }

    private fun loadVerses(context: Context): List<WidgetVerse> {
      val raw =
        context
          .getSharedPreferences(AskBibleWidgetPrefsModule.PREFS_NAME, Context.MODE_PRIVATE)
          .getString(AskBibleWidgetPrefsModule.SNAPSHOT_KEY, null)
      if (raw.isNullOrBlank()) return emptyList()

      return try {
        val json = JSONObject(raw)
        json.optString("rotationPoolKey").trim().takeIf { it.isNotEmpty() }?.let {
          WidgetRotationState.syncRotationPool(context, it)
        } ?: json.optString("date").trim().takeIf { it.isNotEmpty() }?.let {
          WidgetRotationState.syncRotationPool(context, it)
        }
        json.optInt("rotationIntervalSec", 0).takeIf { it > 0 }?.let {
          WidgetRotationState.setRotationIntervalSec(context, it)
        }

        val versesArray = json.optJSONArray("verses")
        if (versesArray != null && versesArray.length() > 0) {
          buildList {
            for (i in 0 until versesArray.length()) {
              val item = versesArray.optJSONObject(i) ?: continue
              val lines = item.optJSONArray("lines")
              val line = WidgetVerseDisplay.joinVerseLines(lines)
              val ref = item.optString("ref").trim()
              val verseKey = item.optString("verseKey").trim()
              if (line.isNotEmpty()) {
                add(WidgetVerse(line, ref, verseKey))
              }
            }
          }
        } else {
          val lines = json.optJSONArray("lines")
          val line = WidgetVerseDisplay.joinVerseLines(lines)
          val ref = json.optString("ref").trim()
          val verseKey = json.optString("verseKey").trim()
          if (line.isNotEmpty()) listOf(WidgetVerse(line, ref, verseKey)) else emptyList()
        }
      } catch (_: Exception) {
        emptyList()
      }
    }

    private fun dp(context: Context, value: Int): Int {
      val density = context.resources.displayMetrics.density
      return (value * density + 0.5f).toInt()
    }

    private data class WidgetPanelIds(
      val lineId: Int,
      val refId: Int,
    )

    private fun panelIds(child: Int): WidgetPanelIds {
      return if (child == 0) {
        WidgetPanelIds(R.id.widget_verse_line_0, R.id.widget_verse_ref_0)
      } else {
        WidgetPanelIds(R.id.widget_verse_line_1, R.id.widget_verse_ref_1)
      }
    }

    private fun bindVersePanel(
      views: RemoteViews,
      panel: WidgetPanelIds,
      verse: WidgetVerse,
      locale: String,
      typography: WidgetTypography.Resolved,
    ) {
      views.setTextViewText(
        panel.lineId,
        WidgetVerseDisplay.prepareVerseText(verse.line),
      )
      WidgetVerseDisplay.applyChineseJustification(views, panel.lineId, locale)
      views.setTextViewTextSize(panel.lineId, TypedValue.COMPLEX_UNIT_SP, typography.verseFontSp)
      views.setInt(panel.lineId, "setMaxLines", typography.maxLines)

      val refVisible = verse.ref.isNotBlank()
      views.setViewVisibility(
        panel.refId,
        if (refVisible) android.view.View.VISIBLE else android.view.View.GONE,
      )
      if (refVisible) {
        views.setTextViewText(panel.refId, verse.ref)
        views.setTextViewTextSize(panel.refId, TypedValue.COMPLEX_UNIT_SP, typography.refFontSp)
      }
    }

    private fun applyVerseWithFade(
      views: RemoteViews,
      context: Context,
      verse: WidgetVerse,
      verseIndex: Int,
      locale: String,
      typography: WidgetTypography.Resolved,
    ) {
      val lastIndex = WidgetRotationState.lastRenderedIndex(context)
      val currentChild = WidgetRotationState.flipperChild(context)
      val indexChanged = lastIndex >= 0 && lastIndex != verseIndex

      if (!indexChanged) {
        bindVersePanel(views, panelIds(currentChild), verse, locale, typography)
        views.setDisplayedChild(R.id.widget_verse_flipper, currentChild)
        WidgetRotationState.markRendered(context, verseIndex, currentChild)
        return
      }

      val nextChild = 1 - currentChild
      bindVersePanel(views, panelIds(nextChild), verse, locale, typography)
      views.setDisplayedChild(R.id.widget_verse_flipper, currentChild)
      views.showNext(R.id.widget_verse_flipper)
      WidgetRotationState.markRendered(context, verseIndex, nextChild)
    }

    private fun applyWidgetContentPadding(views: RemoteViews, context: Context, isSmall: Boolean) {
      if (isSmall) {
        views.setViewPadding(
          R.id.widget_content,
          dp(context, 22),
          dp(context, 20),
          dp(context, 22),
          dp(context, 20),
        )
      } else {
        views.setViewPadding(
          R.id.widget_content,
          dp(context, 28),
          dp(context, 24),
          dp(context, 28),
          dp(context, 24),
        )
      }
    }

    private fun buildRemoteViews(
      context: Context,
      options: Bundle? = null,
    ): RemoteViews {
      return try {
        buildRemoteViewsInternal(context, options)
      } catch (error: Exception) {
        Log.e(TAG, "Failed to build widget RemoteViews", error)
        fallbackRemoteViews(context)
      }
    }

    private fun buildRemoteViewsInternal(
      context: Context,
      options: Bundle?,
    ): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_daily_verse)
      val verses = loadVerses(context)
      val locale = loadSnapshotLocale(context)
      val minWidth = options?.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) ?: 110
      val isSmall = WidgetTypography.isSmallWidget(minWidth)
      val textScale = loadTextScale(context)

      val verseIndex =
        if (verses.isNotEmpty()) WidgetRotationState.currentIndex(context, verses.size) else 0
      val verse =
        verses.getOrNull(verseIndex)
          ?: WidgetVerse("Tap to open", "", "")

      val typography = WidgetTypography.resolve(verse.line, isSmall, textScale)
      applyWidgetContentPadding(views, context, isSmall)
      applyVerseWithFade(views, context, verse, verseIndex, locale, typography)

      val clickPendingIntent =
        if (verses.isEmpty()) {
          val launchIntent =
            Intent(context, MainActivity::class.java).apply {
              flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
          PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          )
        } else {
          val uri = WidgetVerseKey.readChapterUri(verse.verseKey)
          val launchIntent =
            Intent(context, MainActivity::class.java).apply {
              action = Intent.ACTION_VIEW
              if (uri != null) data = uri
              flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
          PendingIntent.getActivity(
            context,
            verseIndex + 100,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
          )
        }
      views.setOnClickPendingIntent(R.id.widget_root, clickPendingIntent)
      bindPlaybackButtons(context, views)
      return views
    }

    private fun fallbackRemoteViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.widget_daily_verse)
      val panel = panelIds(0)
      views.setTextViewText(panel.lineId, "Tap to open")
      views.setViewVisibility(panel.refId, android.view.View.GONE)
      views.setViewVisibility(R.id.widget_verse_audio_bar, android.view.View.GONE)
      views.setDisplayedChild(R.id.widget_verse_flipper, 0)
      val launchIntent =
        Intent(context, MainActivity::class.java).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
      val pendingIntent =
        PendingIntent.getActivity(
          context,
          0,
          launchIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
      views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
      return views
    }
  }
}
