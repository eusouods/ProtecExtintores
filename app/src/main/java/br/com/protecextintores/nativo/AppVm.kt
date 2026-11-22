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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONException
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
    data class Registration(val parent: Screen) : Screen()
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
    internal var registrationCatalog by mutableStateOf<RegistrationCatalog?>(null)
        private set
    internal var registrationDraft by mutableStateOf(newRegistrationDraft())
        private set
    internal var registrationError by mutableStateOf("")
        private set
    internal var registrationSaved by mutableStateOf(false)
        private set

    private val drafts = RegistrationDraftStore(app)
    private val draftLock = Mutex()
    private var registrationAccount = ""
    private var waitingToSaveDraft = false

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
        if (busy) return
        val current = screen
        screen = when (current) {
            is Screen.Wizard -> Screen.Detail(current.id)
            is Screen.Detail -> Screen.Home
            is Screen.Registration -> current.parent
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
        val oldToken = Store.token
        Store.clearSession()
        if (oldToken.isNotBlank()) viewModelScope.launch { Api.logout(oldToken) }
        profile = null
        portalRole = ""
        portalState = null
        registrationCatalog = null
        registrationDraft = newRegistrationDraft()
        registrationError = ""
        registrationAccount = ""
        tab = 0
        employeePage = 0
        screen = Screen.Login
        message = note
    }

    fun startRegistration() {
        if (busy || screen !in listOf(Screen.Home, Screen.Portal)) return
        val parent = screen
        registrationCatalog = null
        registrationDraft = newRegistrationDraft()
        registrationError = ""
        registrationSaved = false
        registrationAccount = ""
        screen = Screen.Registration(parent)
        loadRegistration()
    }

    fun loadRegistration() {
        val registration = screen as? Screen.Registration ?: return
        if (busy) return
        val token = Store.token
        val admin = portalRole == "admin"
        val path = if (admin) "/api/offline/admin/registration-catalog" else "/api/offline/bootstrap"
        busy = true
        busyText = "Carregando catálogo…"
        viewModelScope.launch {
            try {
                val response = Api.teamSection(token, path)
                if (token != Store.token || screen != registration) return@launch
                if (response.code == 401) {
                    logout("Sessão expirada. Entre de novo.")
                    return@launch
                }
                val catalog = RegistrationCatalog(response.json)
                if (!response.ok || catalog.account.isBlank() || catalog.data.optInt("version") < 8) {
                    registrationError = if (admin && response.code == 404) {
                        "Atualize a API da Protec para registrar ordens como administrador pelo app."
                    } else response.error.ifEmpty { "Catálogo indisponível. Confira a conexão e tente novamente." }
                    return@launch
                }
                if (registrationAccount != catalog.account) {
                    val saved = runCatching { withContext(Dispatchers.IO) { draftLock.withLock { drafts.read(catalog.account) } } }
                    if (token != Store.token || screen != registration) return@launch
                    if (saved.isFailure) {
                        registrationError = "O rascunho deste aparelho não pôde ser aberto. Tente novamente."
                        return@launch
                    }
                    registrationDraft = saved.getOrNull() ?: newRegistrationDraft()
                    registrationSaved = saved.getOrNull() != null
                }
                registrationAccount = catalog.account
                registrationError = ""
                registrationCatalog = catalog
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                if (token == Store.token && screen == registration) {
                    registrationError = "Não foi possível carregar o catálogo. Tente novamente."
                }
            } finally {
                busy = false
            }
        }
    }

    internal fun editRegistration(change: JSONObject.() -> Unit) {
        if (busy || registrationDraft.has("pendingOperation")) return
        val next = JSONObject(registrationDraft.toString()).apply(change)
        registrationDraft = next
        registrationError = ""
        registrationSaved = false
        val account = registrationAccount
        if (account.isBlank() || waitingToSaveDraft) return
        waitingToSaveDraft = true
        viewModelScope.launch {
            // Save the newest snapshot when writes are already queued by fast typing.
            while (registrationAccount == account && !busy) {
                val snapshot = registrationDraft
                val saved = persistRegistration(account, snapshot)
                if (registrationAccount != account) break
                if (registrationDraft === snapshot) {
                    registrationSaved = saved
                    if (!saved) registrationError = "Não foi possível salvar o rascunho neste aparelho."
                    break
                }
            }
            waitingToSaveDraft = false
        }
    }

    fun registrationStep(step: Int) {
        val catalog = registrationCatalog ?: return
        val current = registrationDraft.optInt("step").coerceIn(0, 3)
        if (step !in 0..3 || step == current || busy || registrationDraft.has("pendingOperation")) return
        if (step > current) {
            for (index in current until step) {
                val issue = catalog.validate(registrationDraft, index) ?: continue
                if (index != current) editRegistration { put("step", index) }
                registrationError = issue
                return
            }
        }
        editRegistration { put("step", step) }
    }

    fun submitRegistration() {
        val registration = screen as? Screen.Registration ?: return
        val catalog = registrationCatalog ?: return
        if (busy) return
        val token = Store.token
        val account = catalog.account
        val admin = portalRole == "admin"
        var draft = registrationDraft
        var operation = draft.str("pendingOperation")
        if (operation.isBlank()) {
            val issue = catalog.validate(draft, 3)
            if (issue != null) {
                registrationError = issue
                return
            }
            val payload = try {
                catalog.payload(draft, admin)
            } catch (_: JSONException) {
                registrationError = "Não foi possível preparar a ordem. Revise os dados preenchidos."
                return
            }
            operation = JSONObject()
                .put("accountKey", account)
                .put("dataEpoch", catalog.epoch)
                .put("id", UUID.randomUUID().toString())
                .put("serviceId", if (admin) "admin-state" else payload.str("serviceId"))
                .put("deviceId", Store.deviceId)
                .put("kind", if (admin) "admin-create" else "create")
                .put("createdAt", Instant.now().toString())
                .put("payload", payload)
                .toString()
            draft = JSONObject(draft.toString()).put("pendingOperation", operation)
        }
        busy = true
        busyText = "Registrando ordem…"
        registrationError = ""
        viewModelScope.launch {
            try {
                if (!persistRegistration(account, draft)) {
                    registrationError = "Não foi possível gravar a ordem neste aparelho. O envio não foi iniciado."
                    return@launch
                }
                registrationDraft = draft
                registrationSaved = true
                val response = Api.registerService(token, admin, operation)
                if (token != Store.token || screen != registration) return@launch
                if (response.code == 401) {
                    logout("Sessão expirada. A ordem foi guardada. Entre de novo para conferir o envio.")
                    return@launch
                }
                if (response.ok && response.json.optBoolean("ok")) {
                    val removed = runCatching { withContext(Dispatchers.IO) { draftLock.withLock { drafts.clear(account) } } }
                        .getOrDefault(false)
                    val service = response.json.optJSONObject("service")
                    val code = service?.str("code").orEmpty()
                    if (token != Store.token || screen != registration) return@launch
                    if (!removed) {
                        registrationError = "A ordem foi confirmada, mas o rascunho não pôde ser limpo. Repita a verificação para concluir."
                        return@launch
                    }
                    registrationDraft = newRegistrationDraft()
                    registrationCatalog = null
                    message = if (code.isBlank()) "Ordem registrada." else "Ordem registrada · $code"
                    if (registration.parent == Screen.Home) {
                        employeePage = 1
                        tab = 0
                        screen = Screen.Home
                        if (service == null || runCatching { applyUpdate(response.json) }.isFailure) refresh(silent = true)
                    } else {
                        screen = Screen.Portal
                        refreshPortal(silent = true)
                    }
                } else if (response.code in 400..499 && !response.json.optBoolean("retry")) {
                    val editable = JSONObject(draft.toString()).apply { remove("pendingOperation") }
                    if (persistRegistration(account, editable)) registrationDraft = editable
                    registrationError = response.error.ifEmpty { "A API recusou esta ordem. Confira os dados." }
                    if (response.json.optBoolean("dataReset")) registrationCatalog = null
                } else {
                    registrationError = "Confirmação pendente. Toque em Verificar envio para repetir a mesma operação sem duplicar a ordem."
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                if (token == Store.token && screen == registration) {
                    registrationError = if (registrationDraft.has("pendingOperation")) {
                        "Não foi possível confirmar o envio. Use Verificar envio para repetir a mesma operação."
                    } else {
                        "Não foi possível enviar a ordem. Seu rascunho continua aberto."
                    }
                }
            } finally {
                busy = false
            }
        }
    }

    private suspend fun persistRegistration(account: String, draft: JSONObject): Boolean = runCatching {
        withContext(Dispatchers.IO) { draftLock.withLock { drafts.write(account, draft) } }
    }.getOrDefault(false)

    internal fun saveAdminReview(service: JSONObject, updates: JSONObject, done: () -> Unit) {
        val fields = listOf("clientName", "clientPhone", "clientEmail", "date", "nextMaintenanceMonth", "notes", "items",
            "maintenanceValid", "hydroValid")
        saveAdminServiceFields(service, updates, fields, "Dados e validades revisados pelo administrador",
            updates.str("reviewNotes"), mirrorOrder = true, done = done)
    }

    internal fun linkAdminContacts(service: JSONObject, clientId: String, sellerId: String, done: () -> Unit) {
        val state = portalState?.optJSONObject("state") ?: return
        val client = state.optJSONArray("clients").objects().firstOrNull { it.str("id") == clientId && clientId.isNotBlank() }
        val seller = state.optJSONArray("sellers").objects().firstOrNull {
            it.str("id") == sellerId && sellerId.isNotBlank() && it.optBoolean("active", true)
        }
        if (clientId.isNotBlank() && client == null || sellerId.isNotBlank() && seller == null) {
            message = "Selecione contatos ativos do cadastro."
            return
        }
        val updates = JSONObject().put("clientId", clientId).put("sellerId", sellerId).put("sellerName", seller?.str("name").orEmpty())
        if (client != null) {
            updates.put("clientName", client.str("name")).put("clientPhone", client.str("phone"))
                .put("clientEmail", client.str("email")).put("clientSource", "customer")
        }
        val fields = listOf("clientId", "sellerId", "sellerName", "clientName", "clientPhone", "clientEmail", "clientSource")
        val description = "Cliente: ${client?.str("name") ?: "Contato informado"}. Vendedor: ${seller?.str("name") ?: "Sem atribuição"}."
        saveAdminServiceFields(service, updates, fields, "Vínculos administrativos atualizados", description, done = done)
    }

    private fun saveAdminServiceFields(
        service: JSONObject, updates: JSONObject, fields: List<String>, action: String,
        description: String, mirrorOrder: Boolean = false, done: () -> Unit
    ) {
        val state = portalState?.optJSONObject("state") ?: return
        val id = service.str("id")
        val changes = JSONArray()
        fun addChange(group: String, record: JSONObject, field: String, after: Any) {
            if (record.opt(field)?.toString() == after.toString()) return
            val previous = JSONObject().put("exists", record.has(field))
            if (record.has(field)) previous.put("value", record.opt(field))
            changes.put(JSONObject()
                .put("path", JSONArray(listOf(group, record.str("id"), field)))
                .put("before", previous)
                .put("after", JSONObject().put("exists", true).put("value", after)))
        }
        for (field in fields) {
            updates.opt(field)?.let { addChange("services", service, field, it) }
        }
        val order = state.optJSONArray("orders").objects().firstOrNull { it.str("code") == service.str("code") }
        if (mirrorOrder && order != null) {
            for ((from, to) in listOf("clientName" to "name", "clientPhone" to "phone", "clientEmail" to "email", "notes" to "details")) {
                if (updates.has(from)) addChange("orders", order, to, updates.str(from))
            }
        }
        if (changes.length() == 0 && description.isBlank()) {
            done()
            return
        }
        val now = Instant.now().toString()
        val originalHistory = service.optJSONArray("history") ?: JSONArray()
        val event = JSONObject().put("at", now).put("by", portalState?.str("username").orEmpty())
            .put("action", action)
        if (description.isNotBlank()) event.put("description", description)
        if (service.has("history")) {
            changes.put(JSONObject().put("path", JSONArray(listOf("services", id, "history")))
                .put("before", originalHistory).put("append", JSONArray(listOf(event))))
        } else addChange("services", service, "history", JSONArray(listOf(event)))
        val operation = adminEnvelope(state, "admin-state")
            .put("changes", changes)
            // A concurrently closed or cancelled order may no longer be edited.
            .put("guards", JSONArray(listOf(JSONObject().put("group", "services").put("id", id).put("value", service))))
        adminAction("/api/offline/admin/sync", operation, "Dados da ordem atualizados.", done)
    }

    internal fun finalizeAdminService(service: JSONObject, done: () -> Unit) {
        val state = portalState?.optJSONObject("state") ?: return
        val payload = JSONObject().put("serviceId", service.str("id"))
        val linked = state.optJSONArray("orders").objects().any { it.str("code") == service.str("code") && it.str("kind") == "Manutenção" }
        if (linked) {
            adminAction("/api/admin/finalize", payload, "Ordem finalizada.", done)
        } else {
            val operation = adminEnvelope(state, "admin-finalize").put("payload", payload)
                .put("guards", JSONArray(listOf(JSONObject().put("group", "services").put("id", service.str("id")).put("value", service))))
            adminAction("/api/offline/admin/sync", operation, "Ordem finalizada.", done)
        }
    }

    private fun adminEnvelope(state: JSONObject, kind: String) = JSONObject()
        .put("dataEpoch", state.str("__dataEpoch").ifBlank { "initial" })
        .put("accountKey", "admin:1")
        .put("serviceId", "admin-state")
        .put("id", UUID.randomUUID().toString())
        .put("deviceId", Store.deviceId)
        .put("createdAt", Instant.now().toString())
        .put("kind", kind)

    internal fun saveContact(group: String, original: JSONObject?, fields: JSONObject, done: () -> Unit) {
        if (group !in listOf("clients", "sellers", "employees")) return
        saveAdminRecord(group, original, fields, done)
    }

    internal fun saveAdminRecord(group: String, original: JSONObject?, fields: JSONObject, done: () -> Unit) {
        val state = portalState?.optJSONObject("state") ?: return
        if (group !in listOf("clients", "sellers", "employees", "inventory", "types", "products")) return
        if (group == "inventory" && (!original?.str("powderAgent").isNullOrEmpty() || fields.has("powderAgent"))) return
        val id = original?.str("id") ?: UUID.randomUUID().toString()
        val next = JSONObject(original?.toString() ?: "{}").put("id", id)
        fields.keys().forEach { next.put(it, fields.opt(it)) }
        val before = JSONObject().put("exists", original != null)
        if (original != null) before.put("value", original)
        val changes = JSONArray(listOf(JSONObject().put("path", JSONArray(listOf(group, id)))
            .put("before", before).put("after", JSONObject().put("exists", true).put("value", next))))
        adminAction("/api/offline/admin/sync", adminEnvelope(state, "admin-state").put("changes", changes),
            if (original == null) "Cadastro criado." else "Cadastro atualizado.", done)
    }

    internal fun removeAdminRecord(group: String, original: JSONObject, done: () -> Unit) {
        val state = portalState?.optJSONObject("state") ?: return
        if (group !in listOf("clients", "sellers", "types", "products")) return
        val changes = JSONArray(listOf(JSONObject()
            .put("path", JSONArray(listOf(group, original.str("id"))))
            .put("before", JSONObject().put("exists", true).put("value", original))
            .put("after", JSONObject().put("exists", false))))
        adminAction("/api/offline/admin/sync", adminEnvelope(state, "admin-state").put("changes", changes),
            "Registro removido.", done)
    }

    internal fun makeStockOperation(state: JSONObject, original: JSONObject?, updated: JSONObject, entryId: String, createdAt: String): JSONObject {
        val before = JSONObject().put("exists", original != null)
        if (original != null) before.put("value", original)
        val change = JSONObject().put("path", JSONArray(listOf("inventory", updated.str("id"))))
            .put("before", before).put("after", JSONObject().put("exists", true).put("value", updated))
        return adminEnvelope(state, "admin-state").put("id", entryId).put("createdAt", createdAt)
            .put("changes", JSONArray(listOf(change)))
    }

    internal fun makePowderEntryOperation(state: JSONObject, original: JSONObject?, payload: JSONObject, entryId: String, createdAt: String): JSONObject {
        val guards = original?.let { listOf(JSONObject().put("group", "inventory").put("id", it.str("id")).put("value", it)) }.orEmpty()
        return adminEnvelope(state, "admin-operation").put("id", entryId).put("createdAt", createdAt)
            .put("payload", payload).put("guards", JSONArray(guards))
    }

    internal fun submitStockOperation(payload: JSONObject, done: () -> Unit, failed: (Int, String) -> Unit) {
        adminAction("/api/offline/admin/sync", payload, "Entrada registrada.", done, failed)
    }

    internal fun adminAction(path: String, payload: JSONObject, success: String, done: () -> Unit) =
        adminAction(path, payload, success, done, null)

    private fun adminAction(path: String, payload: JSONObject, success: String, done: () -> Unit, failed: ((Int, String) -> Unit)?) {
        val token = Store.token
        if (busy || portalRole != "admin" || token.isEmpty()) return
        busy = true
        busyText = "Salvando no sistema…"
        viewModelScope.launch {
            try {
                val result = Api.postSection(token, path, payload)
                if (token != Store.token) return@launch
                if (result.code == 401) {
                    logout("Sessão expirada. Entre de novo.")
                    return@launch
                }
                if (result.ok && result.json.optBoolean("ok")) {
                    val state = result.json.optJSONObject("state")
                    if (state != null) {
                        val session = JSONObject(portalState.toString()).put("state", state)
                        portalState = session
                        Store.portalState = session.toString()
                    } else refreshPortal(silent = true)
                    message = success
                    done()
                } else {
                    val error = result.error.ifEmpty { "O servidor não confirmou a alteração." }
                    message = error
                    failed?.invoke(result.code, error)
                    if (result.code == 409 || result.code == 0) refreshPortal(silent = true)
                }
            } finally {
                busy = false
            }
        }
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
