package br.com.protecextintores.nativo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONObject

private data class AccessEdit(val action: String, val account: JSONObject? = null)

@Composable
internal fun AdminAccess(state: JSONObject) {
    var seller by remember { mutableStateOf(false) }
    val role = if (seller) "seller" else "employee"
    val segment = if (seller) "sellers" else "users"
    val endpoint = "/api/admin/$segment"
    val token = Store.token
    val scope = rememberCoroutineScope()
    val people = state.optJSONArray(if (seller) "sellers" else "employees").objects().filter { it.optBoolean("active", true) }
    var response by remember(role, token) { mutableStateOf<Api.ApiResult?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var issue by remember { mutableStateOf("") }
    var processing by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<AccessEdit?>(null) }
    LaunchedEffect(endpoint, reload, token) { response = Api.teamSection(token, endpoint) }

    fun send(run: suspend () -> Api.ApiResult) {
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
                } else issue = result.error.ifBlank { "A alteração não foi confirmada." }
            } finally { processing = false }
        }
    }
    PanelList {
        item { PanelIntro("", "Acessos da equipe") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                WebFilterChip(!seller, { if (!processing) { seller = false; issue = "" } }, label = { Text("Funcionários") })
                WebFilterChip(seller, { if (!processing) { seller = true; issue = "" } }, label = { Text("Vendedores") })
            }
        }
        if (issue.isNotBlank()) item { EmptyRecord(issue) }
        item { PrimaryButton("Criar acesso", enabled = people.isNotEmpty() && !processing) { editing = AccessEdit("create") } }
        val list = response
        if (list == null) item { Text("Carregando acessos…") }
        else if (!list.ok) item {
            Text(list.error.ifBlank { "Acessos indisponíveis." })
            TextButton(onClick = { reload++ }) { Text("Tentar novamente") }
        } else {
            val accounts = list.json.optJSONArray("items").objects()
            if (accounts.isEmpty()) item { EmptyRecord("Nenhum acesso cadastrado.") }
            items(accounts) { account ->
                CardBox {
                    Text(account.str(role + "Name"), fontWeight = FontWeight.Bold)
                    Text(account.str("username"))
                    TextButton(enabled = !processing, onClick = { editing = AccessEdit("reset", account) }) { Text("Redefinir senha") }
                    TextButton(enabled = !processing, onClick = { editing = AccessEdit("remove", account) }) { Text("Revogar acesso") }
                }
            }
        }
    }
    editing?.let { action ->
        val account = action.account
        var username by remember(action) { mutableStateOf("") }
        var password by remember(action) { mutableStateOf("") }
        var person by remember(action) { mutableStateOf<JSONObject?>(null) }
        var picking by remember(action) { mutableStateOf(false) }
        if (picking) ProtecDialog(onDismissRequest = { picking = false }, title = { Text("Selecionar pessoa") }, text = {
            LazyColumn(Modifier.heightIn(max = 330.dp)) {
                items(people) { record ->
                    TextButton(onClick = { person = record; picking = false }) { Text(record.str("name")) }
                }
            }
        }, confirmButton = { TextButton(onClick = { picking = false }) { Text("Voltar") } })
        else ProtecDialog(onDismissRequest = { if (!processing) editing = null }, title = {
            Text(when (action.action) {
                "create" -> "Criar acesso"
                "reset" -> "Redefinir senha"
                else -> "Revogar acesso"
            })
        }, text = {
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                if (action.action == "create") {
                    TextButton(onClick = { picking = true }) { Text(person?.str("name") ?: "Selecionar pessoa") }
                    OutlinedTextField(username, { if (it.length <= 30) username = it }, label = { Text("Nome de usuário") }, singleLine = true)
                    SecretField("Senha (mínimo 5 caracteres)", password) { password = it }
                } else {
                    Text(account?.str("username").orEmpty(), fontWeight = FontWeight.Bold)
                    if (action.action == "reset") SecretField("Nova senha (mínimo 8 caracteres)", password) { password = it }
                    else Text("A conta perderá acesso e as sessões ativas serão encerradas.")
                }
                if (issue.isNotBlank()) Text(issue, color = MaterialTheme.colorScheme.error)
            }
        }, confirmButton = {
            val enabled = when (action.action) {
                "create" -> person != null && username.trim().matches(Regex("[A-Za-z0-9._-]{3,30}")) && password.length >= 5
                "reset" -> password.length >= 8
                else -> account != null
            }
            TextButton(enabled = enabled && !processing, onClick = {
                when (action.action) {
                    "create" -> send { Api.postSection(token, endpoint, JSONObject().put("username", username.trim())
                        .put("password", password).put(role + "Id", person?.str("id"))) }
                    "reset" -> send { Api.postSection(token, "/api/admin/team-password", JSONObject().put("role", role)
                        .put("accountId", account?.str("id")).put("password", password)) }
                    else -> send { Api.revokeTeamAccess(token, endpoint, account?.str("id").orEmpty()) }
                }
            }) { Text(if (action.action == "remove") "Revogar acesso" else "Salvar") }
        }, dismissButton = { TextButton(onClick = { if (!processing) editing = null }) { Text("Cancelar") } })
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
            if (profile != null) TextButton(onClick = { attempt++ }) { Text("Tentar novamente") }
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
