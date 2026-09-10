package me.askbible.parity

import me.askbible.native_.data.MemberAuthRules
import me.askbible.native_.data.MemberOAuthRules
import me.askbible.native_.data.MemberUser

/** 会员登录纯规则对拍 harness（core --memberauth），协议与 Swift 侧相同 */
fun memberAuthMain() {
    val lines = generateSequence(::readLine).toList()
    val out = ArrayList<String>()
    for (line in lines) {
        val f = line.split("\t")
        out.add(when (f[0]) {
            "err" -> MemberAuthRules.mapAuthError(f[1]).let { "${it.first}|${it.second}" }
            "name" -> {
                val meta = mapOf("full_name" to f[3], "name" to f[4], "display_name" to f[5]).filterValues { it.isNotEmpty() }
                MemberAuthRules.displayName(f[1], f[2], meta, f[6].ifEmpty { null })
            }
            "session" -> {
                val now = MemberAuthRules.parseIso(f[2])!!
                MemberAuthRules.parseSession(f[1], now)?.let { s -> "${s.sessionToken}|${s.user.id}|${s.user.email}|${s.user.name}|${s.user.locale ?: "-"}|${s.user.createdAt ?: "-"}" } ?: "null"
            }
            "norm" -> "${MemberAuthRules.normalizeDisplayName(f[1])}|${if (MemberAuthRules.isValidDisplayName(f[1])) 1 else 0}"
            "greet" -> MemberAuthRules.greeting(f[1].ifEmpty { null }?.let { MemberUser("u", "e@x", it) })
            "exp" -> MemberAuthRules.expiresAtIso(f[1].ifEmpty { null }?.toDouble(), MemberAuthRules.parseIso(f[2])!!)
            "pkce" -> MemberOAuthRules.pkceChallenge(f[1])
            "nonce" -> MemberOAuthRules.sha256Hex(f[1])
            "authurl" -> MemberOAuthRules.authorizeUrl(f[1], f[2], f[3])
            "cburl" -> if (MemberOAuthRules.isCallbackUrl(f[1])) "1" else "0"
            "cbparse" -> MemberOAuthRules.parseCallback(f[1]).let { p -> "${p.code ?: "-"}|${p.errorCode ?: "-"}|${p.accessToken ?: "-"}|${p.refreshToken ?: "-"}" }
            "oautherr" -> MemberOAuthRules.resolveError(f[1], f[2].ifEmpty { null }, f[3].ifEmpty { null }, f[4] == "1") ?: "null"
            "applename" -> MemberOAuthRules.appleFullName(f[1].ifEmpty { null }, f[2].ifEmpty { null }) ?: "null"
            "idcode" -> MemberOAuthRules.idTokenFailureCode(f[1], f[2])
            else -> "?"
        })
    }
    println("[" + out.joinToString(",") { jsonString(it) } + "]")
}
