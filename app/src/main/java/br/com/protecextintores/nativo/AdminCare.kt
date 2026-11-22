package br.com.protecextintores.nativo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject

private val claimStatuses = listOf("Recebida", "Em análise", "Aguardando cliente", "Agendada avaliação", "Aprovada", "Recusada", "Resolvida")
private val finalClaimStatuses = setOf("Aprovada", "Recusada", "Resolvida")
private val itemStatuses = listOf("Em análise", "Aprovado", "Recusado", "Aguardando devolução", "Substituído", "Reparado", "Encerrado")
private val reviewStatuses = mapOf("pending" to "Pendente", "published" to "Publicada", "hidden" to "Oculta")

@Composable
internal fun AdminCare(vm: AppVm) {
    var reviews by remember { mutableStateOf(false) }
    var entry by remember { mutableStateOf<JSONObject?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    val token = Store.token
    var response by remember(token) { mutableStateOf<Api.ApiResult?>(null) }
    LaunchedEffect(token, reload) { response = Api.teamSection(token, "/api/admin/care") }
    val selected = entry
    if (selected != null) {
        CareEditor(vm, selected, reviews, close = { entry = null }) {
            entry = null
            reload++
        }
        return
    }
    val result = response
    PanelList {
        item { PanelIntro("ATENDIMENTO", "Garantias e avaliações") }
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                WebFilterChip(!reviews, { reviews = false }, label = { Text("Garantias") })
                WebFilterChip(reviews, { reviews = true }, label = { Text("Avaliações") })
            }
        }
        when {
            result == null -> item { Text("Carregando atendimentos…") }
            !result.ok -> item {
                EmptyRecord(result.error.ifBlank { "Não foi possível carregar os atendimentos." })
                ExpressiveTextButton(onClick = { reload++ }) { Text("Tentar novamente") }
            }
            else -> {
                val records = result.json.optJSONArray(if (reviews) "reviews" else "claims").objects()
                if (records.isEmpty()) item { EmptyRecord(if (reviews) "Nenhuma avaliação recebida." else "Nenhuma solicitação de garantia.") }
                items(records) { record ->
                    CardBox {
                        Text(record.str("customer_name").ifBlank { record.str("customer_email") }, fontWeight = FontWeight.Bold)
                        if (reviews) {
                            Text("Ordem ${record.str("service_code")} · ${record.optInt("rating")}/5")
                            Text(reviewStatuses[record.str("status")] ?: record.str("status"))
                            Text(record.str("comment"), maxLines = 3)
                        } else {
                            Text("${record.str("code")} · ${record.str("status")}")
                            Text(record.str("issue_type"))
                        }
                        SoftButton(if (reviews) "Moderar avaliação" else "Analisar garantia") { entry = record }
                    }
                }
            }
        }
    }
}

@Composable
private fun CareEditor(vm: AppVm, record: JSONObject, review: Boolean, close: () -> Unit, done: () -> Unit) {
    val canPublish = record.optBoolean("consent_public") || record.optInt("consent_public") == 1
    val options = if (review) reviewStatuses.filterKeys { it != "published" || canPublish }
        else claimStatuses.associateWith { it }
    val originalItems = record.optJSONArray("items").objects()
    var status by remember(record) { mutableStateOf(record.str("status")) }
    var response by remember(record) { mutableStateOf(record.str("admin_response")) }
    var changedItems by remember(record) { mutableStateOf(emptyMap<String, JSONObject>()) }
    var issue by remember(record) { mutableStateOf("") }
    androidx.activity.compose.BackHandler(!vm.busy, close)
    Column(Modifier.fillMaxSize()) {
        ScreenHeader(if (review) "Moderar avaliação" else "Analisar garantia") { if (!vm.busy) close() }
        PanelList {
            item {
                CardBox {
                    Text(record.str("customer_name").ifBlank { record.str("customer_email") }, fontWeight = FontWeight.Bold)
                    if (review) {
                        Text("Ordem ${record.str("service_code")} · Nota ${record.optInt("rating")}/5")
                        Text("Qualidade ${record.optInt("quality")}/5 · Pontualidade ${record.optInt("punctuality")}/5 · Comunicação ${record.optInt("communication")}/5")
                        Text(record.str("comment"))
                        Text(if (canPublish) "Publicação autorizada pelo cliente" else "Avaliação privada")
                    } else {
                        Text("${record.str("code")} · Pedido ${record.str("order_code")}")
                        Text(record.str("issue_type"))
                        Text(record.str("details"))
                    }
                }
            }
            item {
                CardBox {
                    CareStatus("Status", status, options, !vm.busy) { status = it }
                    val limit = if (review) 1500 else 2000
                    OutlinedTextField(response, { if (it.length <= limit) response = it }, Modifier.fillMaxWidth(),
                        enabled = !vm.busy, label = { Text("Resposta ao cliente") }, minLines = 2)
                }
            }
            items(originalItems) { item ->
                val id = item.str("id")
                val value = changedItems[id] ?: item
                fun edit(field: String, updated: String) {
                    changedItems = changedItems + (id to JSONObject().put("id", id)
                        .put("status", value.str("status")).put("diagnosis", value.str("diagnosis")).put(field, updated))
                }
                CardBox {
                    Text("${item.optInt("quantity", 1)} × ${item.str("productName")}", fontWeight = FontWeight.Bold)
                    if (item.str("serial").isNotBlank()) Text("Série · ${item.str("serial")}")
                    if (item.str("issue").isNotBlank()) Text(item.str("issue"))
                    CareStatus("Resultado", value.str("status"), itemStatuses.associateWith { it }, !vm.busy) { edit("status", it) }
                    OutlinedTextField(value.str("diagnosis"), { if (it.length <= 1000) edit("diagnosis", it) },
                        Modifier.fillMaxWidth(), enabled = !vm.busy, label = { Text("Diagnóstico") }, minLines = 2)
                }
            }
            if (issue.isNotBlank()) item { Text(issue, color = MaterialTheme.colorScheme.error) }
            item {
                PrimaryButton("Salvar", enabled = !vm.busy) {
                    issue = when {
                        status !in options -> "Selecione um status."
                        !review && status in finalClaimStatuses && response.trim().length < 5 -> "Registre a decisão ou o resultado."
                        changedItems.values.any { it.str("status") !in itemStatuses } -> "Confira o resultado de cada equipamento."
                        else -> ""
                    }
                    if (issue.isBlank()) {
                        val type = if (review) "review" else "warranty"
                        val payload = JSONObject().put(if (review) "reviewId" else "claimId", record.str("id"))
                            .put("status", status).put("response", response.trim())
                        if (!review) payload.put("items", JSONArray(changedItems.values.toList()))
                        vm.adminAction("/api/admin/care/$type", payload, "Atendimento atualizado.", done)
                    }
                }
            }
        }
    }
}

@Composable
private fun CareStatus(label: String, current: String, choices: Map<String, String>, enabled: Boolean, select: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    SoftButton("$label · ${choices[current] ?: current.ifBlank { "Selecionar" }}", enabled = enabled) { expanded = true }
    if (expanded) ProtecOptions(label, choices.map { SheetOption(it.key, it.value) }, current, close = { expanded = false }, choose = select)
}
