package br.com.protecextintores.nativo

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import java.time.LocalDate
import java.time.YearMonth

private val reviewYearFormat = Regex("""20\d{2}""")

private fun needsValidity(items: List<JSONObject>) = items.any { item ->
    !item.str("maintenanceYear").matches(reviewYearFormat) ||
        item.str("hydroYear").let { it.isNotBlank() && !it.matches(reviewYearFormat) }
}

private fun reviewDraft(order: JSONObject): JSONObject {
    val fallback = order.str("date").take(4).takeIf { it.matches(reviewYearFormat) } ?: LocalDate.now().year.toString()
    val items = order.optJSONArray("items").objects().map { item ->
        JSONObject(item.toString())
            .put("maintenanceYear", item.str("maintenanceYear").ifBlank { order.str("maintenanceValid").ifBlank { fallback } })
            .put("hydroYear", item.str("hydroYear").ifBlank { order.str("hydroValid") })
    }
    return JSONObject(order.toString()).put("items", JSONArray(items)).put("reviewNotes", "")
}

@Composable
internal fun AdminServiceScreen(vm: AppVm, order: JSONObject, readOnly: Boolean = false, staffProfile: Profile? = null, close: () -> Unit) {
    val svc = Svc(order)
    var tab by remember { mutableIntStateOf(0) }
    var edit by remember { mutableStateOf<JSONObject?>(null) }
    var confirm by remember { mutableStateOf(false) }
    var receipt by remember { mutableStateOf(false) }
    var linkContacts by remember { mutableStateOf(false) }
    var reference by remember { mutableStateOf("") }
    androidx.activity.compose.BackHandler {
        if (!vm.busy) {
            if (edit != null) edit = null else close()
        }
    }
    Column(Modifier.fillMaxSize()) {
        ScreenHeader(if (edit == null) "Ordem de serviço" else "Revisar dados e validades") {
            if (!vm.busy) {
                if (edit != null) edit = null else close()
            }
        }
        val draft = edit
        if (draft != null) {
            AdminReviewForm(vm, svc, draft, { edit = it }) { edit = null }
        } else PanelList {
            item {
                PanelIntro(svc.code, svc.client.ifBlank { "Serviço próprio" }, listOf(svc.type, svc.date).filter(String::isNotBlank).joinToString(" · "))
            }
            item { StatusChip(svc.displayStatus) }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("Resumo", "Financeiro", "Histórico").forEachIndexed { index, label ->
                        FilterChip(tab == index, { tab = index }, label = { Text(label) })
                    }
                }
            }
            when (tab) {
                0 -> {
                    item {
                        CardBox {
                            Text("Execução", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold)
                            Text("Responsável técnico · ${svc.employeeName.ifBlank { "Aguardando aceite" }}")
                            Text("Vendedor · ${order.str("sellerName").ifBlank { "Administração" }}")
                            Text("Equipamentos · ${svc.items.size}")
                            Text("Pintura · ${order.optInt("paintingQuantity")} unidade(s)")
                            order.optDouble("retailAmount").takeIf { it.isFinite() }?.let {
                                Text("Preço informado ao cliente · ${formatRegistrationMoney(Math.round(it * 100))}")
                            }
                            if (svc.paused) Text("Motivo da pausa · ${svc.pauseReason}")
                            if (order.str("notes").isNotBlank()) Text(order.str("notes"))
                        }
                    }
                    item { ServiceSelections(order) }
                    if (readOnly) {
                        val authoritative = staffProfile?.find(svc.id)
                        item { StaffTransfer(vm, staffProfile, authoritative ?: svc, close) }
                    }
                    items(svc.items) { item ->
                        CardBox {
                            Text(item.str("type"), fontWeight = FontWeight.Bold)
                            Text(listOf(item.str("kg").takeIf { it.isNotBlank() }?.let { "$it kg" }, item.str("serial"))
                                .filterNotNull().filter(String::isNotBlank).joinToString(" · "))
                            Text("Manutenção · ${item.str("maintenanceYear").ifBlank { "Pendente" }}")
                            Text("Hidrostático · ${item.str("hydroYear").ifBlank { "Não informado" }}")
                            if (item.str("seal").isNotBlank()) Text("Selo / lacre · ${item.str("seal")}")
                            if (item.str("notes").isNotBlank()) Text(item.str("notes"))
                            val parts = item.optJSONArray("replacedParts").stringList()
                            if (parts.isNotEmpty()) Text("Peças substituídas · ${parts.joinToString()}")
                            EvidenceLinks(item)
                        }
                    }
                    if (!readOnly && !svc.closed && !svc.cancelled) {
                        item { SoftButton("Revisar dados e validades", enabled = !vm.busy) { edit = reviewDraft(order) } }
                        item { SoftButton("Vincular cliente / vendedor", enabled = !vm.busy) { linkContacts = true } }
                        item {
                            PrimaryButton("Finalizar serviço", enabled = !vm.busy) {
                                if (needsValidity(svc.items)) {
                                    vm.message = "Revise as validades antes de finalizar o serviço."
                                    edit = reviewDraft(order)
                                } else confirm = true
                            }
                        }
                    }
                }
                1 -> {
                    val finance = order.optJSONObject("finance")
                    if (finance == null) {
                        val charge = order.optJSONObject("charge")
                        if (charge != null) item { PanelMetrics(listOf(
                            PanelMetric("Valor da ordem", formatRegistrationMoney(charge.optLong("amountCents"))),
                            PanelMetric("Vencimento", charge.str("dueDate").ifBlank { "Sem prazo" }),
                            PanelMetric("Pagamento", if (charge.optJSONObject("payment")?.str("status") == "paid") "Confirmado" else "Pendente")
                        )) } else item { EmptyRecord("O valor e o prazo são consolidados na finalização.") }
                    }
                    else {
                        item { PanelMetrics(listOf(
                            PanelMetric("Receita", formatRegistrationMoney(finance.optLong("revenueCents"))),
                            PanelMetric("Custos", formatRegistrationMoney(finance.optLong("costCents"))),
                            PanelMetric("Resultado bruto", formatRegistrationMoney(finance.optLong("profitCents"))),
                            PanelMetric("Vencimento", finance.str("dueDate").ifBlank { "Sem prazo" })
                        )) }
                        val payment = finance.optJSONObject("payment")
                        if (payment?.str("status") == "paid") item {
                            Text("Recebimento confirmado · ${payment.str("reference")}")
                        } else if (!readOnly && svc.closed && !svc.cancelled && finance.optJSONObject("payer") == null &&
                            order.optJSONObject("billingOwner") == null && finance.str("settlementId").isBlank()) {
                            item { PrimaryButton("Registrar recebimento", enabled = !vm.busy) { receipt = true } }
                        } else if (svc.closed && !svc.cancelled) {
                            item { Text("Confira este pagamento em Custos e recebimentos → Acertos da equipe.") }
                        }
                    }
                }
                else -> {
                    val equipmentHistory = svc.items.flatMapIndexed { index, item ->
                        item.optJSONArray("history").objects().map { event ->
                            JSONObject(event.toString()).put("description",
                                "Equipamento ${index + 1}: ${event.str("description").ifBlank { event.str("status") }}")
                        }
                    }
                    val history = (order.optJSONArray("history").objects() + equipmentHistory)
                        .sortedByDescending { it.str("at") }.distinctBy { it.toString() }
                    if (history.isEmpty()) item { EmptyRecord("Nenhum registro no histórico.") }
                    items(history) { event ->
                        CardBox {
                            Text(event.str("action").ifBlank { event.str("status") }, fontWeight = FontWeight.Bold)
                            if (event.str("description").isNotBlank()) Text(event.str("description"))
                            Text(listOf(event.str("at").take(10), event.str("by")).filter(String::isNotBlank).joinToString(" · "))
                        }
                    }
                }
            }
        }
    }
    if (linkContacts) vm.portalState?.optJSONObject("state")?.let { state ->
        LinkContactsDialog(vm, state, order) { linkContacts = false }
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false }, title = { Text("Finalizar ${svc.code}?") },
        text = { Text("Confira os equipamentos e as evidências. A finalização encerra a execução da ordem.") },
        confirmButton = { TextButton(onClick = { confirm = false; vm.finalizeAdminService(order) {} }) { Text("Finalizar serviço") } },
        dismissButton = { TextButton(onClick = { confirm = false }) { Text("Voltar") } }
    )
    if (receipt) AlertDialog(
        onDismissRequest = { receipt = false }, title = { Text("Registrar recebimento") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Confira o valor recebido antes de confirmar.")
                OutlinedTextField(reference, { if (it.length <= 300) reference = it }, label = { Text("Referência do pagamento") })
            }
        },
        confirmButton = {
            TextButton(enabled = reference.trim().length >= 3, onClick = {
                receipt = false
                vm.adminAction("/api/admin/operations", JSONObject().put("action", "mark-paid")
                    .put("serviceIds", JSONArray(listOf(svc.id))).put("reference", reference.trim()),
                    "Recebimento registrado.") { reference = "" }
            }) { Text("Confirmar recebimento") }
        },
        dismissButton = { TextButton(onClick = { receipt = false }) { Text("Cancelar") } }
    )
}

@Composable
private fun LinkContactsDialog(vm: AppVm, state: JSONObject, order: JSONObject, close: () -> Unit) {
    val clients = state.optJSONArray("clients").objects()
    val sellers = state.optJSONArray("sellers").objects().filter { it.optBoolean("active", true) }
    var clientId by remember { mutableStateOf(order.str("clientId").takeIf { id -> clients.any { it.str("id") == id } }.orEmpty()) }
    var sellerId by remember { mutableStateOf(order.str("sellerId").takeIf { id -> sellers.any { it.str("id") == id } }.orEmpty()) }
    AlertDialog(
        onDismissRequest = { if (!vm.busy) close() },
        title = { Text("Vincular cliente / vendedor") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text("O criador da ordem permanece no histórico. A cobrança já atribuída ao criador é preservada.")
                ContactPicker("Cliente", "Manter o contato informado", clientId, clients, !vm.busy) { clientId = it }
                ContactPicker("Vendedor", "Sem vendedor atribuído", sellerId, sellers, !vm.busy) { sellerId = it }
            }
        },
        confirmButton = {
            TextButton(enabled = !vm.busy, onClick = { vm.linkAdminContacts(order, clientId, sellerId, close) }) { Text("Salvar vínculos") }
        },
        dismissButton = { TextButton(enabled = !vm.busy, onClick = close) { Text("Cancelar") } }
    )
}

@Composable
private fun ContactPicker(
    label: String, blankLabel: String, id: String, options: List<JSONObject>, enabled: Boolean, choose: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    val name = options.firstOrNull { it.str("id") == id }?.str("name") ?: blankLabel
    SoftButton("$label · $name", enabled = enabled) {
        query = ""
        expanded = true
    }
    if (expanded) AlertDialog(
        onDismissRequest = { expanded = false }, title = { Text(label) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
                PanelSearch(query, { query = it }, "Buscar pelo nome")
                LazyColumn(Modifier.heightIn(max = 255.dp)) {
                    item {
                        TextButton(onClick = { choose(""); expanded = false }) { Text(blankLabel) }
                    }
                    items(options.filter { matches(it, query) }) { contact ->
                        TextButton(onClick = { choose(contact.str("id")); expanded = false }) { Text(contact.str("name")) }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { expanded = false }) { Text("Voltar") } }
    )
}

@Composable
internal fun ServiceSelections(order: JSONObject) {
    val fields = listOf("plannedParts", "soldExtinguishers", "hydrantHoses", "complementaryServices")
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        for (field in fields) {
        val values = order.optJSONArray(field).objects()
        if (values.isEmpty()) continue
            CardBox {
                Text(registrationLabel(field), fontWeight = FontWeight.ExtraBold)
                for (value in values) {
                    val label = value.str("name").ifBlank { value.str("type") }
                    val details = listOf(value.str("variant"), value.str("kg").takeIf { it.isNotBlank() }?.let { "$it kg" }.orEmpty(),
                        value.str("lengthMeters").takeIf { it.isNotBlank() }?.let { "$it m" }.orEmpty(),
                        value.str("diameterMm").takeIf { it.isNotBlank() }?.let { "$it mm" }.orEmpty())
                        .filter(String::isNotBlank).joinToString(" · ")
                    Text("${value.optInt("quantity", 1)} × $label" + if (details.isBlank()) "" else " · $details")
                }
            }
        }
    }
}

@Composable
private fun AdminReviewForm(vm: AppVm, service: Svc, draft: JSONObject, change: (JSONObject) -> Unit, done: () -> Unit) {
    var error by remember { mutableStateOf("") }
    val original = remember { service.j }
    val fields = listOf(
        Triple("clientName", "Cliente", 100), Triple("clientPhone", "Telefone", 30), Triple("clientEmail", "E-mail", 254),
        Triple("date", "Data do serviço (AAAA-MM-DD)", 10), Triple("nextMaintenanceMonth", "Próxima manutenção (AAAA-MM)", 7),
        Triple("notes", "Observações da ordem", 3000),
        Triple("reviewNotes", "Observação da revisão", 1500)
    )
    val equipment = draft.optJSONArray("items").objects()
    fun updateItem(index: Int, field: String, value: String) {
        val list = equipment.mapIndexed { i, item -> if (i == index) JSONObject(item.toString()).put(field, value) else item }
        change(JSONObject(draft.toString()).put("items", JSONArray(list)))
    }
    PanelList {
        item { PanelIntro(service.code, "Revisar dados") }
        fields.forEach { (key, label, length) ->
            item {
                OutlinedTextField(draft.str(key), { if (it.length <= length) change(JSONObject(draft.toString()).put(key, it)) },
                    modifier = Modifier.fillMaxWidth(), label = { Text(label) }, singleLine = key !in setOf("notes", "reviewNotes"))
            }
        }
        equipment.forEachIndexed { index, item ->
            item {
                CardBox {
                    Text("Unidade ${index + 1} · ${item.str("type")}", fontWeight = FontWeight.Bold)
                    for ((key, label, max) in listOf(Triple("serial", "Número de série", 100), Triple("seal", "Selo / lacre", 100),
                        Triple("maintenanceYear", "Ano da manutenção", 4), Triple("hydroYear", "Ano hidrostático", 4))) {
                        OutlinedTextField(item.str(key), { if (it.length <= max) updateItem(index, key, it) },
                            modifier = Modifier.fillMaxWidth(), label = { Text(label) }, singleLine = true)
                    }
                }
            }
        }
        if (error.isNotBlank()) item { Text(error, color = MaterialTheme.colorScheme.error) }
        item {
            PrimaryButton("Salvar revisão", enabled = !vm.busy) {
                val next = draft.str("nextMaintenanceMonth")
                val name = draft.str("clientName").trim()
                val date = draft.str("date")
                val phone = draft.str("clientPhone").trim()
                val email = draft.str("clientEmail").trim()
                error = when {
                    name.isNotEmpty() && name.length < 2 -> "Confira o nome do cliente."
                    !date.matches(Regex("""\d{4}-\d{2}-\d{2}""")) || runCatching { LocalDate.parse(date) }.isFailure -> "Confira a data do serviço."
                    next.isNotEmpty() && (!next.matches(Regex("""20\d{2}-\d{2}""")) || runCatching { YearMonth.parse(next) }.isFailure) -> "Confira a próxima manutenção."
                    phone.isNotEmpty() && !phone.matches(Regex("""\+?[\d\s().-]{8,30}""")) -> "Confira o telefone."
                    email.isNotEmpty() && !email.matches(Regex("""[^\s@]+@[^\s@]+\.[^\s@]+""")) -> "Confira o e-mail."
                    needsValidity(equipment) -> "Informe o ano da manutenção de cada extintor e confira os anos hidrostáticos."
                    else -> ""
                }
                if (error.isBlank()) {
                    val updates = JSONObject()
                    for ((key) in fields) updates.put(key, draft.str(key).trim())
                    updates.put("items", JSONArray(equipment))
                    equipment.firstOrNull()?.let { first ->
                        updates.put("maintenanceValid", first.str("maintenanceYear")).put("hydroValid", first.str("hydroYear"))
                    }
                    vm.saveAdminReview(original, updates, done)
                }
            }
        }
    }
}
