package br.com.protecextintores.nativo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

@Composable
internal fun AdminTransfers(vm: AppVm, state: JSONObject, open: (String) -> Unit) {
    val requests = state.optJSONArray("services").objects().mapNotNull { order ->
        val request = order.optJSONObject("transferRequest") ?: return@mapNotNull null
        if (request.str("status") != "pending") null else order to request
    }
    var decision by remember { mutableStateOf<JSONObject?>(null) }
    PanelList {
        item { PanelIntro("PÓ, PREÇOS E ENVIOS", "Envios da equipe", "Analise as ordens que a equipe enviou para a administração.") }
        if (requests.isEmpty()) item { EmptyRecord("Nenhum envio pendente.") }
        items(requests) { (order, request) ->
            fun choose(accept: Boolean) {
                decision = JSONObject().put("action", "ownership-review").put("serviceId", order.str("id"))
                    .put("requestId", request.str("id")).put("accept", accept).put("code", order.str("code"))
            }
            CardBox {
                Text("${order.str("code")} · ${order.str("clientName")}", fontWeight = FontWeight.Bold)
                Text("Enviada por ${request.str("fromName")}")
                if (request.str("note").isNotBlank()) Text(request.str("note"))
                SoftButton("Ver ordem", enabled = !vm.busy) { open(order.str("id")) }
                PrimaryButton("Aceitar para a empresa", enabled = !vm.busy) { choose(true) }
                SoftButton("Recusar envio", enabled = !vm.busy) { choose(false) }
            }
        }
    }
    decision?.let { payload ->
        val accept = payload.optBoolean("accept")
        AlertDialog(
            onDismissRequest = { if (!vm.busy) decision = null },
            title = { Text(if (accept) "Aceitar ${payload.str("code")}?" else "Recusar ${payload.str("code")}?") },
            text = {
                Text(if (accept) "A empresa assume a ordem e a tarifa interna deixa de ser cobrada do criador. A autoria original fica no histórico."
                else "A ordem e a cobrança continuam com quem a registrou.")
            },
            confirmButton = {
                TextButton(enabled = !vm.busy, onClick = {
                    vm.adminAction("/api/admin/operations", payload, if (accept) "Envio aceito." else "Envio recusado.") { decision = null }
                }) { Text("Confirmar") }
            },
            dismissButton = { TextButton(enabled = !vm.busy, onClick = { decision = null }) { Text("Cancelar") } }
        )
    }
}

@Composable
internal fun StaffTransfer(vm: AppVm, profile: Profile?, service: Svc, after: () -> Unit) {
    val order = service.j
    val request = order.optJSONObject("transferRequest")
    val status = when (request?.str("status")) {
        "pending" -> "Envio aguardando aceite da administração"
        "accepted" -> "A administração assumiu esta ordem"
        "rejected" -> "Envio recusado. A ordem permanece com seu criador."
        "cancelled" -> "Envio cancelado pelo criador"
        else -> ""
    }
    val role = profile?.j?.str("role")
    val original = order.optJSONObject("originalCreator")
    val idMatches = profile != null && profile.actorId.isNotBlank() &&
        profile.actorId == (original?.str("id") ?: order.str("registeredById"))
    val roleMatches = role == (original?.str("role") ?: order.str("registeredByRole"))
    val canSend = idMatches && roleMatches && !service.closed && !service.cancelled && !order.optBoolean("adminOwned")
    if (status.isEmpty() && !canSend) return
    val pending = request?.str("status") == "pending"
    var show by remember(service.id) { mutableStateOf(false) }
    var sending by remember(service.id) { mutableStateOf(false) }
    var note by remember(service.id) { mutableStateOf("") }
    var issue by remember(service.id) { mutableStateOf("") }
    var operation by remember(service.id) { mutableStateOf<JSONObject?>(null) }
    val scope = rememberCoroutineScope()
    CardBox {
        Text("Envio à administração", fontWeight = FontWeight.Bold)
        if (status.isNotEmpty()) Text(status)
        if (canSend) SoftButton(if (pending) "Cancelar envio pendente" else "Enviar à administração", enabled = !vm.busy) {
            note = ""
            issue = ""
            operation = null
            show = true
        }
    }
    if (!show || profile == null) return
    AlertDialog(
        onDismissRequest = { if (!sending) show = false },
        title = { Text(if (pending) "Cancelar envio?" else "Enviar ordem à administração?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(if (pending) "O pedido de transferência será retirado." else "A cobrança permanece com você até o aceite da administração.")
                if (!pending) OutlinedTextField(note, {
                    if (it.length <= 500) {
                        note = it
                        operation = null
                    }
                }, label = { Text("Observação opcional") }, enabled = !sending, minLines = 2)
                if (issue.isNotBlank()) Text(issue, color = MaterialTheme.colorScheme.error)
            }
        },
        confirmButton = {
            TextButton(enabled = !sending, onClick = {
                val token = Store.token
                val op = operation ?: JSONObject()
                    .put("id", UUID.randomUUID().toString()).put("deviceId", Store.deviceId)
                    .put("dataEpoch", profile.dataEpoch).put("accountKey", profile.accountKey)
                    .put("serviceId", service.id).put("baseVersion", order.str("syncVersion"))
                    .put("createdAt", Instant.now().toString()).put("kind", "ownership-request")
                    .put("payload", JSONObject().put("requestId", UUID.randomUUID().toString())
                        .put("cancel", pending).put("note", note.trim()))
                operation = op
                sending = true
                scope.launch {
                    try {
                        val result = Api.sync(token, op)
                        if (token != Store.token) return@launch
                        if (result.ok && result.json.optBoolean("ok")) {
                            show = false
                            vm.message = if (pending) "Envio cancelado." else "Ordem enviada para aceite."
                            after()
                        } else if (result.code == 401) vm.logout("Sessão expirada. Entre de novo.")
                        else issue = result.error.ifBlank { "O servidor não confirmou o envio." }
                    } finally {
                        sending = false
                    }
                }
            }) { Text(if (pending) "Cancelar envio" else "Enviar para aceite") }
        },
        dismissButton = { TextButton(enabled = !sending, onClick = { show = false }) { Text("Voltar") } }
    )
}
