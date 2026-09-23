package me.askbible.native_.update

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import me.askbible.native_.data.Parchment
import me.askbible.native_.ui.toColor

/**
 * 进 App 时静默问一次 version.json，有新版才弹。
 * 只在 `web` 变体生效（见 AppUpdater 的注释），Play 版这里永远拿到 null。
 */
@Composable
fun UpdateGate(theme: Parchment = Parchment.light) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var info by remember { mutableStateOf<AppUpdater.Info?>(null) }
    var downloading by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }
    var failed by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { info = AppUpdater.check(context) }

    val pending = info ?: return
    AlertDialog(
        onDismissRequest = { if (!downloading) { AppUpdater.skip(context, pending); info = null } },
        containerColor = theme.surfaceSolid.toColor(),
        titleContentColor = theme.ink.toColor(),
        textContentColor = theme.inkSoft.toColor(),
        title = { Text("有新版本 ${pending.version}") },
        text = {
            Column(Modifier.fillMaxWidth()) {
                Text(
                    when {
                        failed -> "下载失败了，检查一下网络再试。"
                        downloading -> "正在下载…"
                        pending.notes.isNotBlank() -> pending.notes
                        else -> "更新后请在弹出的安装界面点「安装」。"
                    }
                )
                if (downloading) {
                    LinearProgressIndicator(
                        progress = { progress },
                        color = theme.accentOt.toColor(),
                        modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !downloading,
                onClick = {
                    if (AppUpdater.needsInstallPermission(context)) {
                        // 先去系统开关页授权「安装未知来源应用」，回来再点一次
                        AppUpdater.openInstallPermission(context)
                        return@TextButton
                    }
                    failed = false
                    downloading = true
                    scope.launch {
                        val ok = AppUpdater.downloadAndInstall(context, pending) { progress = it }
                        downloading = false
                        if (ok) info = null else failed = true
                    }
                },
            ) { Text(if (failed) "重试" else "立即更新", color = theme.accentOt.toColor()) }
        },
        dismissButton = {
            TextButton(
                enabled = !downloading,
                onClick = { AppUpdater.skip(context, pending); info = null },
            ) { Text("以后再说", color = theme.muted.toColor()) }
        },
    )
}
