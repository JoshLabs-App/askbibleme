plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "me.askbible.native_"
    compileSdk = 36

    defaultConfig {
        // 与 RN 版 me.askbible 错开，两个 App 可并排安装对比
        applicationId = "me.askbible.native"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true }

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
