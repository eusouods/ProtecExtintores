package br.com.protecextintores.nativo

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Conversa com a mesma API (Cloudflare) que o site usa. */
object Api {
    const val BASE = "https://protecextintores-api.eusouods.workers.dev"

    class ApiResult(val code: Int, val json: JSONObject) {
        val ok: Boolean get() = code in 200..299
        val error: String get() = json.str("error")
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(180, TimeUnit.SECONDS)
        .build()

    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val mediaClient by lazy { client.newBuilder().followRedirects(false).followSslRedirects(false).build() }

    private suspend fun exec(request: Request): ApiResult = withContext(Dispatchers.IO) {
        try {
            client.newCall(request).execute().use { response ->
                val text = response.body?.string().orEmpty()
                val json = try {
                    JSONObject(text)
                } catch (e: Exception) {
                    JSONObject()
                }
                ApiResult(response.code, json)
            }
        } catch (e: IOException) {
            ApiResult(0, JSONObject().put("error", "Sem conexão com o servidor. Verifique a internet e tente de novo."))
        }
    }

    suspend fun login(username: String, password: String): ApiResult {
        val body = JSONObject().put("username", username).put("password", password).toString().toRequestBody(jsonType)
        return exec(Request.Builder().url("$BASE/api/login").post(body).build())
    }

    suspend fun bootstrap(token: String): ApiResult =
        exec(Request.Builder().url("$BASE/api/offline/bootstrap").header("Authorization", "Bearer $token").get().build())

    suspend fun session(token: String): ApiResult =
        exec(Request.Builder().url("$BASE/api/session").header("Authorization", "Bearer $token").get().build())

    suspend fun teamSection(token: String, path: String): ApiResult =
        exec(Request.Builder().url("$BASE$path").header("Authorization", "Bearer $token").get().build())

    suspend fun postSection(token: String, path: String, payload: JSONObject): ApiResult =
        postJson(token, path, payload.toString())

    private suspend fun postJson(token: String, path: String, json: String): ApiResult =
        exec(Request.Builder().url("$BASE$path").header("Authorization", "Bearer $token")
            .post(json.toRequestBody(jsonType)).build())

    suspend fun registerService(token: String, admin: Boolean, operation: String): ApiResult =
        postJson(token, if (admin) "/api/offline/admin/sync" else "/api/offline/sync", operation)

    suspend fun downloadEvidence(token: String, address: String, file: File): Boolean = withContext(Dispatchers.IO) {
        val home = BASE.toHttpUrl()
        val url = address.toHttpUrlOrNull() ?: return@withContext false
        if (url.host != home.host || url.scheme != home.scheme || url.port != home.port ||
            !url.encodedPath.startsWith("/media/service-media/") || token.isEmpty()) return@withContext false
        try {
            mediaClient.newCall(Request.Builder().url(url).header("Authorization", "Bearer $token").build()).execute().use { response ->
                val body = response.body ?: return@use false
                val max = 50L * 1024 * 1024
                if (!response.isSuccessful || body.contentLength() > max) return@use false
                body.byteStream().use { input ->
                    file.outputStream().use { output ->
                        val buffer = ByteArray(32 * 1024)
                        var bytes = 0L
                        while (true) {
                            kotlinx.coroutines.currentCoroutineContext().ensureActive()
                            val n = input.read(buffer)
                            if (n < 0) break
                            bytes += n
                            if (bytes > max) throw IOException("Limite excedido")
                            output.write(buffer, 0, n)
                        }
                        bytes > 0
                    }
                }
            }
        } catch (_: IOException) {
            false
        }
    }

    suspend fun sync(token: String, operation: JSONObject): ApiResult {
        val body = operation.toString().toRequestBody(jsonType)
        return exec(Request.Builder().url("$BASE/api/offline/sync").header("Authorization", "Bearer $token").post(body).build())
    }

    suspend fun media(token: String, operation: JSONObject, file: File, mime: String, name: String): ApiResult {
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("operation", operation.toString())
            .addFormDataPart("file", name, file.asRequestBody(mime.toMediaType()))
            .build()
        return exec(Request.Builder().url("$BASE/api/offline/media").header("Authorization", "Bearer $token").post(body).build())
    }
}
