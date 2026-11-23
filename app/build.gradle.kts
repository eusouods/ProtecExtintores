plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "br.com.protecextintores.nativo"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.protecextintores.nativo"
        minSdk = 26
        targetSdk = 35
        versionCode = 15
        versionName = "2.8.0"
    }

    // A chave de distribuição é injetada pelo CI/Gradle; nunca a versione no Git.
    signingConfigs {
        create("release") {
            storeFile = file(providers.gradleProperty("PROTEC_STORE_FILE").orNull ?: "missing-keystore.p12")
            storePassword = providers.gradleProperty("PROTEC_STORE_PASSWORD").orNull
            keyAlias = providers.gradleProperty("PROTEC_KEY_ALIAS").orNull
            keyPassword = providers.gradleProperty("PROTEC_KEY_PASSWORD").orNull
            storeType = "pkcs12"
        }
    }

    buildTypes {
        getByName("debug") {
            // Usa a chave debug local. O APK de distribuição é o release, assinado no CI.
        }
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf(
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
            "-opt-in=androidx.compose.animation.ExperimentalAnimationApi",
            "-opt-in=androidx.compose.foundation.ExperimentalFoundationApi",
            "-opt-in=androidx.compose.foundation.layout.ExperimentalLayoutApi"
        )
    }

    buildFeatures {
        compose = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
