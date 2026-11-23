package br.com.protecextintores.nativo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import org.json.JSONObject

private const val PIX_PROVIDER_PATH = "/api/admin/pix-provider"

@Composable
internal fun AdminPixProvider(vm: AppVm, close: () -> Unit) {
    val token = Store.token
    val scope = rememberCoroutineScope()
    var response by remember(token) { mutableStateOf<Api.ApiResult?>(null) }
    var retry by remember { mutableIntStateOf(0) }
    var editing by remember { mutableStateOf(false) }
    var working by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    val config = response?.takeIf { it.ok }?.json
    LaunchedEffect(token, retry) {
        response = Api.teamSection(token, PIX_PROVIDER_PATH)
    }
    val busy = vm.busy || working
    ProtecDialog(onDismissRequest = { if (!busy) close() }, title = { Text("Verificação automática de Pix") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                when {
                    response == null -> Text("Carregando integração…")
                    config == null -> {
                        Text(response?.error.orEmpty().ifBlank { "Não foi possível carregar a integração." })
                        SoftButton("Tentar novamente", enabled = !busy) { response = null; retry++ }
                    }
                    else -> {
                        if (config.optBoolean("configured")) {
                            Text(config.str("providerName"))
                            Text(if (config.optBoolean("enabled")) "Integração ativa" else "Integração desativada")
                            if (config.optBoolean("clientSecretConfigured")) Text("Client Secret protegido no servidor.")
                        } else Text("Nenhum provedor configurado.")
                        if (status.isNotBlank()) Text(status)
                        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
                        SoftButton("Configurar integração", enabled = !busy) { error = ""; editing = true }
                        SoftButton("Testar e registrar webhook", enabled = !busy && config.optBoolean("enabled")) {
                            working = true
                            error = ""
                            status = ""
                            scope.launch {
                                try {
                                    val test = Api.postSection(token, "$PIX_PROVIDER_PATH/test", JSONObject())
                                    if (token == Store.token) {
                                        if (test.ok && test.json.optBoolean("ok")) status = test.json.str("message").ifBlank { "Integração validada." }
                                        else error = test.error.ifBlank { "Não foi possível validar a integração." }
                                    }
                                } finally {
                                    working = false
                                }
                            }
                        }
                    }
                }
            }
        }, confirmButton = { ExpressiveTextButton(onClick = close, enabled = !busy) { Text("Fechar") } })
    if (editing && config != null) {
        val fields = remember {
            listOf(CatalogField("providerName", "Banco ou provedor", maxLength = 80),
                CatalogField("apiBaseUrl", "URL base da API Pix"), CatalogField("tokenUrl", "URL do token OAuth"),
                CatalogField("clientId", "Client ID", maxLength = 200),
                CatalogField("clientSecret", "Client Secret (vazio mantém, se o provedor for o mesmo)", optional = true, maxLength = 2000, secret = true),
                CatalogField("clearClientSecret", "Apagar o segredo salvo", toggle = true),
                CatalogField("scope", "Escopos OAuth", optional = true, maxLength = 500),
                CatalogField("pixKey", "Chave Pix vinculada", maxLength = 100),
                CatalogField("mtlsBinding", "Binding mTLS", optional = true, maxLength = 40),
                CatalogField("enabled", "Ativar verificação automática", toggle = true))
        }
        val initial = remember(config) { JSONObject(config.toString()).apply { remove("clientSecret"); remove("clearClientSecret") } }
        NativeFieldsDialog("Configurar integração Pix", fields, initial, busy, { editing = false }) { values ->
            if (listOf("apiBaseUrl", "tokenUrl").any { values.str(it).toHttpUrlOrNull()?.scheme != "https" }) {
                "Informe URLs HTTPS para a API Pix e o token OAuth."
            } else {
                working = true
                scope.launch {
                    try {
                        val saved = Api.postSection(token, PIX_PROVIDER_PATH, values)
                        if (token == Store.token) {
                            if (saved.ok && saved.json.optBoolean("configured")) {
                                response = saved
                                status = "Integração salva."
                                editing = false
                            } else {
                                vm.message = saved.error.ifBlank { "O provedor não foi salvo." }
                            }
                        }
                    } finally {
                        working = false
                    }
                }
                null
            }
        }
    }
}
