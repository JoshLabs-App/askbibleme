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
import me.askbible.native_.data.AppLocale
import me.askbible.native_.data.Parchment
import me.askbible.native_.data.SiteCopy
import me.askbible.native_.ui.toColor

/**
 * 进 App / 回前台自检或用户在侧栏手动点「检查更新」发现新版时弹出羊皮纸更新卡片。
 * 只在 `web` 变体生效（见 AppUpdater 的注释），Play 版这里永远拿到 null。
 */
@Composable
fun UpdateGate(locale: AppLocale = AppLocale.current, theme: Parchment = me.askbible.native_.ui.LocalParchment.current) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) { AppUpdater.checkOutcome(context) }

    val pending = AppUpdater.pendingInfo ?: return
    var downloading by remember(pending.versionCode) { mutableStateOf(false) }
    var progress by remember(pending.versionCode) { mutableFloatStateOf(0f) }
    var failed by remember(pending.versionCode) { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { if (!downloading) AppUpdater.skip(context, pending) },
        containerColor = theme.surfaceSolid.toColor(),
        titleContentColor = theme.ink.toColor(),
        textContentColor = theme.inkSoft.toColor(),
        title = { Text(SiteCopy.f("native.updateTitle", mapOf("version" to pending.version), locale)) },
        text = {
            Column(Modifier.fillMaxWidth()) {
                Text(
                    when {
                        failed -> SiteCopy.t("native.updateFailed", locale)
                        downloading -> SiteCopy.t("native.updateDownloading", locale)
                        pending.notes.isNotBlank() -> pending.notes
                        else -> SiteCopy.t("native.updateHintAndroid", locale)
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
                        if (ok) AppUpdater.clearPending() else failed = true
                    }
                },
            ) { Text(if (failed) SiteCopy.t("native.updateRetry", locale) else SiteCopy.t("native.updateNow", locale), color = theme.accentOt.toColor()) }
        },
        dismissButton = {
            TextButton(
                enabled = !downloading,
                onClick = { AppUpdater.skip(context, pending) },
            ) { Text(SiteCopy.t("native.updateLater", locale), color = theme.muted.toColor()) }
        },
    )
}
