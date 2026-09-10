package me.askbible.native_.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** 浏览器 OAuth 回调深链的中转（RN googleOAuthLinking：Linking 事件 → 待处理回调），Activity 收到就放这里，RootScreen 取走处理 */
object OAuthCallbackBus {
    var url by mutableStateOf<String?>(null)

    fun deliver(raw: String?) {
        val u = raw?.trim().orEmpty()
        if (u.isNotEmpty() && MemberOAuthRules.isCallbackUrl(u)) url = u
    }
}
