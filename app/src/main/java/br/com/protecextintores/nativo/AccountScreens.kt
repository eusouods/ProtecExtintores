package br.com.protecextintores.nativo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONObject

private enum class AccessAction { Create, Reset, Remove }
private data class AccessEdit(
    val action: AccessAction,
    val account: JSONObject? = null,
    val personId: String? = null
)
private val sellerContactFields = listOf(
    CatalogField("name", "Nome do vendedor", maxLength = 100)
)
private val teamUsernamePattern = Regex("[A-Za-z0-9._-]{3,30}")

@Composable
internal fun AdminAccess(
    vm: AppVm,
    state: JSONObject,
    startWithSellers: Boolean = false,
    sellerToOpen: String? = null,
    consumeSeller: () -> Unit = {}
) {
    var seller by rememberSaveable(startWithSellers) { mutableStateOf(startWithSellers) }
    val role = if (seller) "seller" else "employee"
    val segment = if (seller) "sellers" else "users"
    val endpoint = "/api/admin/$segment"
    val token = Store.token
    val scope = rememberCoroutineScope()
    val group = if (seller) "sellers" else "employees"
    val personField = role + "Id"
    var justCreatedSeller by remember(token) { mutableStateOf<JSONObject?>(null) }
    val people = (state.optJSONArray(group).objects() + listOfNotNull(justCreatedSeller.takeIf { seller }))
        .distinctBy { it.str("id") }
        .filter { it.optBoolean("active", true) && it.str("id").isNotBlank() }
        .sortedBy { it.str("name").lowercase() }
    var response by remember(role, token) { mutableStateOf<Api.ApiResult?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var issue by remember { mutableStateOf("") }
    var processing by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<AccessEdit?>(null) }
    var creatingSeller by rememberSaveable { mutableStateOf(false) }
    var highlightedSeller by rememberSaveable { mutableStateOf<String?>(null) }
    val accounts = response?.json?.optJSONArray("items").objects()
    val linkedIds = accounts.map { it.str(personField) }.toSet()
    val available = people.filterNot { it.str("id") in linkedIds }

    LaunchedEffect(endpoint, reload, token) {
        response = Api.teamSection(token, endpoint)
    }
    LaunchedEffect(sellerToOpen, seller, response) {
        if (sellerToOpen == null || !seller || response?.ok != true) return@LaunchedEffect
        issue = ""
        when {
            sellerToOpen in linkedIds -> {
                highlightedSeller = sellerToOpen
                issue = "Este vendedor já possui acesso. Confira a conta abaixo."
            }
            available.any { it.str("id") == sellerToOpen } -> editing = AccessEdit(AccessAction.Create, personId = sellerToOpen)
            else -> issue = "O vendedor não está disponível. Atualize o painel e tente novamente."
        }
        consumeSeller()
    }

    fun send(success: String, run: suspend () -> Api.ApiResult) {
        if (processing) return
        processing = true
        issue = ""
        scope.launch {
            try {
                val result = run()
                if (Store.token != token) return@launch
                if (result.ok && result.json.length() > 0) {
                    editing = null
                    reload++
                    vm.message = success
                } else issue = result.error.ifBlank { "A alteração não foi confirmada." }
            } finally { processing = false }
        }
    }
    PanelList {
        item { PanelIntro("", if (startWithSellers) "Acessos de vendedores" else "Acessos da equipe") }
        if (!startWithSellers) item {
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                WebFilterChip(!seller, { if (!processing) { seller = false; issue = "" } }, label = { Text("Funcionários") })
                WebFilterChip(seller, { if (!processing) { seller = true; issue = "" } }, label = { Text("Vendedores") })
            }
        }
        if (issue.isNotBlank() && editing == null) item { EmptyRecord(issue) }
        val list = response
        if (list == null) item { Text("Carregando acessos…") }
        else if (!list.ok) item {
            Text(list.error.ifBlank { "Acessos indisponíveis." })
            ExpressiveTextButton(onClick = { reload++ }) { Text("Tentar novamente") }
        } else {
            if (available.isNotEmpty()) item {
                PrimaryButton(if (seller) "Criar acesso de vendedor" else "Criar acesso de funcionário", enabled = !processing && !vm.busy) {
                    issue = ""
                    editing = AccessEdit(AccessAction.Create, personId = available.singleOrNull()?.str("id"))
                }
            }
            if (seller) item {
                if (people.isEmpty()) Text("Cadastre um vendedor para criar o acesso.")
                else if (available.isEmpty()) Text("Todos os vendedores ativos já têm acesso.")
                SoftButton("Cadastrar vendedor", enabled = !processing && !vm.busy) { creatingSeller = true }
            } else if (available.isEmpty()) item {
                Text(if (people.isEmpty()) "Cadastre um funcionário para criar o acesso." else "Todos os funcionários ativos já têm acesso.")
            }
            if (accounts.isEmpty()) item { EmptyRecord("Nenhum acesso cadastrado.") }
            items(accounts.sortedByDescending { seller && it.str("sellerId") == highlightedSeller }) { account ->
                CardBox {
                    Text(account.str(role + "Name"), fontWeight = FontWeight.Bold)
                    Text(account.str("username"))
                    ExpressiveTextButton(enabled = !processing, onClick = { issue = "";editing = AccessEdit(AccessAction.Reset, account) }) { Text("Redefinir senha") }
                    ExpressiveTextButton(enabled = !processing, onClick = { issue = "";editing = AccessEdit(AccessAction.Remove, account) }) { Text("Revogar acesso") }
                }
            }
        }
    }
    if (creatingSeller) NativeFieldsDialog("Cadastrar vendedor", sellerContactFields, busy = vm.busy, close = { creatingSeller = false }) {
        val name = it.str("name")
        if (name.length < 2) "Informe o nome do vendedor."
        else {
            vm.saveContact("sellers", null, JSONObject().put("name", name)) { id ->
                creatingSeller = false
                justCreatedSeller = JSONObject().put("id", id).put("name", name)
                editing = AccessEdit(AccessAction.Create, personId = id)
            }
            null
        }
    }
    editing?.let { action ->
        val account = action.account
        var username by remember(action) { mutableStateOf("") }
        var password by remember(action) { mutableStateOf("") }
        var personId by remember(action) { mutableStateOf(action.personId) }
        val person = available.firstOrNull { it.str("id") == personId }
        var picking by remember(action) { mutableStateOf(false) }
        val selectLabel = if (seller) "Selecionar vendedor" else "Selecionar funcionário"
        ProtecDialog(onDismissRequest = { if (!processing) editing = null }, title = {
            Text(when (action.action) {
                AccessAction.Create -> if (seller) "Criar acesso de vendedor" else "Criar acesso de funcionário"
                AccessAction.Reset -> "Redefinir senha"
                AccessAction.Remove -> "Revogar acesso"
            })
        }, text = {
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                if (action.action == AccessAction.Create) {
                    SoftButton(person?.str("name") ?: selectLabel, enabled = !processing && available.isNotEmpty()) { picking = true }
                    OutlinedTextField(username, { if (it.length <= 30) username = it }, modifier = Modifier.fillMaxWidth(),
                        label = { Text("Nome de usuário") }, enabled = !processing, singleLine = true)
                    Text("Use de 3 a 30 letras, números, pontos, hífens ou sublinhados.", style = MaterialTheme.typography.bodySmall)
                    SecretField("Senha (mínimo 5 caracteres)", password) { password = it }
                } else {
                    Text(account?.str("username").orEmpty(), fontWeight = FontWeight.Bold)
                    if (action.action == AccessAction.Reset) SecretField("Nova senha (mínimo 8 caracteres)", password) { password = it }
                    else Text("A conta perderá acesso e as sessões ativas serão encerradas.")
                }
                if (issue.isNotBlank()) Text(issue, color = MaterialTheme.colorScheme.error)
            }
        }, confirmButton = {
            val enabled = when (action.action) {
                AccessAction.Create -> person != null && username.trim().matches(teamUsernamePattern) && password.length >= 5
                AccessAction.Reset -> password.length >= 8
                AccessAction.Remove -> account != null
            }
            ExpressiveTextButton(enabled = enabled && !processing, onClick = {
                when (action.action) {
                    AccessAction.Create -> send(if (seller) "Acesso de vendedor criado." else "Acesso de funcionário criado.") {
                        Api.postSection(token, endpoint, JSONObject().put("username", username.trim())
                            .put("password", password).put(personField, person?.str("id")))
                    }
                    AccessAction.Reset -> send("Senha redefinida.") { Api.postSection(token, "/api/admin/team-password", JSONObject().put("role", role)
                        .put("accountId", account?.str("id")).put("password", password)) }
                    AccessAction.Remove -> send("Acesso revogado.") { Api.revokeTeamAccess(token, endpoint, account?.str("id").orEmpty()) }
                }
            }) { Text(if (processing) "Salvando…" else if (action.action == AccessAction.Remove) "Revogar acesso" else "Salvar") }
        }, dismissButton = { ExpressiveTextButton(onClick = { if (!processing) editing = null }) { Text("Cancelar") } })
        if (picking) ProtecOptions(selectLabel, available.map { SheetOption(it.str("id"), it.str("name")) },
            personId, close = { picking = false }) { personId = it }
    }
}

@Composable
internal fun AccountProfile(vm: AppVm) {
    val token = Store.token
    val scope = rememberCoroutineScope()
    var response by remember(token) { mutableStateOf<Api.ApiResult?>(null) }
    var username by remember(token) { mutableStateOf("") }
    var currentPassword by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var attempt by remember { mutableIntStateOf(0) }
    LaunchedEffect(token, attempt) {
        response = Api.teamSection(token, "/api/profile").also { if (it.ok) username = it.json.str("username") }
    }
    PanelList {
        item { PanelIntro("", "Meu perfil", "Altere seu usuário ou senha.") }
        val profile = response
        if (profile?.ok != true) item {
            Text(profile?.error?.ifBlank { "Perfil indisponível." } ?: "Carregando…")
            if (profile != null) ExpressiveTextButton(onClick = { attempt++ }) { Text("Tentar novamente") }
        } else item {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(username, { if (it.length <= 30) username = it }, label = { Text("Usuário") }, modifier = Modifier.fillMaxWidth())
                SecretField("Senha atual", currentPassword) { currentPassword = it }
                SecretField("Nova senha (opcional)", password) { password = it }
                if (message.isNotBlank()) Text(message)
                PrimaryButton("Salvar alterações", enabled = !saving && currentPassword.isNotEmpty() &&
                    username.trim().matches(Regex("[A-Za-z0-9._-]{3,30}")) && (password.isEmpty() || password.length >= 5)) {
                    saving = true
                    scope.launch {
                        try {
                            val result = Api.putSection(token, "/api/profile", JSONObject().put("username", username.trim())
                                .put("currentPassword", currentPassword).put("newPassword", password))
                            if (token != Store.token) return@launch
                            if (result.ok && result.json.optBoolean("ok") && (username != profile.json.str("username") || password.isNotBlank())) {
                                vm.logout("Acesso atualizado. Entre novamente.")
                            } else message = result.error.ifBlank { if (result.ok) "Perfil salvo." else "O servidor não confirmou a alteração." }
                            currentPassword = ""
                            password = ""
                        } finally { saving = false }
                    }
                }
            }
        }
    }
}

@Composable
private fun SecretField(label: String, value: String, change: (String) -> Unit) {
    OutlinedTextField(value, { if (it.length <= 128) change(it) }, visualTransformation = PasswordVisualTransformation(),
        modifier = Modifier.fillMaxWidth(), label = { Text(label) }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
}
