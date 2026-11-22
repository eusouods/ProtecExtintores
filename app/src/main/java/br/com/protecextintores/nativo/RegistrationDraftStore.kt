package br.com.protecextintores.nativo

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.nio.charset.StandardCharsets.UTF_8
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Drafts can contain contact details; keep them scoped to the authenticated account. */
internal class RegistrationDraftStore(context: Context) {
    private val preferences = context.getSharedPreferences("protec_registration", Context.MODE_PRIVATE)
    private val keyAlias = "protec.registration.v1"

    fun read(account: String): JSONObject? {
        val encrypted = preferences.getString(account, null) ?: return null
        val (iv, bytes) = encrypted.split('.', limit = 2)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
        cipher.updateAAD(account.toByteArray(UTF_8))
        return JSONObject(String(cipher.doFinal(Base64.decode(bytes, Base64.NO_WRAP)), UTF_8))
    }

    fun write(account: String, draft: JSONObject): Boolean {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key())
        cipher.updateAAD(account.toByteArray(UTF_8))
        val bytes = cipher.doFinal(draft.toString().toByteArray(UTF_8))
        return preferences.edit().putString(account, listOf(cipher.iv, bytes).joinToString(".") {
            Base64.encodeToString(it, Base64.NO_WRAP)
        }).commit()
    }

    fun clear(account: String): Boolean = preferences.edit().remove(account).commit()

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(keyAlias, null) as? SecretKey)?.let { return it }
        val spec = KeyGenParameterSpec.Builder(keyAlias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build()
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(spec)
            generateKey()
        }
    }
}
