package me.askbible.native_.audio

import android.content.Context
import android.content.Intent
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * 前台媒体服务。没有它，锁屏一会儿系统就把进程冻结（logcat 里 ActivityManager: freezing me.askbible.native），
 * 后台播放随时断；RN 版靠 ShellPlaybackService 做同一件事。
 *
 * 播放器仍住在 Activity 进程里（RootScreen 的 remember），服务只是把它们的 MediaSession 挂上：
 * Media3 的 MediaSessionService 会在任一会话开播时自己 startForeground 并出媒体通知，全停后自己降级。
 */
class PlaybackService : MediaSessionService() {
    override fun onCreate() {
        super.onCreate()
        PlaybackSessions.attach(this)
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = PlaybackSessions.primary()

    override fun onTaskRemoved(rootIntent: Intent?) {
        // 用户从最近任务划掉：都没在播就停服务
        if (PlaybackSessions.all().none { it.player.playWhenReady }) stopSelf()
    }

    override fun onDestroy() {
        PlaybackSessions.detach(this)
        super.onDestroy()
    }
}

/** 进程内所有 MediaSession 的登记处；服务起来后新登记的会话也会补挂上去 */
object PlaybackSessions {
    private val sessions = ArrayList<MediaSession>()
    private var service: PlaybackService? = null

    fun register(session: MediaSession) {
        sessions += session
        service?.addSession(session)
    }

    fun unregister(session: MediaSession) {
        sessions -= session
        service?.removeSession(session)
    }

    fun all(): List<MediaSession> = sessions.toList()

    /** 正在播的那个优先；都没播给第一个 */
    fun primary(): MediaSession? = sessions.firstOrNull { it.player.isPlaying } ?: sessions.firstOrNull()

    internal fun attach(s: PlaybackService) {
        service = s
        for (session in sessions) s.addSession(session)
    }

    internal fun detach(s: PlaybackService) {
        if (service === s) service = null
    }

    /** 每次开播都叫一下：服务已在就是空操作 */
    fun ensureStarted(context: Context) {
        try {
            context.startService(Intent(context, PlaybackService::class.java))
        } catch (_: Exception) { }
    }
}
