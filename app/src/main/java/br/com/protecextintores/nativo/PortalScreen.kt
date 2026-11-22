package br.com.protecextintores.nativo

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.json.JSONObject
import java.text.NumberFormat
import java.text.Normalizer
import java.time.LocalDate
import java.util.Locale

private val adminTabs = listOf(
    PanelTab("Painel", PanelIcon.Grid, "Visão geral"),
    PanelTab("Manutenções", PanelIcon.Wrench),
    PanelTab("Extintores", PanelIcon.Flame),
    PanelTab("Clientes", PanelIcon.People, "Clientes e vendedores"),
    PanelTab("Pedidos", PanelIcon.List),
    PanelTab("Produtos", PanelIcon.Flame),
    PanelTab("Equipe", PanelIcon.People),
    PanelTab("Recebimentos", PanelIcon.Chart, "Custos e recebimentos")
)
private val adminKeys = mapOf(1 to "services", 2 to "types", 3 to "clients", 4 to "orders", 5 to "products", 6 to "employees")
private val sellerMore = listOf(PanelTab("Catálogo", PanelIcon.Flame), PanelTab("Pedidos", PanelIcon.List))

@Composable
fun PortalScreen(vm: AppVm) {
    val role = vm.portalRole
    val root = vm.portalState ?: return
    val admin = role == "admin"
    val sellerTabs = teamTabs.toMutableList().apply { this[1] = PanelTab("Ordens", PanelIcon.Wrench, "Ordens de serviço") }
    val tabs = if (admin) adminTabs.take(4) else sellerTabs
    var page by rememberSaveable(role) { mutableIntStateOf(0) }
    var refreshKey by remember { mutableIntStateOf(0) }
    val actions = buildList {
        if (admin) adminTabs.drop(4).forEachIndexed { index, tab ->
            add(PanelAction(tab.title, tab.icon) { page = index + 4 })
        }
        if (!admin) sellerMore.forEachIndexed { index, tab ->
            add(PanelAction(tab.title, tab.icon) { page = index + 4 })
        }
        addAll(panelActions(vm) { vm.refreshPortal(); refreshKey++ })
    }
    val title = if (admin) adminTabs.getOrNull(page)?.title else sellerMore.getOrNull(page - 4)?.title
    PanelChrome(tabs, page, { page = it }, if (admin) "AD" else "VD", actions,
        title = title
    ) { active ->
        if (admin) {
            val state = root.optJSONObject("state") ?: JSONObject()
            when (active) {
                0 -> AdminOverview(state) { page = it }
                3 -> RecordsPage(adminTabs[active].title,
                    state.optJSONArray("clients").objects() + state.optJSONArray("sellers").objects())
                7 -> AdminReceipts(state)
                else -> RecordsPage(adminTabs[active].title, state.optJSONArray(adminKeys.getValue(active)).objects())
            }
        } else {
            when (active) {
                0 -> SellerOverview({ page = it }, refreshKey)
                1 -> TeamDataPage("/api/seller/services", "Ordens de serviço", "services", refreshKey)
                2 -> TeamDataPage("/api/seller/next-maintenance", "Próximas manutenções", "services", refreshKey)
                3 -> TeamDataPage("/api/team/billing", "Meus acertos", "orders", refreshKey)
                4 -> RecordsPage("Catálogo", root.optJSONArray("products").objects())
                5 -> RecordsPage("Meus pedidos", root.optJSONArray("orders").objects())
            }
        }
    }
}

@Composable
private fun AdminOverview(state: JSONObject, select: (Int) -> Unit) {
    val services = state.optJSONArray("services").objects().map(::Svc)
    val pending = services.count { it.employeeCompleted && !it.closed && !it.cancelled }
    val unpaid = eligibleReceipts(state).filter { it.optJSONObject("payment")?.str("status") != "paid" }
    val today = LocalDate.now().toString()
    val overdue = unpaid.count { it.str("dueDate").let { date -> date.isNotEmpty() && date < today } }
    var query by rememberSaveable { mutableStateOf("") }
    val search = (1..6).flatMap { state.optJSONArray(adminKeys.getValue(it)).objects() }
        .filter { query.isNotBlank() && matches(it, query) }.take(20)
    PanelList {
        item { PanelSearch(query, { query = it }, "Buscar cliente, ordem ou funcionário") }
        if (query.isNotBlank()) {
            if (search.isEmpty()) item { EmptyRecord("Nenhum resultado encontrado.") }
            items(search) { RecordCard(it) }
        } else {
            item {
                val description = when (pending) {
                    0 -> "Acompanhe os atendimentos e os próximos compromissos da equipe."
                    1 -> "Há 1 ordem aguardando sua revisão."
                    else -> "Há $pending ordens aguardando sua revisão."
                }
                PanelIntro("CENTRO OPERACIONAL", "Seu dia, organizado.", description)
            }
            item {
                PanelMetrics(listOf(
                    PanelMetric("Aguardando revisão", pending.toString(), "Execução enviada pela equipe"),
                    PanelMetric("Em atendimento", services.count { !it.finished && !it.paused }.toString()),
                    PanelMetric("Serviços pausados", services.count { it.paused }.toString()),
                    PanelMetric("A receber", currency(unpaid.sumOf { it.optLong("revenueCents") } / 100.0),
                        if (overdue == 1) "1 acerto vencido" else "$overdue acertos vencidos")
                ))
            }
            item { PanelShortcut("Ordens de serviço", "Consultar andamento e serviços em revisão", PanelIcon.List) { select(1) } }
            item { PanelShortcut("Extintores", "Tipos, capacidades e preços", PanelIcon.Flame) { select(2) } }
            item { PanelShortcut("Custos e recebimentos", "Conferir resultados", PanelIcon.Chart) { select(7) } }
        }
    }
}

private fun eligibleReceipts(state: JSONObject) = state.optJSONArray("services").objects()
    .map(::Svc).filter { it.closed && !it.cancelled }.mapNotNull { it.j.optJSONObject("finance") }

@Composable
private fun AdminReceipts(state: JSONObject) {
    val receipts = eligibleReceipts(state)
    val (paid, open) = receipts.partition { it.optJSONObject("payment")?.str("status") == "paid" }
    PanelList {
        item { PanelIntro("FINANCEIRO", "Custos e recebimentos", "Ordens finalizadas e não canceladas.") }
        item {
            PanelMetrics(listOf(
                PanelMetric("Recebido", currency(paid.sumOf { it.optLong("revenueCents") } / 100.0)),
                PanelMetric("A receber", currency(open.sumOf { it.optLong("revenueCents") } / 100.0)),
                PanelMetric("Custos registrados", currency(receipts.sumOf { it.optLong("costCents") } / 100.0)),
                PanelMetric("Ordens finalizadas", receipts.size.toString())
            ))
        }
    }
}

@Composable
private fun SellerOverview(select: (Int) -> Unit, refresh: Int) {
    val orders = loadTeamSection("/api/seller/services", refresh)?.json?.optJSONArray("services").objects()
    val active = orders.map(::Svc).count { !it.closed && !it.cancelled }
    PanelList {
        item { PanelIntro("ÁREA COMERCIAL", "Suas ordens, em um só lugar.", "Acompanhe seus registros, a agenda e os acertos.") }
        if (orders.isNotEmpty()) item {
            PanelMetrics(listOf(PanelMetric("Em acompanhamento", active.toString()),
                PanelMetric("Finalizadas", orders.count { it.optBoolean("closed") }.toString())))
        }
        item { PanelShortcut("Ordens de serviço", "Consulte a situação de cada ordem", PanelIcon.Wrench) { select(1) } }
        item { PanelShortcut("Próximas manutenções", "Consulte o mês previsto para cada cliente", PanelIcon.Clock) { select(2) } }
        item { PanelShortcut("Meus acertos", "Acompanhe o saldo e as cobranças", PanelIcon.Chart) { select(3) } }
    }
}

@Composable
private fun loadTeamSection(path: String, refresh: Int): Api.ApiResult? {
    val token = Store.token
    var result by remember(path, token) { mutableStateOf<Api.ApiResult?>(null) }
    LaunchedEffect(path, token, refresh) {
        result = if (token.isEmpty()) null else Api.teamSection(token, path)
    }
    return result
}

@Composable
internal fun TeamDataPage(path: String, title: String, field: String, refresh: Int) {
    var retry by remember { mutableIntStateOf(0) }
    val response = loadTeamSection(path, refresh + retry)
    when {
        response == null -> PanelList {
            item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) { CircularProgressIndicator() } }
        }
        !response.ok -> PanelList {
            item { PanelIntro("", title) }
            item {
                EmptyRecord(response.error.ifEmpty { "Não foi possível carregar esta seção." })
                TextButton(onClick = { retry++ }) { Text("Tentar novamente") }
            }
        }
        path == "/api/team/billing" -> {
            val data = response.json
            val groups = data.optJSONArray("groups").objects()
            val charges = data.optJSONArray(field).objects().ifEmpty { data.optJSONArray("bills").objects() }
            PanelList {
                item { PanelIntro("ACERTOS", title) }
                item { PanelMetrics(listOf(PanelMetric("Saldo a pagar", currency(data.optLong("balanceCents") / 100.0)))) }
                items(groups) { RecordCard(it) }
                items(charges) { RecordCard(it) }
            }
        }
        else -> RecordsPage(title, response.json.optJSONArray(field).objects(),
            filterStatus = path == "/api/seller/services")
    }
}

@Composable
private fun RecordsPage(title: String, records: List<JSONObject>, filterStatus: Boolean = false) {
    var query by rememberSaveable(title) { mutableStateOf("") }
    var filter by rememberSaveable(title) { mutableIntStateOf(0) }
    val shown = records.filter { record ->
        matches(record, query) && when (filter) {
            1 -> !Svc(record).finished
            2 -> record.optBoolean("closed")
            else -> true
        }
    }
    PanelList {
        item { PanelIntro("", title) }
        item { PanelSearch(query, { query = it }, "Buscar nesta seção") }
        if (filterStatus) item {
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                listOf("Todas", "Em andamento", "Finalizadas").forEachIndexed { index, text ->
                    FilterChip(filter == index, { filter = index }, label = { Text(text) })
                }
            }
        }
        if (shown.isEmpty()) item { EmptyRecord("Nenhum registro encontrado.") }
        items(shown) { RecordCard(it) }
    }
}

@Composable
internal fun PanelList(content: androidx.compose.foundation.lazy.LazyListScope.() -> Unit) {
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 13.dp, end = 13.dp, top = 17.dp, bottom = 21.dp),
        verticalArrangement = Arrangement.spacedBy(13.dp),
        content = content
    )
}

private fun normalized(text: String) = Normalizer.normalize(text, Normalizer.Form.NFD)
    .replace(Regex("\\p{M}+"), "").lowercase(Locale.ROOT)

internal fun matches(item: JSONObject, query: String): Boolean {
    if (query.isBlank()) return true
    val searchable = listOf("clientName", "name", "code", "serviceType", "type", "date", "status", "model")
        .map(item::str) + item.optJSONArray("items").objects().map { it.str("type") + " " + it.str("kg") }
    return searchable.any { normalized(it).contains(normalized(query.trim())) }
}

@Composable
private fun RecordCard(item: JSONObject) {
    var open by remember { mutableStateOf(false) }
    val code = item.str("code")
    val title = item.str("clientName").ifBlank { item.str("name") }.ifBlank { code }
        .ifBlank { item.str("periodLabel") }.ifBlank { "Acerto" }
    val status = item.str("status")
    val fields = listOf(
        "Código" to code, "Tipo" to item.str("serviceType").ifBlank { item.str("type") },
        "Data" to item.str("date"), "Situação" to status, "Próxima manutenção" to item.str("nextMaintenanceMonth"),
        "Capacidade" to item.str("kg").let { if (it.isBlank()) "" else "$it kg" },
        "Telefone" to item.str("phone"), "E-mail" to item.str("email"),
        "Valor" to when {
            item.has("amountCents") -> currency(item.optLong("amountCents") / 100.0)
            item.has("price") -> currency(item.optDouble("price", 0.0))
            else -> ""
        }
    ).filter { it.second.isNotBlank() }
    val colors = MaterialTheme.colorScheme
    Surface(onClick = { open = true }, shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, colors.outline), color = colors.surface) {
        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            if (code.isNotBlank() && code != title) Text(code, style = MaterialTheme.typography.labelMedium, color = colors.primary)
            Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold)
            val secondary = fields.filter { it.first in setOf("Tipo", "Próxima manutenção", "Valor", "Capacidade") }
                .joinToString(" · ") { it.second }
            if (secondary.isNotEmpty()) Text(secondary, color = colors.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            if (status.isNotEmpty()) StatusChip(status)
        }
    }
    if (open) AlertDialog(
        onDismissRequest = { open = false },
        title = { Text(title) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                items(fields) { (label, value) ->
                    Column { Text(label, style = MaterialTheme.typography.labelMedium); Text(value) }
                }
                items(item.optJSONArray("items").objects()) { equipment ->
                    Text(listOf(equipment.str("type"), equipment.str("kg").takeIf { it.isNotEmpty() }?.let { "$it kg" }.orEmpty())
                        .filter { it.isNotEmpty() }.joinToString(" · "))
                }
                items(item.optJSONArray("events").objects().ifEmpty { item.optJSONArray("history").objects() }) { event ->
                    val label = event.str("description").ifEmpty { event.str("action") }.ifEmpty { event.str("status") }
                    if (label.isNotEmpty()) Text(label, style = MaterialTheme.typography.bodySmall)
                }
            }
        },
        confirmButton = { TextButton(onClick = { open = false }) { Text("Fechar") } }
    )
}

@Composable
internal fun EmptyRecord(message: String) {
    val color = MaterialTheme.colorScheme
    Surface(color = color.surface, shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, color.outline)) {
        Text(message, Modifier.fillMaxWidth().padding(17.dp), color = color.onSurfaceVariant)
    }
}

private fun currency(amount: Double) = NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(amount)
