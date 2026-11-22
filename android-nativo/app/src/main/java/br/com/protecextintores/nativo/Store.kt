package br.com.protecextintores.nativo

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

/** Guarda no aparelho o login, a última lista de serviços e o tema escolhido. */
object Store {
    private lateinit var prefs: SharedPreferences

    fun init(context: Context) {
        prefs = context.getSharedPreferences("protec", Context.MODE_PRIVATE)
    }

    var token: String
        get() = prefs.getString("token", "") ?: ""
        set(value) {
            prefs.edit().putString("token", value).apply()
        }

    var profile: String
        get() = prefs.getString("profile", "") ?: ""
        set(value) {
            prefs.edit().putString("profile", value).apply()
        }

    var theme: String
        get() = prefs.getString("theme", "auto") ?: "auto"
        set(value) {
            prefs.edit().putString("theme", value).apply()
        }

    val deviceId: String
        get() {
            var id = prefs.getString("device", "") ?: ""
            if (id.isEmpty()) {
                id = UUID.randomUUID().toString()
                prefs.edit().putString("device", id).apply()
            }
            return id
        }

    fun clearSession() {
        prefs.edit().remove("token").remove("profile").apply()
    }
}
