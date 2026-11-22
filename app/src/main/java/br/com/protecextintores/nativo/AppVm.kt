package br.com.protecextintores.nativo

import android.app.Application
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

sealed class Screen {
    object Login : Screen()
    object Home : Screen()
    object Portal : Screen()
    data class Detail(val id: String) : Screen()
    data class Wizard(val id: String) : Screen()
}

class AppVm(app: Application) : AndroidViewModel(app) {
    var screen by mutableStateOf<Screen>(Screen.Login)
    var profile by mutableStateOf<Profile?>(null)
    var portalRole by mutableStateOf("")
    var portalState by mutableStateOf<JSONObject?>(null)
    var busy by mutableStateOf(false)
    var busyText by mutableStateOf("")
    var message by mutableStateOf<String?>(null)
    var tab by mutableIntStateOf(0)
    var employeePage by mutableIntStateOf(0)
    var themeMode by mutableStateOf(Store.theme)
    val wizard = WizardState()

    private var pendingVideoKey: String? = null
    private var pendingVideoFile: File? = null

    init {
        val token = Store.token
        val saved = Store.profile
        if (token.isNotEmpty() && saved.isNotEmpty()) {
            try {
                profile = Profile(JSONObject(saved))
                screen = Screen.Home
                refresh(silent = true)
            } catch (e: Exception) {
                Store.clearSession()
            }
        } else if (token.isNotEmpty() && Store.portalRole.isNotEmpty() && Store.portalState.isNotEmpty()) {
            try {
                portalRole = Store.portalRole
                portalState = JSONObject(Store.portalState)
                screen = Screen.Portal
                refreshPortal(silent = true)
            } catch (e: Exception) {
                Store.clearSession()
            }
        }
    }

    fun cycleTheme() {
        themeMode = when (themeMode) {
            "auto" -> "light"
            "light" -> "dark"
            else -> "auto"
        }
        Store.theme = themeMode
    }

    fun back() {
        val current = screen
        screen = when (current) {
            is Screen.Wizard -> Screen.Detail(current.id)
            is Screen.Detail -> Screen.Home
            else -> current
        }
    }

    fun open(id: String) {
        screen = Screen.Detail(id)
    }

    // ---------- entrar e atualizar ----------

    fun login(user: String, pass: String) {
        if (user.isBlank() || pass.isEmpty()) {
            message = "Informe usuário e senha."
            return
        }
        viewModelScope.launch {
            busy = true
            busyText = "Entrando…"
            try {
                val r = Api.login(user.trim(), pass)
                if (!r.ok) {
                    message = r.error.ifEmpty { "Não foi possível entrar." }
                    return@launch
                }
                Store.token = r.json.str("token")
                when (r.json.str("role")) {
                    "employee" -> {
                        busyText = "Carregando serviços…"
                        val b = Api.bootstrap(Store.token)
                        if (!b.ok) {
                            message = b.error.ifEmpty { "Não foi possível carregar os serviços." }
                            Store.clearSession()
                            return@launch
                        }
                        Store.profile = b.json.toString()
                        profile = Profile(b.json)
                        tab = 0
                        screen = Screen.Home
                    }
                    "admin", "seller" -> {
                        busyText = "Carregando painel…"
                        val b = Api.session(Store.token)
                        if (!b.ok) {
                            message = b.error.ifEmpty { "Não foi possível carregar o painel." }
                            Store.clearSession()
                            return@launch
                        }
                        portalRole = b.json.str("role")
                        portalState = b.json
                        Store.portalRole = portalRole
                        Store.portalState = b.json.toString()
                        screen = Screen.Portal
                    }
                    else -> { Store.clearSession(); message = "Esta conta não possui um painel de equipe." }
                }
            } finally {
                busy = false
            }
        }
    }

    fun logout(note: String? = null) {
        Store.clearSession()
        profile = null
        portalRole = ""
        portalState = null
        tab = 0
        employeePage = 0
        screen = Screen.Login
        message = note
    }

    fun refresh(silent: Boolean = false) {
        val token = Store.token
        if (token.isEmpty()) return
        viewModelScope.launch {
            if (!silent) {
                busy = true
                busyText = "Atualizando…"
            }
            try {
                val b = Api.bootstrap(token)
                if (Store.token != token) return@launch
                if (b.ok) {
                    Store.profile = b.json.toString()
                    profile = Profile(b.json)
                } else if (b.code == 401 || b.code == 403) {
                    logout("Sessão expirada. Entre de novo.")
                } else if (!silent) {
                    message = b.error.ifEmpty { "Não foi possível atualizar." }
                }
            } finally {
                if (!silent) busy = false
            }
        }
    }

    fun refreshPortal(silent: Boolean = false) {
        val token = Store.token
        if (token.isEmpty()) return
        viewModelScope.launch {
            if (!silent) { busy = true; busyText = "Atualizando…" }
            try {
                val result = Api.session(token)
                if (Store.token != token) return@launch
                if (result.ok) {
                    portalRole = result.json.str("role")
                    portalState = result.json
                    Store.portalRole = portalRole
                    Store.portalState = result.json.toString()
                } else if (result.code == 401 || result.code == 403) {
                    logout("Sessão expirada. Entre de novo.")
                } else if (!silent) {
                    message = result.error.ifEmpty { "Não foi possível atualizar o painel." }
                }
            } finally {
                if (!silent) busy = false
            }
        }
    }

    // ---------- operações do servidor ----------

    private fun baseOp(serviceId: String, kind: String, payload: JSONObject, version: String): JSONObject? {
        val p = profile ?: return null
        return JSONObject()
            .put("dataEpoch", p.dataEpoch)
            .put("id", UUID.randomUUID().toString())
            .put("accountKey", p.accountKey)
            .put("deviceId", Store.deviceId)
            .put("serviceId", serviceId)
            .put("kind", kind)
            .put("payload", payload)
            .put("createdAt", Instant.now().toString())
            .put("baseVersion", version)
    }

    /** Guarda no aparelho o serviço atualizado que o servidor devolveu. */
    private fun applyUpdate(resp: JSONObject) {
        val p = profile ?: return
        val root = JSONObject(p.j.toString())
        val updated = resp.optJSONObject("service")
        if (updated != null) {
            val id = updated.str("id")
            val available = JSONArray()
            for (o in root.optJSONArray("available").objects()) if (o.str("id") != id) available.put(o)
            root.put("available", available)
            val mine = JSONArray()
            var found = false
            for (o in root.optJSONArray("services").objects()) {
                if (o.str("id") == id) {
                    mine.put(updated)
                    found = true
                } else {
                    mine.put(o)
                }
            }
            if (!found) {
                val withNew = JSONArray()
                withNew.put(updated)
                for (o in root.optJSONArray("services").objects()) withNew.put(o)
                root.put("services", withNew)
            } else {
                root.put("services", mine)
            }
        }
        val stock = resp.optJSONObject("powderStock")
        if (stock != null) root.put("powderStock", stock)
        Store.profile = root.toString()
        profile = Profile(root)
    }

    /** Devolve a nova versão do serviço, ou null se o servidor recusou (a mensagem já foi mostrada). */
    private suspend fun handle(r: Api.ApiResult): String? {
        if (r.ok) {
            applyUpdate(r.json)
            return r.json.optJSONObject("service")?.str("syncVersion") ?: ""
        }
        if (r.code == 401) {
            logout("Sessão expirada. Entre de novo.")
            return null
        }
        message = r.error.ifEmpty { "Não foi possível enviar." }
        if (r.json.optBoolean("conflict", false)) refresh(silent = true)
        return null
    }

    private suspend fun runOp(serviceId: String, kind: String, payload: JSONObject, version: String): String? {
        val op = baseOp(serviceId, kind, payload, version) ?: return null
        return handle(Api.sync(Store.token, op))
    }

    private suspend fun runMedia(serviceId: String, need: NeedVideo, info: VideoInfo, version: String): String? {
        val payload = JSONObject()
            .put("itemIndex", need.index)
            .put("part", need.part)
            .put("blobKey", UUID.randomUUID().toString())
            .put("name", info.name)
            .put("mime", info.mime)
            .put("durationSeconds", info.seconds)
            .put("sha256", info.sha256)
            .put("size", info.size)
        val op = baseOp(serviceId, "media", payload, version) ?: return null
        return handle(Api.media(Store.token, op, info.file, info.mime, info.name))
    }

    private fun single(svc: Svc, kind: String, payload: JSONObject, done: String) {
        viewModelScope.launch {
            busy = true
            busyText = "Enviando…"
            try {
                if (runOp(svc.id, kind, payload, svc.version) != null) message = done
            } finally {
                busy = false
            }
        }
    }

    fun claim(svc: Svc) = single(svc, "claim", JSONObject(), "Serviço aceito.")

    fun updateStage(svc: Svc, status: String) = single(svc, "stage", JSONObject().put("status", status), "Etapa atualizada.")

    fun pause(svc: Svc, reason: String) = single(svc, "pause", JSONObject().put("reason", reason.trim()), "Serviço pausado.")

    fun resume(svc: Svc) = single(svc, "resume", JSONObject(), "Serviço retomado.")

    // ---------- conclusão em passos ----------

    fun startWizard(svc: Svc) {
        val p = profile ?: return
        val flow = p.flow
        val order = flow.stages
        if (flow.requireCompleteStage && order.indexOf(svc.status) < order.indexOf(flow.completeAt)) {
            message = "Antes de concluir, atualize a etapa até “${flow.completeAt}”."
            return
        }
        wizard.reset(svc)
        screen = Screen.Wizard(svc.id)
    }

    fun submitWizard(svc: Svc) {
        val p = profile ?: return
        val ctx = WizardCtx(svc, p, wizard)
        val steps = ctx.steps()
        for ((n, s) in steps.withIndex()) {
            val error = ctx.validate(s)
            if (error.isNotEmpty()) {
                wizard.error = error
                wizard.step = n
                wizard.goingBack = true
                return
            }
        }
        viewModelScope.launch {
            busy = true
            try {
                var version = svc.version
                val per = ctx.assign()
                busyText = "Registrando pintura…"
                version = runOp(svc.id, "painting", JSONObject().put("quantity", if (wizard.paintUse == true) wizard.paintQty else 0), version) ?: return@launch
                for ((i, item) in svc.items.withIndex()) {
                    val before = item.optJSONArray("replacedParts").strings().sorted().joinToString("|")
                    val parts = if (wizard.partsUse == true) per[i] else emptyList()
                    if (before != parts.sorted().joinToString("|")) {
                        busyText = "Registrando peças…"
                        val payload = JSONObject().put("itemIndex", i).put("notes", item.str("notes")).put("parts", jsonArrayOf(parts))
                        version = runOp(svc.id, "technical", payload, version) ?: return@launch
                    }
                }
                if (wizard.partsUse == true) {
                    val videos = ctx.needVideos().filter { wizard.videos[it.id] != null }
                    for ((n, need) in videos.withIndex()) {
                        val info = wizard.videos[need.id] ?: continue
                        busyText = "Enviando vídeo ${n + 1} de ${videos.size}…"
                        version = runMedia(svc.id, need, info, version) ?: return@launch
                    }
                }
                if (ctx.agents.isNotEmpty()) {
                    busyText = "Registrando pó químico…"
                    val usage = JSONArray()
                    for (agent in ctx.agents) {
                        val grams = (if (wizard.powderUse == true) (wizard.kg[agent.agent] ?: 0) else 0) * 1000
                        usage.put(JSONObject().put("agent", agent.agent).put("grams", grams))
                    }
                    version = runOp(svc.id, "powder", JSONObject().put("usage", usage), version) ?: return@launch
                }
                busyText = "Concluindo…"
                runOp(svc.id, "complete", JSONObject(), version) ?: return@launch
                message = "Execução enviada para revisão."
                screen = Screen.Detail(svc.id)
            } finally {
                busy = false
                busyText = ""
            }
        }
    }

    // ---------- vídeos ----------

    fun beginVideo(key: String, file: File?) {
        pendingVideoKey = key
        pendingVideoFile = file
    }

    fun videoCaptured() {
        val key = pendingVideoKey ?: return
        val file = pendingVideoFile ?: return
        processVideo(key, file, "video/mp4", file.name)
    }

    fun videoCancelled() {
        pendingVideoFile?.delete()
    }

    fun videoPicked(uri: Uri) {
        val key = pendingVideoKey ?: return
        val context = getApplication<Application>()
        viewModelScope.launch {
            busy = true
            busyText = "Preparando vídeo…"
            try {
                val dir = File(context.cacheDir, "videos").apply { mkdirs() }
                val file = File(dir, "pick-" + System.currentTimeMillis() + ".mp4")
                val mime = context.contentResolver.getType(uri) ?: "video/mp4"
                val copied = withContext(Dispatchers.IO) {
                    try {
                        context.contentResolver.openInputStream(uri)?.use { input -> file.outputStream().use { output -> input.copyTo(output) } }
                        true
                    } catch (e: Exception) {
                        false
                    }
                }
                if (!copied) {
                    message = "Não foi possível abrir o vídeo escolhido."
                    return@launch
                }
                finishVideo(key, file, mime, uri.lastPathSegment?.substringAfterLast('/') ?: file.name)
            } finally {
                busy = false
            }
        }
    }

    private fun processVideo(key: String, file: File, mime: String, name: String) {
        viewModelScope.launch {
            busy = true
            busyText = "Preparando vídeo…"
            try {
                finishVideo(key, file, mime, name)
            } finally {
                busy = false
            }
        }
    }

    private suspend fun finishVideo(key: String, file: File, mime: String, name: String) {
        val allowed = setOf("video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/3gpp2", "video/x-m4v")
        if (mime !in allowed) {
            message = "Formato de vídeo não aceito."
            file.delete()
            return
        }
        val size = file.length()
        if (size <= 0L) {
            message = "O vídeo está vazio."
            return
        }
        if (size > 50L * 1024 * 1024) {
            message = "O vídeo ultrapassa 50 MB."
            file.delete()
            return
        }
        val hash = withContext(Dispatchers.IO) { sha256(file) }
        val seconds = withContext(Dispatchers.IO) { durationOf(file) }
        if (seconds <= 0.0) {
            message = "Não foi possível ler a duração do vídeo."
            return
        }
        if (seconds > 60.0) {
            message = "O vídeo ultrapassa 60 segundos."
            file.delete()
            return
        }
        wizard.videos[key] = VideoInfo(file, name, mime, seconds, hash, size)
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun durationOf(file: File): Double {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            val ms = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            ms / 1000.0
        } catch (e: Exception) {
            0.0
        } finally {
            retriever.release()
        }
    }
}
