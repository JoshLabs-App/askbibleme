import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "me.askbible.native_"
    compileSdk = 36

    defaultConfig {
        // Josh 2026-09-14：Play 沿用 me.askbible 顶替 RN 版；debug 加后缀仍是 me.askbible.native，可与商店版并排装
        applicationId = "me.askbible"
        minSdk = 26
        targetSdk = 36
        // 必须大于 Play 上 RN 版已用过的 versionCode（RN android/app/build.gradle = 238）
        versionCode = 241
        versionName = "1.0.44"
    }

    // 与 RN 同一把 upload key：凭据只在本机 apps/askbible-mobile/android/keystore.properties（gitignore）
    val uploadProps = rootProject.file("../askbible-mobile/android/keystore.properties")
    signingConfigs {
        if (uploadProps.exists()) create("upload") {
            val p = Properties().apply { uploadProps.inputStream().use { load(it) } }
            storeFile = rootProject.file("../askbible-mobile/android/app/" + p.getProperty("MYAPP_UPLOAD_STORE_FILE"))
            storePassword = p.getProperty("MYAPP_UPLOAD_STORE_PASSWORD")
            keyAlias = p.getProperty("MYAPP_UPLOAD_KEY_ALIAS")
            keyPassword = p.getProperty("MYAPP_UPLOAD_KEY_PASSWORD")
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".native"
            buildConfigField("boolean", "SELF_UPDATE", "false")
        }
        release {
            isMinifyEnabled = false
            signingConfigs.findByName("upload")?.let { signingConfig = it }
            // Play 版严禁自带「下载 APK 就地安装」，会被下架；商店渠道由 Play 自己推更新
            buildConfigField("boolean", "SELF_UPDATE", "false")
        }
        /**
         * 下载页（askbible-media.joshlabs.app/download.html）分发的包。
         * 和 release 一样的 applicationId 和签名（所以能覆盖升级老的网页版），
         * 唯一区别是开了 SELF_UPDATE：进 App 查 version.json，有新版就弹窗下载安装。
         * deploy_android.py 走的就是这个变体（.android-deploy.json 的 gradle_task）。
         */
        create("web") {
            initWith(getByName("release"))
            matchingFallbacks += listOf("release")
            buildConfigField("boolean", "SELF_UPDATE", "true")
        }
        /**
         * 侧载到真机用：和 release 完全一样（同一把 upload key、不开 minify），
         * 只是 applicationId 带 .native 后缀，能和商店版 me.askbible 并排装。
         *
         * 为什么要它：手机上的 me.askbible 是 Play 装的，被 Play App Signing 重签过，
         * 本地 upload key 打的包覆盖不上去（INSTALL_FAILED_UPDATE_INCOMPATIBLE），
         * 而卸载重装会清掉 Josh 手机上的登录和设置。
         * 「装到手机一律 Release」（APP/CLAUDE.md 7.0）和「别清真机数据」两条规矩，
         * 靠这个变体同时满足。对应 8.2 里的 gradle_task: assembleSideloadRelease。
         */
        create("sideload") {
            initWith(getByName("release"))
            applicationIdSuffix = ".native"
            matchingFallbacks += listOf("release")
            buildConfigField("boolean", "SELF_UPDATE", "false")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }

    // 圣经库不能被压缩 —— SQLiteDatabase 要按文件随机读，压缩过的 asset 打不开
    androidResources { noCompress += listOf("sqlite") }
}

// core 为了 JVM 对拍带了 org.json；Android 框架自带同名类，这里排除掉避免重复
configurations.all { exclude(group = "org.json", module = "json") }

dependencies {
    implementation(project(":core"))
    implementation(platform("androidx.compose:compose-bom:2025.01.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
    // Google 登录走 Supabase 浏览器 OAuth（RN expo-web-browser.openAuthSessionAsync = Custom Tabs）
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.media3:media3-session:1.5.1")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
